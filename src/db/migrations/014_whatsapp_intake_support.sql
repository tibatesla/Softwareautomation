-- 014_whatsapp_intake_support.sql
--
-- Support for Module 3 (WhatsApp lead capture). Two things:
--
-- 1. property_interest_raw: the WhatsApp qualification bot asks "which
--    property are you interested in?" as a free-text question (Flaresend
--    does not support interactive button/list messages, so this can't be
--    a clean select-from-list). The raw answer is kept even when it can't
--    be confidently matched to an existing properties.id, so the answer
--    isn't silently lost.
--
-- 2. 'system' RLS policies on leads and properties, mirroring
--    users_system_auth (002_create_users.sql): the WhatsApp webhook has no
--    logged-in user, so it runs under withSystemContext(). Without an
--    explicit policy, RLS would block it from creating/updating leads or
--    reading properties at all.

ALTER TABLE leads ADD COLUMN property_interest_raw text;

CREATE POLICY leads_system_all ON leads
  USING (current_setting('app.current_role', true) = 'system');

CREATE POLICY properties_system_read ON properties
  FOR SELECT
  USING (current_setting('app.current_role', true) = 'system');
