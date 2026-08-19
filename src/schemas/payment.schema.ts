// src/schemas/payment.schema.ts
import { z } from 'zod';

const notInTheFuture = (val: string | undefined) => val === undefined || new Date(val).getTime() <= Date.now();

export const paymentPayerTypeValues = ['lead', 'developer'] as const;

export const createPaymentSchema = z.object({
  propertyId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  paymentMethod: z.string().optional(),
  paymentDate: z.string().datetime().optional().refine(notInTheFuture, {
    message: 'paymentDate cannot be in the future',
  }),
  notes: z.string().optional(),
  // Defaults to 'lead' at the DB level if omitted -- 'developer' marks a
  // commission payment from the property's developer rather than a
  // deposit/installment from the lead. Still tied to propertyId/leadId
  // like any other payment, so a commission stays traceable to the deal
  // that produced it.
  payerType: z.enum(paymentPayerTypeValues).optional(),
});

// Owner-only (see payment.routes.ts + the payments_owner_update RLS policy).
// Deliberately excludes propertyId/leadId/recordedBy -- the ledger's link to
// its property/lead and who recorded it are not editable, only correction
// of typos in the amount/method/date/notes/payerType.
export const updatePaymentSchema = z.object({
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  paymentMethod: z.string().optional(),
  paymentDate: z.string().datetime().optional().refine(notInTheFuture, {
    message: 'paymentDate cannot be in the future',
  }),
  notes: z.string().optional(),
  payerType: z.enum(paymentPayerTypeValues).optional(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type CreatePaymentPayload = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentPayload = z.infer<typeof updatePaymentSchema>;
