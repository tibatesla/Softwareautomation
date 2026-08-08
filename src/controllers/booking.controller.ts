// src/controllers/booking.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext } from '../config/database';
import { createBookingSchema, updateBookingSchema } from '../schemas/booking.schema';

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
    const booking = await withRLSContext(id, role, async (tx) => {
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
      if (parseResult.data.leadId) {
        await tx.lead.updateMany({
          where: { id: parseResult.data.leadId, dealStage: 'new' },
          data: { dealStage: 'site_visit_scheduled' },
        });
      }

      return created;
    });
    res.status(201).json(booking);
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
