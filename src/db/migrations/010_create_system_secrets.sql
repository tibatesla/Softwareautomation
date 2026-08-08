-- 010_create_system_secrets.sql
--
-- secret_value is plaintext `text` at the column level; the MSA requires
-- PII/secrets encrypted at rest, which on a self-hosted VPS is expected to
-- be satisfied at the disk/volume-encryption layer (LUKS or equivalent)
-- during provisioning, not per-column app-level encryption. Flagging here
-- so it isn't forgotten when the ad engine phase starts writing real
-- Meta/Google/TikTok tokens into this table.

CREATE TABLE system_secrets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name        text NOT NULL UNIQUE, -- e.g. 'META_MARKETING_API_TOKEN'
  secret_value    text NOT NULL,
  provider        text NOT NULL,        -- 'meta' | 'google' | 'tiktok'
  status          secret_status NOT NULL DEFAULT 'active',
  expires_at      timestamptz,
  last_rotated_at timestamptz NOT NULL DEFAULT now(),
  rotated_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Fail-closed lookup: only rows that are active are ever selected by the
-- future token resolver -- it must never silently fall back to a stale env
-- var (this repo has a documented history of exactly that bug).
CREATE INDEX idx_secrets_provider_status ON system_secrets (provider, status)
  WHERE status = 'active';

ALTER TABLE system_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_secrets FORCE ROW LEVEL SECURITY;

CREATE POLICY secrets_owner_only ON system_secrets
  USING (current_setting('app.current_role', true) = 'owner');

GRANT SELECT, INSERT, UPDATE ON system_secrets TO app_user;
