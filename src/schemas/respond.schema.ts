// src/schemas/respond.schema.ts
import { z } from 'zod';

export const respondWebhookSchema = z.object({
  contact_id: z.string().min(1),
  phone_number: z.string().regex(/^\+\d{10,15}$/, "Invalid E.164 phone format"),
  name: z.string().optional(),
  property_id: z.string().min(1),
  qualification_data: z.object({
  investment_type: z.string().min(1, "Investment type is required"),
  budget_envelope: z.string().min(1, "Budget is required")
}),
  tags: z.array(z.string()).default([]),
});

export type RespondWebhookPayload = z.infer<typeof respondWebhookSchema>;