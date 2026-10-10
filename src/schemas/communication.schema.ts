// src/schemas/communication.schema.ts
import { z } from 'zod';

// SMS and email are listed so the channel picker can show them as
// "coming soon" in the UI -- only whatsapp actually sends anything today
// (see communication.controller.ts).
export const broadcastChannelValues = ['whatsapp', 'sms', 'email'] as const;
export const broadcastTargetValues = ['single', 'all'] as const;

export const broadcastSchema = z
  .object({
    channel: z.enum(broadcastChannelValues),
    target: z.enum(broadcastTargetValues),
    leadId: z.string().uuid().optional(),
    body: z.string().min(1).max(4096),
  })
  .refine((data) => data.target !== 'single' || Boolean(data.leadId), {
    message: 'leadId is required when target is "single"',
    path: ['leadId'],
  });

export type BroadcastPayload = z.infer<typeof broadcastSchema>;
