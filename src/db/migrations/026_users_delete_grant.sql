-- 026_users_delete_grant.sql
--
-- Users could only ever be deactivated (is_active=false), never deleted --
-- there was no DELETE grant at all, and no delete endpoint. Adding a real
-- delete for genuinely-unused accounts (e.g. a mistaken invite, a test
-- account) -- the controller checks for linked leads/properties/payments/
-- bookings/penalties/secrets first and refuses with a clear message if any
-- exist, since those all have NoAction (restrict) foreign keys anyway and
-- would fail this DELETE regardless; deactivation remains the right move
-- for any account with real history.

GRANT DELETE ON users TO app_user;
