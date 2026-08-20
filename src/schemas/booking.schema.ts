// src/schemas/booking.schema.ts
import { z } from 'zod';

export const bookingStatusValues = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;

export const createBookingSchema = z.object({
  propertyId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(), // ignored for agents (forced to self), honored for owner/admin
  scheduledAt: z.string().datetime(),
  isVirtual: z.boolean().optional(),
  notes: z.string().optional(),
});

export const updateBookingSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(bookingStatusValues).optional(),
  isVirtual: z.boolean().optional(),
  notes: z.string().optional(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type CreateBookingPayload = z.infer<typeof createBookingSchema>;
export type UpdateBookingPayload = z.infer<typeof updateBookingSchema>;
