-- 031_bookings_delete_grant.sql
--
-- Bookings could be created and edited but never deleted -- no DELETE
-- grant existed. Adding it for genuinely-unused bookings (mistaken
-- entries, duplicates, cancelled test visits): both existing RLS policies
-- (bookings_owner_admin_all, bookings_agent_own) were created with a bare
-- USING clause and no FOR clause, same as create/update today, so this
-- GRANT alone extends the exact same access shape already in place --
-- Owner/Admin can delete any booking, an Agent can delete only their own.
-- Nothing else references a booking as a foreign key, so unlike
-- deleteProperty/deleteLead there's no linked-record check needed.

GRANT DELETE ON bookings TO app_user;
