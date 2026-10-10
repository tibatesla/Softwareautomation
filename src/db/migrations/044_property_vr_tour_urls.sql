-- 044_property_vr_tour_urls.sql
--
-- Backs the client's "add VR links for virtual tour rendering" request --
-- links to externally-hosted 360/VR walkthroughs (e.g. vr.justeasy.cn),
-- not files Chestone uploads itself, so unlike `images`/`videos` this
-- array is never written to or cleaned up via Cloudinary. Plain text[]
-- (same shape as `videos`) since a listing can reasonably have more than
-- one tour -- separate unit types, or a 360 panorama plus a walkthrough.

ALTER TABLE properties ADD COLUMN vr_tour_urls text[] NOT NULL DEFAULT '{}';
