-- 004_create_leads.sql
-- Created before payments/bookings since both reference it.

CREATE TABLE leads (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name              text,
  phone_number           text NOT NULL,
  email                  text,
  source                 text,
  property_id            uuid REFERENCES properties(id),
  qualification_status   lead_qualification_status NOT NULL DEFAULT 'new',
  budget_range           text,
  preferred_unit         text,
  purchase_timeline      text,
  target_segment         lead_segment,
  country_code           text,
  requires_proxy_visit   boolean NOT NULL DEFAULT false,
  proxy_phone_number     text,
  is_overnight_diaspora  boolean NOT NULL DEFAULT false,
  fbclid                 text,
  claimed_at             timestamptz,
  claimed_by_agent_id    uuid REFERENCES users(id),
  last_capi_fired_at     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_phone ON leads (phone_number);
CREATE INDEX idx_leads_claimed_by ON leads (claimed_by_agent_id);
CREATE INDEX idx_leads_segment_status ON leads (target_segment, qualification_status);

-- Fast scan for the future SLA sweep: qualified but not yet claimed.
CREATE INDEX idx_leads_unclaimed_qualified ON leads (created_at)
  WHERE qualification_status = 'qualified' AND claimed_by_agent_id IS NULL;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

CREATE POLICY leads_owner_admin_all ON leads
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

-- NOTE for the next phase: this only covers leads an agent has already
-- claimed. The future "leads inbox" endpoint needs an additional policy
-- or query path so agents can see unclaimed-but-qualified leads to claim
-- in the first place -- not added here to avoid guessing that design now.
CREATE POLICY leads_agent_claimed_own ON leads
  USING (
    current_setting('app.current_role', true) = 'agent'
    AND claimed_by_agent_id::text = current_setting('app.current_user_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON leads TO app_user;
