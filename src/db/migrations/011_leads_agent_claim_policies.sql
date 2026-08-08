-- 011_leads_agent_claim_policies.sql
--
-- Fills the gap flagged in 004_create_leads.sql: leads_agent_claimed_own
-- only lets an agent see leads they've ALREADY claimed. Two more policies
-- are needed for the actual claim flow:
--
-- 1. A SELECT policy so agents can browse the unclaimed-qualified queue
--    (the "leads inbox" to claim from) -- otherwise it's invisible to them.
-- 2. A dedicated UPDATE policy for the claim transition itself. This can't
--    reuse leads_agent_claimed_own: RLS evaluates USING against the
--    pre-update row, and at the moment of claiming, claimed_by_agent_id is
--    still NULL (not yet the agent's id), so that policy's USING clause
--    would always be false and block every claim. This policy instead
--    permits UPDATE when the pre-image is unclaimed-and-qualified, with a
--    separate WITH CHECK constraining the post-image to "now claimed by
--    exactly the calling agent" -- nothing broader than that transition.

CREATE POLICY leads_agent_unclaimed_qualified_select ON leads
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'agent'
    AND qualification_status = 'qualified'
    AND claimed_by_agent_id IS NULL
  );

CREATE POLICY leads_agent_claim ON leads
  FOR UPDATE
  USING (
    current_setting('app.current_role', true) = 'agent'
    AND qualification_status = 'qualified'
    AND claimed_by_agent_id IS NULL
  )
  WITH CHECK (
    claimed_by_agent_id::text = current_setting('app.current_user_id', true)
  );
