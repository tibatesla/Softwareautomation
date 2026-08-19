-- 029_payments_delete_grant.sql
--
-- Payments were append-only by design (no DELETE route existed at all).
-- The client now wants a narrow exception, same shape as the existing
-- Owner-only UPDATE added in 017: the Owner (not Admin, not Agent) can
-- remove a payment record entirely. Nothing else references payments as a
-- foreign key, so there's no linked-record check needed -- unlike
-- properties/leads, a payment is always a leaf row.

CREATE POLICY payments_owner_delete ON payments
  FOR DELETE
  USING (current_setting('app.current_role', true) = 'owner');

GRANT DELETE ON payments TO app_user;
