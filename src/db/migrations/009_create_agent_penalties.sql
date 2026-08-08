-- 009_create_agent_penalties.sql

CREATE TABLE agent_penalties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES users(id),
  lead_id       uuid REFERENCES leads(id),
  penalty_type  text NOT NULL, -- e.g. 'sla_miss'
  minutes_late  integer,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_penalties_agent ON agent_penalties (agent_id);
CREATE INDEX idx_penalties_lead ON agent_penalties (lead_id);

ALTER TABLE agent_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_penalties FORCE ROW LEVEL SECURITY;

CREATE POLICY penalties_owner_admin_all ON agent_penalties
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY penalties_agent_self_read ON agent_penalties
  FOR SELECT
  USING (agent_id::text = current_setting('app.current_user_id', true));

GRANT SELECT, INSERT ON agent_penalties TO app_user;
