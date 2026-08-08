-- 018_lead_messages.sql
--
-- Module 3's acceptance criteria requires WhatsApp message history to be
-- "stored and viewable against the lead record" -- until now only the
-- qualification bot's derived field values (fullName, budgetRange, etc.)
-- were persisted, not the actual conversation transcript. This table adds
-- that transcript.
--
-- Writer is always the WhatsApp webhook handler running under
-- withSystemContext() (no logged-in user), same situation as leads_system_all
-- in 014_whatsapp_intake_support.sql -- mirrors that same policy shape.
-- Readers are scoped exactly like leads itself: owner/admin see everything,
-- an agent only sees messages for leads they've claimed (via an EXISTS
-- join back to leads, since claim ownership lives there, not here).

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE lead_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES leads(id),
  direction           message_direction NOT NULL,
  body                text NOT NULL,
  whatsapp_message_id text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_messages_lead_created ON lead_messages (lead_id, created_at);

ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY lead_messages_system_all ON lead_messages
  USING (current_setting('app.current_role', true) = 'system');

CREATE POLICY lead_messages_owner_admin_select ON lead_messages
  FOR SELECT
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY lead_messages_agent_select_own ON lead_messages
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'agent'
    AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_messages.lead_id
        AND l.claimed_by_agent_id::text = current_setting('app.current_user_id', true)
    )
  );

GRANT SELECT, INSERT ON lead_messages TO app_user;
