// src/controllers/booking.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext, withSystemContext, AppRole } from '../config/database';
import { createBookingSchema, updateBookingSchema, bulkDeleteSchema } from '../schemas/booking.schema';
import { sendWhatsAppText } from '../services/whatsapp-cloud-api.service';

export const listBookings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const bookings = await withRLSContext(id, role, (tx) =>
    tx.booking.findMany({ orderBy: { scheduledAt: 'asc' } }),
  );
  res.status(200).json(bookings);
};

export const getBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const booking = await withRLSContext(id, role, (tx) =>
    tx.booking.findUnique({ where: { id: req.params.id } }),
  );

  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  res.status(200).json(booking);
};

export const createBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = createBookingSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed booking payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  // Agents can only ever book themselves; owner/admin may book on behalf of
  // any agent by supplying agentId, defaulting to themselves if omitted.
  const agentId = role === 'agent' ? id : parseResult.data.agentId || id;

  try {
    const { booking, notify } = await withRLSContext(id, role, async (tx) => {
      const created = await tx.booking.create({
        data: {
          propertyId: parseResult.data.propertyId,
          leadId: parseResult.data.leadId,
          agentId,
          scheduledAt: parseResult.data.scheduledAt,
          isVirtual: parseResult.data.isVirtual,
          notes: parseResult.data.notes,
        },
      });

      // CRM Handoff (CRM.pdf, Section 5): booking a site visit is what
      // advances a lead into "Physical Site Visit Scheduled" -- only from
      // the initial stage, so this never regresses a deal that's already
      // further along (e.g. a follow-up visit after an offer was signed).
      let notify: { leadId: string; phoneNumber: string; leadName: string | null; propertyTitle: string } | null = null;
      if (parseResult.data.leadId) {
        await tx.lead.updateMany({
          where: { id: parseResult.data.leadId, dealStage: 'new' },
          data: { dealStage: 'site_visit_scheduled' },
        });

        const [lead, property] = await Promise.all([
          tx.lead.findUnique({ where: { id: parseResult.data.leadId }, select: { phoneNumber: true, fullName: true } }),
          tx.property.findUnique({ where: { id: created.propertyId }, select: { title: true } }),
        ]);
        if (lead) {
          notify = { leadId: parseResult.data.leadId, phoneNumber: lead.phoneNumber, leadName: lead.fullName, propertyTitle: property?.title ?? 'the property' };
        }
      }

      return { booking: created, notify };
    });

    res.status(201).json(booking);

    // Best-effort, after the response is already sent: a booking an agent
    // just made in the CRM should reach the lead on WhatsApp the same way
    // a bot self-booked one does, so the client isn't left wondering
    // whether it actually went through. Never lets a WhatsApp failure turn
    // a successfully-created booking into an error response.
    if (notify) {
      try {
        const whenLabel = booking.scheduledAt.toLocaleString('en-KE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'Africa/Nairobi',
        });
        const greeting = notify.leadName ? `Hi ${notify.leadName}` : 'Hi';
        const messageText = `${greeting}, your visit to ${notify.propertyTitle} has been booked for ${whenLabel}. We look forward to seeing you then! If anything changes, just let us know here.`;
        const waId = notify.phoneNumber.replace(/^\+/, '');

        await sendWhatsAppText(waId, messageText);
        await withSystemContext(async (tx) => {
          const message = await tx.leadMessage.create({
            data: { leadId: notify!.leadId, direction: 'outbound', senderType: 'bot', body: messageText },
          });
          await tx.lead.update({ where: { id: notify!.leadId }, data: { lastMessageAt: message.createdAt } });
        });
      } catch (error) {
        console.error('[Booking] Confirmation WhatsApp message failed to send:', error);
      }
    }
  } catch {
    res.status(400).json({ error: 'Unable to create booking -- check propertyId/leadId/agentId reference valid records' });
  }
};

export const updateBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = updateBookingSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed booking payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;

  try {
    const booking = await withRLSContext(id, role, (tx) =>
      tx.booking.update({ where: { id: req.params.id }, data: parseResult.data }),
    );
    res.status(200).json(booking);
  } catch {
    res.status(404).json({ error: 'Booking not found' });
  }
};

/**
 * Same access shape as update: RLS (bookings_owner_admin_all /
 * bookings_agent_own, both bare USING clauses) lets Owner/Admin delete any
 * booking and an Agent delete only their own, no route-level role check
 * needed. Nothing else references a booking as a foreign key, so unlike
 * deleteProperty/deleteLead there's no linked-record check here.
 */
const deleteBookingCore = async (userId: string, role: AppRole, bookingId: string): Promise<boolean> => {
  try {
    await withRLSContext(userId, role, (tx) => tx.booking.delete({ where: { id: bookingId } }));
    return true;
  } catch {
    return false;
  }
};

export const deleteBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const ok = await deleteBookingCore(id, role, req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  res.status(204).send();
};

export const bulkDeleteBookings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = bulkDeleteSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed request', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const results = await Promise.all(
    parseResult.data.ids.map(async (bookingId) => {
      const ok = await deleteBookingCore(id, role, bookingId);
      return ok
        ? { id: bookingId, deleted: true as const }
        : { id: bookingId, deleted: false as const, error: 'Booking not found (or not yours to delete)' };
    }),
  );

  res.status(200).json({
    deleted: results.filter((r) => r.deleted).map((r) => r.id),
    failed: results.filter((r): r is { id: string; deleted: false; error: string } => !r.deleted),
  });
};
