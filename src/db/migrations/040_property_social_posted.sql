-- 040_property_social_posted.sql
--
-- Backs the new "auto-post a new listing to Facebook/Instagram" feature.
-- Fires once, the moment a property gets its first photo (see
-- uploadPropertyMediaFile in property.controller.ts -- photos are added in
-- a separate step after the property itself is created, so "on create"
-- would fire before there's anything to post). This column is set the
-- moment that attempt is made, success or failure, so a property is never
-- auto-posted twice as more photos get added later.

ALTER TABLE properties ADD COLUMN social_posted_at timestamptz;
