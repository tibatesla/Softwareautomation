-- 012_crm_property_lead_fields.sql
--
-- Brings properties/leads up to the CRM Handoff spec (CRM.pdf): the real
-- GHL field set for property listings, contact tags/investment-type/
-- transaction-type, and a proper post-qualification sales pipeline
-- (deal_stage), which is a distinct concept from lead.qualification_status
-- (the WhatsApp bot's pre-CRM triage). "Virtual Site Visit Done" is
-- deliberately NOT modeled as a pipeline stage, per the doc's own
-- recommendation -- deal_stage starts at 'new' instead.

CREATE TYPE deal_stage AS ENUM (
  'new',
  'site_visit_scheduled',
  'site_visit_done',
  'offer_signed',
  'deposit_paid',
  'commission_paid'
);

ALTER TABLE properties
  ADD COLUMN reference_id text UNIQUE,
  ADD COLUMN price_min numeric(14,2),
  ADD COLUMN price_max numeric(14,2),
  ADD COLUMN unit_type text,
  ADD COLUMN total_units integer,
  ADD COLUMN developer_contact_name text,
  ADD COLUMN developer_email text,
  ADD COLUMN developer_phone text,
  ADD COLUMN completion_time text,
  ADD COLUMN level_floors integer,
  ADD COLUMN view text,
  ADD COLUMN payment_plan_structure text,
  ADD COLUMN house_size_sqft numeric(10,2),
  ADD COLUMN amenities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN sub_location text,
  ADD COLUMN images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN video_url text;

ALTER TABLE leads
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN investment_type text,
  ADD COLUMN transaction_type text,
  ADD COLUMN deal_stage deal_stage NOT NULL DEFAULT 'new';

CREATE INDEX idx_leads_deal_stage ON leads (deal_stage);
