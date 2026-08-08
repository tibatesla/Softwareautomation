-- 017_payment_owner_update.sql
-- Payments were append-only by design (no UPDATE route existed at all).
-- The client now wants a narrow exception: the Owner (not Admin, not Agent)
-- can correct typos in an existing payment record.
--
-- The existing payments_owner_admin_all / payments_agent_own_property
-- policies were both created with a bare USING clause and no FOR clause,
-- which makes them apply to ALL commands (SELECT/INSERT/UPDATE/DELETE), not
-- just the SELECT/INSERT they were actually granted for. If UPDATE were
-- simply GRANTed to app_user without first splitting these, the existing
-- payments_owner_admin_all policy would silently let Admin update payments
-- too (permissive policies are OR'd together), defeating the "Owner only"
-- requirement. So both existing policies are replaced with explicit
-- per-command versions first, then a new Owner-only UPDATE policy is added.

DROP POLICY payments_owner_admin_all ON payments;
DROP POLICY payments_agent_own_property ON payments;

CREATE POLICY payments_owner_admin_select ON payments
  FOR SELECT USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY payments_owner_admin_insert ON payments
  FOR INSERT WITH CHECK (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY payments_agent_select_own ON payments
  FOR SELECT USING (
    current_setting('app.current_role', true) = 'agent'
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = payments.property_id
        AND p.assigned_agent_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY payments_agent_insert_own ON payments
  FOR INSERT WITH CHECK (
    current_setting('app.current_role', true) = 'agent'
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = payments.property_id
        AND p.assigned_agent_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY payments_owner_update ON payments
  FOR UPDATE
  USING (current_setting('app.current_role', true) = 'owner')
  WITH CHECK (current_setting('app.current_role', true) = 'owner');

GRANT UPDATE ON payments TO app_user;
