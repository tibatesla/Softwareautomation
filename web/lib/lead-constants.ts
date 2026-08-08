// Mirrors src/schemas/lead.schema.ts on the backend.
export const LEAD_QUALIFICATION_STATUS_VALUES = [
  "new",
  "qualifying",
  "qualified",
  "unqualified",
  "converted",
  "lost",
] as const;

export const LEAD_SEGMENT_VALUES = ["domestic", "diaspora"] as const;

export const DEAL_STAGE_VALUES = [
  "new",
  "site_visit_scheduled",
  "site_visit_done",
  "offer_signed",
  "deposit_paid",
  "commission_paid",
] as const;
