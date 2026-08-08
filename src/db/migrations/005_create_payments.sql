-- 005_create_payments.sql
-- Record-keeping ledger only -- no payment gateway integration, no funds
-- move through this table.

CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid NOT NULL REFERENCES properties(id),
  lead_id         uuid REFERENCES leads(id),
  amount          numeric(14,2) NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'KES',
  payment_method  text,
  payment_date    date NOT NULL DEFAULT current_date,
  recorded_by     uuid NOT NULL REFERENCES users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_property ON payments (property_id);
CREATE INDEX idx_payments_lead ON payments (lead_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY payments_owner_admin_all ON payments
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY payments_agent_own_property ON payments
  USING (
    current_setting('app.current_role', true) = 'agent'
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = payments.property_id
        AND p.assigned_agent_id::text = current_setting('app.current_user_id', true)
    )
  );

GRANT SELECT, INSERT ON payments TO app_user;
