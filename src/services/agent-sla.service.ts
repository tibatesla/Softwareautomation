// src/services/agent-sla.service.ts
//
// Agent SLA / speed-to-lead enforcement (CRM spec, Section 4). Two
// separate concerns, both scoped to working hours only (08:00-18:00 EAT,
// Kenya has no DST so this is a fixed UTC+3 offset, no timezone library
// needed):
//
//   1. Auto-assign: a qualified lead nobody has claimed within
//      UNCLAIMED_TIMEOUT_MINUTES gets routed to the next available
//      on-duty agent, round-robin by lastLeadAssignedAt (oldest first).
//      No penalty here -- nobody had a chance to respond yet.
//
//   2. Penalize + reopen: an agent who claimed a lead (whether by the
//      auto-assign above or by claiming it themselves) but never actually
//      sent a real reply within CLAIMED_NO_RESPONSE_TIMEOUT_MINUTES gets an
//      agent_penalties row logged against them, and the lead is reopened
//      (claim cleared) so the next tick's auto-assign step routes it to
//      someone else -- naturally deprioritized in the round-robin since
//      their lastLeadAssignedAt is now recent.
//
// KNOWN GAP: the original spec also wants an "urgent push notification"
// sent to the newly-assigned agent. There is no push/SMS/email channel
// anywhere in this project to send that through -- the only thing that
// exists today is the CRM UI itself, so an auto-assigned lead becomes
// visible the next time that agent opens the CRM, not the instant it
// happens. Building real-time notification would mean adding a whole new
// delivery channel, not something this module can do on its own.
import { withSystemContext } from '../config/database';
import { Prisma } from '../../generated/prisma';

const WORKING_HOURS_START_EAT = 8;
const WORKING_HOURS_END_EAT = 18;
const EAT_OFFSET_HOURS = 3; // Kenya is fixed UTC+3 year-round, no DST

const UNCLAIMED_TIMEOUT_MINUTES = 5;
const CLAIMED_NO_RESPONSE_TIMEOUT_MINUTES = 10;

export const isWithinWorkingHours = (now: Date = new Date()): boolean => {
  const eatHour = (now.getUTCHours() + EAT_OFFSET_HOURS) % 24;
  return eatHour >= WORKING_HOURS_START_EAT && eatHour < WORKING_HOURS_END_EAT;
};

const assignToNextAgent = async (tx: Prisma.TransactionClient, leadId: string): Promise<boolean> => {
  const nextAgent = await tx.user.findFirst({
    where: { role: 'agent', isActive: true, isOnDuty: true },
    orderBy: [{ lastLeadAssignedAt: { sort: 'asc', nulls: 'first' } }],
  });

  if (!nextAgent) {
    return false; // No on-duty agent available -- leave it unclaimed for the next tick.
  }

  const now = new Date();
  await tx.lead.update({ where: { id: leadId }, data: { claimedByAgentId: nextAgent.id, claimedAt: now } });
  await tx.user.update({ where: { id: nextAgent.id }, data: { lastLeadAssignedAt: now } });
  return true;
};

const autoAssignUnclaimedLeads = async (tx: Prisma.TransactionClient): Promise<number> => {
  const cutoff = new Date(Date.now() - UNCLAIMED_TIMEOUT_MINUTES * 60 * 1000);
  const overdue = await tx.lead.findMany({
    where: { qualificationStatus: 'qualified', claimedByAgentId: null, createdAt: { lte: cutoff } },
    select: { id: true },
  });

  let assigned = 0;
  for (const lead of overdue) {
    if (await assignToNextAgent(tx, lead.id)) assigned += 1;
  }
  return assigned;
};

const penalizeAndReopenSilentClaims = async (tx: Prisma.TransactionClient): Promise<number> => {
  const cutoff = new Date(Date.now() - CLAIMED_NO_RESPONSE_TIMEOUT_MINUTES * 60 * 1000);
  // "No reply since claimedAt" compares one lead's own claimedAt against its
  // messages' createdAt -- a per-row column comparison Prisma's query
  // builder can't express directly (filters compare a field against a
  // literal/variable, not another column on the same row), so candidates
  // are fetched first and checked individually below.
  const candidates = await tx.lead.findMany({
    where: { qualificationStatus: 'qualified', claimedByAgentId: { not: null }, claimedAt: { lte: cutoff } },
    select: { id: true, claimedByAgentId: true, claimedAt: true },
  });

  let penalized = 0;
  for (const lead of candidates) {
    const hasHumanReply = await tx.leadMessage.findFirst({
      where: {
        leadId: lead.id,
        direction: 'outbound',
        senderType: 'human',
        createdAt: { gte: lead.claimedAt! },
      },
      select: { id: true },
    });
    if (hasHumanReply) continue;

    // Guard against re-penalizing the same silent claim on every subsequent
    // tick -- only act once per claim (claimedAt uniquely identifies it).
    const alreadyPenalized = await tx.agentPenalty.findFirst({
      where: { leadId: lead.id, agentId: lead.claimedByAgentId!, createdAt: { gte: lead.claimedAt! } },
      select: { id: true },
    });
    if (alreadyPenalized) continue;

    const minutesLate = Math.round((Date.now() - lead.claimedAt!.getTime()) / 60000);
    await tx.agentPenalty.create({
      data: {
        agentId: lead.claimedByAgentId!,
        leadId: lead.id,
        penaltyType: 'SLA_NO_RESPONSE',
        minutesLate,
        notes: `Claimed but no reply sent within ${CLAIMED_NO_RESPONSE_TIMEOUT_MINUTES} minutes -- reopened for reassignment.`,
      },
    });
    await tx.lead.update({ where: { id: lead.id }, data: { claimedByAgentId: null, claimedAt: null } });
    penalized += 1;
  }
  return penalized;
};

export const runAgentSlaCheck = async (): Promise<void> => {
  if (!isWithinWorkingHours()) {
    return; // Outside 08:00-18:00 EAT -- no auto-assignment, no penalties.
  }

  await withSystemContext(async (tx) => {
    const penalized = await penalizeAndReopenSilentClaims(tx);
    const assigned = await autoAssignUnclaimedLeads(tx);
    if (penalized > 0 || assigned > 0) {
      console.log(`[Agent SLA] Reopened ${penalized} silent claim(s), auto-assigned ${assigned} lead(s).`);
    }
  });
};
