-- 028_leads_delete_grant.sql
--
-- Leads could be created and edited but never deleted -- no DELETE grant
-- existed. Adding it for genuinely-unused leads (test entries, duplicates,
-- spam that made it through WhatsApp intake): the controller blocks
-- deletion if the lead has real bookings or payments (those must be
-- preserved), but a lead's own WhatsApp conversation history isn't a
-- separate business record -- it's deleted alongside the lead. Agent
-- penalty rows referencing the lead are kept for the agent's own
-- accountability history but have their lead_id cleared rather than being
-- deleted or blocking the lead delete.

GRANT DELETE ON leads TO app_user;

GRANT DELETE ON lead_messages TO app_user;

CREATE POLICY lead_messages_owner_admin_delete ON lead_messages
  FOR DELETE
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

GRANT UPDATE ON agent_penalties TO app_user;
