// src/services/agent-performance.service.ts
//
// Per-agent performance, computed from data that already exists elsewhere
// (leads, bookings, agent_penalties, payments) rather than a dedicated
// table. Aggregated in application code, not the DB query -- same call as
// public-property.controller.ts's effectivePrice sort: this dataset is
// small enough that fetching the raw rows once and reducing them per agent
// is simpler than four separate groupBy shapes, and just as correct.
// "Revenue closed" is payments tied to a lead the agent currently has
// claimed, not payments they personally recorded (an owner recording a
// payment for an agent's lead should still count toward that agent).
//
// Shared between the live dashboard (agent-performance.controller.ts) and
// the downloadable report (report.controller.ts) -- both need the exact
// same numbers, just rendered differently.
import { withRLSContext, AppRole } from '../config/database';

const WEEKS_OF_TREND = 12;

// Monday-anchored week bucket (UTC) -- matches no particular business
// requirement, just needs to be a stable, consistent grouping so the same
// event always lands in the same bucket.
const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const weekKey = (date: Date): string => startOfWeek(date).toISOString().slice(0, 10);

const trendWeekKeys = (weeks: number): string[] => {
  const keys: string[] = [];
  const cursor = startOfWeek(new Date());
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setUTCDate(d.getUTCDate() - i * 7);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
};

export interface AgentStat {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isOnDuty: boolean;
  leadsClaimed: number;
  leadsQualified: number;
  leadsConverted: number;
  bookingsScheduled: number;
  bookingsCompleted: number;
  bookingsMissed: number;
  slaViolations: number;
  revenueClosed: number;
}

export interface TrendPoint {
  weekStart: string;
  leadsClaimed: number;
  bookingsCompleted: number;
  revenueClosed: number;
}

/**
 * Visibility: an agent gets only their own row and their own trend (this
 * used to be owner-only entirely -- agents had no way to see their own
 * KPIs at all). Owner/admin get every agent plus a team-wide trend.
 */
export const computeAgentPerformance = async (id: string, role: AppRole): Promise<{ agents: AgentStat[]; trend: TrendPoint[] }> => {
  const selfOnly = role === 'agent';

  const agents = await withRLSContext(id, role, (tx) =>
    tx.user.findMany({
      where: selfOnly ? { role: 'agent', id } : { role: 'agent' },
      select: { id: true, fullName: true, email: true, isActive: true, isOnDuty: true },
      orderBy: { fullName: 'asc' },
    }),
  );

  const agentIds = agents.map((a) => a.id);
  const trendCutoff = startOfWeek(new Date());
  trendCutoff.setUTCDate(trendCutoff.getUTCDate() - (WEEKS_OF_TREND - 1) * 7);

  const [leads, bookings, penalties, payments] = await withRLSContext(id, role, (tx) =>
    Promise.all([
      tx.lead.findMany({
        where: { claimedByAgentId: { in: agentIds } },
        select: { claimedByAgentId: true, qualificationStatus: true, createdAt: true },
      }),
      tx.booking.findMany({
        where: { agentId: { in: agentIds } },
        select: { agentId: true, status: true, scheduledAt: true },
      }),
      tx.agentPenalty.findMany({
        where: { agentId: { in: agentIds } },
        select: { agentId: true },
      }),
      tx.payment.findMany({
        where: { lead: { claimedByAgentId: { in: agentIds } } },
        select: { amount: true, paymentDate: true, lead: { select: { claimedByAgentId: true } } },
      }),
    ]),
  );

  const stats: AgentStat[] = agents.map((agent) => {
    const agentLeads = leads.filter((l) => l.claimedByAgentId === agent.id);
    const agentBookings = bookings.filter((b) => b.agentId === agent.id);
    const agentPayments = payments.filter((p) => p.lead?.claimedByAgentId === agent.id);

    return {
      id: agent.id,
      fullName: agent.fullName,
      email: agent.email,
      isActive: agent.isActive,
      isOnDuty: agent.isOnDuty,
      leadsClaimed: agentLeads.length,
      leadsQualified: agentLeads.filter((l) => l.qualificationStatus === 'qualified').length,
      leadsConverted: agentLeads.filter((l) => l.qualificationStatus === 'converted').length,
      bookingsScheduled: agentBookings.filter((b) => b.status === 'scheduled').length,
      bookingsCompleted: agentBookings.filter((b) => b.status === 'completed').length,
      bookingsMissed: agentBookings.filter((b) => b.status === 'no_show' || b.status === 'cancelled').length,
      slaViolations: penalties.filter((p) => p.agentId === agent.id).length,
      revenueClosed: agentPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    };
  });

  // Weekly trend across whatever scope is visible (just this agent, or the
  // whole team) -- the per-agent bar charts only ever show current totals,
  // this is what actually answers "how are we trending over time."
  const weeks = trendWeekKeys(WEEKS_OF_TREND);
  const trendByWeek = new Map<string, { leadsClaimed: number; bookingsCompleted: number; revenueClosed: number }>();
  for (const w of weeks) trendByWeek.set(w, { leadsClaimed: 0, bookingsCompleted: 0, revenueClosed: 0 });

  for (const l of leads) {
    if (l.createdAt < trendCutoff) continue;
    const bucket = trendByWeek.get(weekKey(l.createdAt));
    if (bucket) bucket.leadsClaimed += 1;
  }
  for (const b of bookings) {
    if (b.status !== 'completed' || b.scheduledAt < trendCutoff) continue;
    const bucket = trendByWeek.get(weekKey(b.scheduledAt));
    if (bucket) bucket.bookingsCompleted += 1;
  }
  for (const p of payments) {
    if (p.paymentDate < trendCutoff) continue;
    const bucket = trendByWeek.get(weekKey(p.paymentDate));
    if (bucket) bucket.revenueClosed += Number(p.amount);
  }

  const trend: TrendPoint[] = weeks.map((weekStart) => ({ weekStart, ...trendByWeek.get(weekStart)! }));

  return { agents: stats, trend };
};
