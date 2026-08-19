// src/schemas/lead.schema.ts
import { z } from 'zod';

export const leadQualificationStatusValues = [
  'new',
  'qualifying',
  'qualified',
  'unqualified',
  'converted',
  'lost',
] as const;

export const leadSegmentValues = ['domestic', 'diaspora'] as const;

// Sales pipeline stage (CRM Handoff, Section 5) -- distinct from
// qualificationStatus, which is the WhatsApp bot's pre-CRM triage.
// "Virtual Site Visit Done" is deliberately not a stage here, per the
// source doc's own recommendation; dealStage starts at 'new' instead.
export const dealStageValues = [
  'new',
  'site_visit_scheduled',
  'site_visit_done',
  'offer_signed',
  'deposit_paid',
  'commission_paid',
] as const;

export const createLeadSchema = z.object({
  fullName: z.string().optional(),
  phoneNumber: z.string().min(1),
  email: z.string().email().optional(),
  source: z.string().optional(),
  propertyId: z.string().uuid().optional(),
  qualificationStatus: z.enum(leadQualificationStatusValues).optional(),
  budgetRange: z.string().optional(),
  preferredUnit: z.string().optional(),
  purchaseTimeline: z.string().optional(),
  targetSegment: z.enum(leadSegmentValues).optional(),
  countryCode: z.string().optional(),
  requiresProxyVisit: z.boolean().optional(),
  proxyPhoneNumber: z.string().optional(),
  isOvernightDiaspora: z.boolean().optional(),
  fbclid: z.string().optional(),

  // CRM Handoff (CRM.pdf) field set.
  tags: z.array(z.string()).optional(),
  investmentType: z.string().optional(),
  transactionType: z.string().optional(),
  dealStage: z.enum(dealStageValues).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const sendLeadMessageSchema = z.object({
  body: z.string().min(1).max(4096),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type CreateLeadPayload = z.infer<typeof createLeadSchema>;
export type UpdateLeadPayload = z.infer<typeof updateLeadSchema>;
export type SendLeadMessagePayload = z.infer<typeof sendLeadMessageSchema>;
