-- 033_bookings_system_policy.sql
--
-- The WhatsApp bot can now create a booking directly (self-service
-- scheduling in migration 032), which runs under withSystemContext() like
-- the rest of the WhatsApp intake path -- but bookings had no 'system'
-- RLS policy at all (unlike leads/properties, see
-- 014_whatsapp_intake_support.sql), so the INSERT was silently blocked by
-- RLS despite app_user already having the INSERT grant. Same pattern as
-- leads_system_all: a bare policy (no FOR clause) so it covers every
-- command the bot might eventually need here, not just INSERT.

CREATE POLICY bookings_system_all ON bookings
  USING (current_setting('app.current_role', true) = 'system');
