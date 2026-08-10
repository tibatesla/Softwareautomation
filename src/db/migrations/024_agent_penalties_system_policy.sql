-- 024_agent_penalties_system_policy.sql
--
-- agent_penalties (009) only ever had owner/admin and agent-self-read
-- policies -- nothing wrote to this table before, so the missing system
-- role policy was invisible until the agent SLA engine (023) tried to
-- INSERT a penalty via withSystemContext and got rejected by RLS
-- (FORCE ROW LEVEL SECURITY applies even to the table owner). Mirrors the
-- users_system_auth policy pattern from 002_create_users.sql.

CREATE POLICY penalties_system_all ON agent_penalties
  USING (current_setting('app.current_role', true) = 'system');
