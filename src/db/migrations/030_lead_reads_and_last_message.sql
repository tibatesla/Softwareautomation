-- 030_lead_reads_and_last_message.sql
--
-- Supports two CRM Handoff asks: (1) sort the leads list by most recent
-- conversation activity instead of creation date, (2) track per-user
-- read/unread state per lead so staff can see which conversations have
-- new activity they haven't personally reviewed -- deliberately NOT
-- advanced by the WhatsApp bot's automated replies, only by a human
-- actually opening the conversation, since the whole point is surfacing
-- leads nobody on the team has actually looked at yet.

-- Denormalized "most recent message" timestamp on the lead itself, kept in
-- sync by the app on every message write (both directions) -- cheaper to
-- read for every list-page load than aggregating lead_messages each time.
ALTER TABLE leads ADD COLUMN last_message_at timestamptz;

UPDATE leads l SET last_message_at = (
  SELECT max(created_at) FROM lead_messages lm WHERE lm.lead_id = l.id
);

CREATE INDEX idx_leads_last_message_at ON leads (last_message_at DESC NULLS LAST);

-- Per (user, lead) read marker. A lead with no row here, or with
-- last_read_at older than the lead's most recent inbound message, has
-- unread activity for that user. Every authenticated user (any role) can
-- read/write only their own marker rows -- this isn't a role-gated
-- feature, it's personal read state.
CREATE TABLE lead_reads (
  user_id      uuid NOT NULL REFERENCES users(id),
  lead_id      uuid NOT NULL REFERENCES leads(id),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lead_id)
);

ALTER TABLE lead_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_reads FORCE ROW LEVEL SECURITY;

CREATE POLICY lead_reads_own ON lead_reads
  USING (user_id::text = current_setting('app.current_user_id', true));

GRANT SELECT, INSERT, UPDATE ON lead_reads TO app_user;
