-- 003_create_properties.sql

CREATE TABLE properties (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL,
  description        text,
  location           text,
  price              numeric(14,2) NOT NULL DEFAULT 0,
  currency           char(3) NOT NULL DEFAULT 'KES',
  status             property_status NOT NULL DEFAULT 'available',
  assigned_agent_id  uuid REFERENCES users(id),
  created_by         uuid REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_status ON properties (status);
CREATE INDEX idx_properties_assigned_agent ON properties (assigned_agent_id);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE ROW LEVEL SECURITY;

CREATE POLICY properties_owner_admin_all ON properties
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY properties_agent_own ON properties
  USING (
    current_setting('app.current_role', true) = 'agent'
    AND assigned_agent_id::text = current_setting('app.current_user_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON properties TO app_user;
