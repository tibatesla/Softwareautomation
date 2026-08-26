-- 034_lead_reads_delete.sql
--
-- Deleting a lead (deleteLeadCore) must clear every user's read-marker for
-- it first, or the lead_reads_lead_id_fkey FK blocks the delete outright --
-- this is exactly what was silently breaking deletion of any lead someone
-- had actually opened (the "not deletable" bug report). Two gaps needed
-- fixing: migration 030 never granted DELETE on lead_reads at all, and its
-- only policy (lead_reads_own) is scoped to the caller's own rows, which
-- isn't enough here -- a lead can have read-markers from several different
-- users, and deleting the lead needs to clear all of them regardless of
-- who owns each marker. Same bare-system-policy pattern as
-- bookings_system_all (033): deleteLeadCore's cascade now runs this one
-- step under withSystemContext() instead of the caller's own RLS context.

CREATE POLICY lead_reads_system_all ON lead_reads
  USING (current_setting('app.current_role', true) = 'system');

GRANT DELETE ON lead_reads TO app_user;
