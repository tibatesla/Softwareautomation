// src/services/booking-scheduling.service.ts
//
// Slot generation and booking confirmation shared by the two ways a lead
// can self-book a visit: tapping a slot in the WhatsApp qualification
// bot's message list (lead-qualification.service.ts), or clicking the web
// booking link sent alongside it (public-booking.controller.ts). One
// booking implementation, two entry points -- neither owns this logic.
import { Prisma } from '../../generated/prisma';

export const EAT_OFFSET_HOURS = 3; // Kenya is fixed UTC+3 year-round, no DST -- same assumption agent-sla.service.ts makes.

// Fixed viewing hours (Nairobi time) offered as slot options -- a simple,
// predictable schedule rather than trying to model each agent's actual
// working hours, which nothing else in this codebase tracks per-agent.
const VISIT_HOURS_EAT = [9, 11, 14, 16];

/**
 * Picks who a self-booked visit gets assigned to. If the lead is already
 * claimed, that agent keeps it -- a booking shouldn't silently reassign a
 * lead someone is actively working. Otherwise, round-robin among on-duty
 * agents (same ordering agent-sla.service.ts uses), falling back to any
 * active agent if none are on duty right now: both entry points can be
 * used outside working hours, and a visit request still needs an owner.
 */
export const pickAgentForBooking = async (
  tx: Prisma.TransactionClient,
  lead: { id: string; claimedByAgentId: string | null },
): Promise<string | undefined> => {
  if (lead.claimedByAgentId) return lead.claimedByAgentId;

  const onDutyAgent = await tx.user.findFirst({
    where: { role: 'agent', isActive: true, isOnDuty: true },
    orderBy: [{ lastLeadAssignedAt: { sort: 'asc', nulls: 'first' } }],
  });
  const chosen =
    onDutyAgent ??
    (await tx.user.findFirst({
      where: { role: 'agent', isActive: true },
      orderBy: [{ lastLeadAssignedAt: { sort: 'asc', nulls: 'first' } }],
    }));
  if (!chosen) return undefined;

  const now = new Date();
  await tx.lead.update({ where: { id: lead.id }, data: { claimedByAgentId: chosen.id, claimedAt: now } });
  await tx.user.update({ where: { id: chosen.id }, data: { lastLeadAssignedAt: now } });
  return chosen.id;
};

/**
 * Generates up to `count` open slots for `agentId` over the next two
 * weeks, skipping Sundays and anything the agent already has a booking
 * against (exact-timestamp match only -- bookings have no duration field
 * anywhere in this system to check real overlap against). All date math
 * is done in UTC-shifted-by-EAT_OFFSET_HOURS terms so it's correct
 * regardless of the server's own local timezone.
 */
export const generateAvailableSlots = async (
  tx: Prisma.TransactionClient,
  agentId: string,
  count: number,
): Promise<{ start: Date; label: string }[]> => {
  const nairobiNow = new Date(Date.now() + EAT_OFFSET_HOURS * 60 * 60 * 1000);
  const baseYear = nairobiNow.getUTCFullYear();
  const baseMonth = nairobiNow.getUTCMonth();
  const baseDate = nairobiNow.getUTCDate();
  const minLeadTimeMs = 60 * 60 * 1000; // don't offer anything less than 1h out

  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset < 14 && candidates.length < count * 3; dayOffset++) {
    const weekday = new Date(Date.UTC(baseYear, baseMonth, baseDate + dayOffset)).getUTCDay(); // 0 = Sunday
    if (weekday === 0) continue;

    for (const hour of VISIT_HOURS_EAT) {
      const slotUtc = new Date(Date.UTC(baseYear, baseMonth, baseDate + dayOffset, hour - EAT_OFFSET_HOURS, 0, 0));
      if (slotUtc.getTime() - Date.now() < minLeadTimeMs) continue;
      candidates.push(slotUtc);
    }
  }

  const existing = await tx.booking.findMany({
    where: { agentId, scheduledAt: { in: candidates } },
    select: { scheduledAt: true },
  });
  const busy = new Set(existing.map((b) => b.scheduledAt.getTime()));

  return candidates
    .filter((slot) => !busy.has(slot.getTime()))
    .slice(0, count)
    .map((start) => ({
      start,
      label: start.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Nairobi',
      }),
    }));
};

export type BookingConfirmationResult = { ok: true; whenLabel: string } | { ok: false };

/**
 * Creates the actual booking row once a lead has picked a specific slot --
 * the one place that does this, shared by the WhatsApp tap-to-book reply
 * and the public web booking link. `source` only affects the booking's
 * notes field, for an agent glancing at a booking to see how it came in.
 * `lead.propertyId` is allowed to be null -- most real opening messages
 * never name a specific listing, so requiring a match here meant almost no
 * real lead ever got a booking offer; this books a general consultation
 * instead (property_id left null on the row) rather than blocking it.
 */
export const confirmLeadBooking = async (
  tx: Prisma.TransactionClient,
  lead: { id: string; propertyId: string | null; claimedByAgentId: string | null; visitPreference: string | null },
  scheduledAt: Date,
  source: 'WhatsApp' | 'web booking link',
): Promise<BookingConfirmationResult> => {
  const agentId = await pickAgentForBooking(tx, lead);
  if (!agentId) return { ok: false };

  await tx.booking.create({
    data: {
      propertyId: lead.propertyId,
      leadId: lead.id,
      agentId,
      scheduledAt,
      isVirtual: lead.visitPreference === 'virtual',
      notes: lead.propertyId ? `Self-booked via ${source}` : `Self-booked via ${source} (general consultation, no property matched)`,
    },
  });
  // Same dealStage-advancing side effect a booking made in the CRM UI has
  // (see createBooking in booking.controller.ts) -- only from the initial
  // stage, so this never regresses a deal further along.
  await tx.lead.updateMany({ where: { id: lead.id, dealStage: 'new' }, data: { dealStage: 'site_visit_scheduled' } });

  const whenLabel = scheduledAt.toLocaleString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  });
  return { ok: true, whenLabel };
};
