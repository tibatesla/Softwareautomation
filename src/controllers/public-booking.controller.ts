// src/controllers/public-booking.controller.ts
//
// Public, unauthenticated companion to the WhatsApp tap-to-book flow -- the
// web booking link sent alongside the slot-list buttons (see
// lead-qualification.service.ts / CLOSING_WITH_BOOKING_OFFER). There's no
// user account here, just a link: gated entirely by leads.booking_token, an
// unguessable, single-use value cleared the moment it's used (or a fresh
// slot offer replaces it). Shares booking-scheduling.service.ts with the
// WhatsApp path, so a slot picked here behaves identically to one tapped
// in WhatsApp -- same agent-assignment rules, same dealStage side effect.
import { Request, Response } from 'express';
import { withSystemContext } from '../config/database';
import { generateAvailableSlots, confirmLeadBooking } from '../services/booking-scheduling.service';
import { sendWhatsAppText } from '../services/whatsapp-cloud-api.service';

// Same wording the WhatsApp path sends on a tap-confirmed booking (see
// BOOKING_CONFIRMED in lead-qualification.service.ts) -- kept as its own
// copy rather than exported/shared, since these two are free to drift in
// wording independently and neither is the "real" owner of the other's copy.
const BOOKING_CONFIRMED = (whenLabel: string) =>
  `You're all set! Your visit is booked for ${whenLabel}. We look forward to seeing you then -- if anything changes, just let us know.`;

export const getBookingOptions = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;

  const result = await withSystemContext(async (tx) => {
    const lead = await tx.lead.findFirst({
      where: { bookingToken: token, awaitingBookingReply: true },
      select: {
        propertyId: true,
        claimedByAgentId: true,
        visitPreference: true,
        property: { select: { title: true } },
      },
    });
    if (!lead || !lead.propertyId || !lead.claimedByAgentId) return null;

    const agent = await tx.user.findUnique({ where: { id: lead.claimedByAgentId }, select: { fullName: true } });
    const slots = await generateAvailableSlots(tx, lead.claimedByAgentId, 8);

    return {
      propertyTitle: lead.property?.title ?? null,
      agentName: agent?.fullName ?? null,
      isVirtual: lead.visitPreference === 'virtual',
      slots: slots.map((slot) => ({ id: slot.start.toISOString(), label: slot.label })),
    };
  });

  if (!result) {
    res.status(404).json({ error: 'This booking link is no longer valid.' });
    return;
  }
  res.status(200).json(result);
};

export const confirmBooking = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const slotId = typeof req.body?.slotId === 'string' ? req.body.slotId : undefined;
  if (!slotId) {
    res.status(400).json({ error: 'Missing slotId' });
    return;
  }

  const scheduledAt = new Date(slotId);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    res.status(400).json({ error: 'That time slot is no longer valid.' });
    return;
  }

  const result = await withSystemContext(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { bookingToken: token, awaitingBookingReply: true } });
    if (!lead) {
      return { ok: false as const, status: 404, error: 'This booking link is no longer valid.' };
    }

    // Cleared immediately, before the booking is even created -- the
    // token is single-use regardless of what happens next, same as the
    // WhatsApp path clearing awaitingBookingReply as soon as a reply
    // arrives (not after it successfully resolves to a booking).
    await tx.lead.update({ where: { id: lead.id }, data: { awaitingBookingReply: false, bookingToken: null } });

    const confirmation = await confirmLeadBooking(tx, lead, scheduledAt, 'web booking link');
    if (!confirmation.ok) {
      return { ok: false as const, status: 409, error: "Sorry, we couldn't complete that booking. Please contact us directly." };
    }
    return { ok: true as const, whenLabel: confirmation.whenLabel, waId: lead.phoneNumber.replace('+', '') };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.status(200).json({ whenLabel: result.whenLabel });

  // Best-effort, after the response -- a WhatsApp outage here must never
  // fail the booking itself, which is already saved at this point.
  try {
    await sendWhatsAppText(result.waId, BOOKING_CONFIRMED(result.whenLabel));
  } catch (error) {
    console.error('[Public Booking] WhatsApp confirmation send failed (booking already saved):', error);
  }
};
