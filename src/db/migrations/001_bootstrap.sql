-- 001_bootstrap.sql
-- Extensions and shared enum types used across the schema.
--
-- NOTE ON ROLES: this migration deliberately does NOT create the app_user
-- login role. Postgres roles are cluster-wide, not per-database, and
-- CREATE ROLE requires a real password from the deployment's secrets
-- store -- that's a one-time manual provisioning step (see README/runbook),
-- not something to commit into a versioned SQL file. Run once per
-- environment, before the first `npm run migrate`:
--
--   CREATE ROLE app_user LOGIN PASSWORD '<from secrets store>' NOBYPASSRLS;
--   GRANT CONNECT ON DATABASE <dbname> TO app_user;
--
-- Migrations themselves must run as a different (owning) role so that RLS
-- policies are enforced against app_user -- Postgres does not apply RLS to
-- a table's owner by default.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'agent');
CREATE TYPE property_status AS ENUM ('available', 'reserved', 'sold', 'off_market');
CREATE TYPE booking_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE lead_qualification_status AS ENUM ('new', 'qualifying', 'qualified', 'unqualified', 'converted', 'lost');
CREATE TYPE lead_segment AS ENUM ('domestic', 'diaspora');
CREATE TYPE ad_platform AS ENUM ('meta', 'google', 'tiktok');
CREATE TYPE secret_status AS ENUM ('active', 'expired', 'revoked');
