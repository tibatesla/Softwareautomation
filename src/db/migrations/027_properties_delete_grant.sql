-- 027_properties_delete_grant.sql
--
-- Properties could be created and edited but never deleted -- no DELETE
-- grant existed. Adding it for genuinely-unused listings (e.g. a duplicate,
-- a mistaken entry): the controller checks for linked leads/bookings/
-- payments first and refuses with a clear message if any exist, since
-- those all have NoAction (restrict) foreign keys anyway and would fail
-- this DELETE regardless.

GRANT DELETE ON properties TO app_user;
