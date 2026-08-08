-- 006_create_bookings.sql

CREATE TABLE bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES properties(id),
  lead_id       uuid REFERENCES leads(id),
  agent_id      uuid NOT NULL REFERENCES users(id),
  scheduled_at  timestamptz NOT NULL,
  status        booking_status NOT NULL DEFAULT 'scheduled',
  is_virtual    boolean NOT NULL DEFAULT false, -- diaspora proxy-visit/virtual-tour path
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_agent_schedule ON bookings (agent_id, scheduled_at);
CREATE INDEX idx_bookings_property ON bookings (property_id);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

CREATE POLICY bookings_owner_admin_all ON bookings
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY bookings_agent_own ON bookings
  USING (
    current_setting('app.current_role', true) = 'agent'
    AND agent_id::text = current_setting('app.current_user_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON bookings TO app_user;
