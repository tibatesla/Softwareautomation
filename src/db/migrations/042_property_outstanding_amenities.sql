-- 042_property_outstanding_amenities.sql
--
-- Backs the client's "highlight key amenities with an Outstanding label"
-- request. A subset of `amenities`, not a new source of truth -- an entry
-- here is only ever meaningful if it's also present in `amenities`, and the
-- API reconciles that whenever both fields are sent in the same request
-- (see property.controller.ts). Kept as its own text[] column (same shape
-- as `amenities`) rather than restructuring `amenities` into objects, so
-- every existing consumer of the plain string array -- the CRM form, the
-- public site's amenity pills, the social-post caption builder -- keeps
-- working unchanged.

ALTER TABLE properties ADD COLUMN outstanding_amenities text[] NOT NULL DEFAULT '{}';
