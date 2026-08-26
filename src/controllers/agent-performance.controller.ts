// src/controllers/agent-performance.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext } from '../config/database';

/**
 * Per-agent performance, computed from data that already exists elsewhere
 * (leads, bookings, agent_penalties, payments) rather than a dedicated
 * table. Aggregated in application code, not the DB query -- same call as
 * public-property.controller.ts's effectivePrice sort: this dataset is
 * small enough that fetching the raw rows once and reducing them per agent
 * is simpler than four separate groupBy shapes, and just as correct.
 * "Revenue closed" is payments tied to a lead the agent currently has
 * claimed, not payments they personally recorded (an owner recording a
 * payment for an agent's lead should still count toward that agent).
 */
export const getAgentPerformance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;

  const agents = await withRLSContext(id, role, (tx) =>
    tx.user.findMany({
      where: { role: 'agent' },
      select: { id: true, fullName: true, email: true, isActive: true, isOnDuty: true },
      orderBy: { fullName: 'asc' },
    }),
  );

  const agentIds = agents.map((a) => a.id);

  const [leads, bookings, penalties, payments] = await withRLSContext(id, role, (tx) =>
    Promise.all([
      tx.lead.findMany({
        where: { claimedByAgentId: { in: agentIds } },
        select: { claimedByAgentId: true, qualificationStatus: true },
      }),
      tx.booking.findMany({
        where: { agentId: { in: agentIds } },
        select: { agentId: true, status: true },
      }),
      tx.agentPenalty.findMany({
        where: { agentId: { in: agentIds } },
        select: { agentId: true },
      }),
      tx.payment.findMany({
        where: { lead: { claimedByAgentId: { in: agentIds } } },
        select: { amount: true, lead: { select: { claimedByAgentId: true } } },
      }),
    ]),
  );

  const stats = agents.map((agent) => {
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

  res.status(200).json(stats);
};
