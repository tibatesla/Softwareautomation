-- 019_lead_messages_human_send.sql
--
-- Lets a human (Agent who claimed the lead, or Owner/Admin) send a WhatsApp
-- reply from within the CRM, not just view the bot-driven transcript.
-- lead_messages currently only has an INSERT path for the 'system' role
-- (the webhook/bot, via withSystemContext) -- these add the authenticated,
-- per-user INSERT path used by the new send-message endpoint (withRLSContext).
--
-- Mirrors the exact same claim-ownership check leads_agent_claim (011) uses
-- for the claim transition itself: an agent may only act on a lead where
-- claimed_by_agent_id is already them.

CREATE POLICY lead_messages_owner_admin_insert ON lead_messages
  FOR INSERT
  WITH CHECK (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY lead_messages_agent_insert_own ON lead_messages
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'agent'
    AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_messages.lead_id
        AND l.claimed_by_agent_id::text = current_setting('app.current_user_id', true)
    )
  );
