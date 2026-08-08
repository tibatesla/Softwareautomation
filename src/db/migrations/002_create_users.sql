-- 002_create_users.sql

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  full_name      text NOT NULL,
  role           user_role NOT NULL DEFAULT 'agent',
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users (role);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Owner/Admin manage all users; an Agent can only read their own row.
-- (No FOR clause => applies to ALL commands; Postgres reuses USING as
-- WITH CHECK by default when WITH CHECK is omitted on an ALL policy.)
CREATE POLICY users_owner_admin_all ON users
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

CREATE POLICY users_self_select ON users
  FOR SELECT
  USING (id::text = current_setting('app.current_user_id', true));

-- The login flow runs before any user/role identity is known -- it IS the
-- process that establishes identity -- so it can't satisfy either policy
-- above. This narrow policy grants exactly that one pre-auth lookup, gated
-- behind an explicit 'system' role marker the app only sets inside
-- withSystemContext() (see src/config/database.ts), never from user input.
CREATE POLICY users_system_auth ON users
  USING (current_setting('app.current_role', true) = 'system');

GRANT SELECT, INSERT, UPDATE ON users TO app_user;
