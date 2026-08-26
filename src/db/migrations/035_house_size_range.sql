-- 035_house_size_range.sql
--
-- house_size_sqft is a single value, but units of the same bedroom count
-- within one development commonly vary in size (e.g. a "1 Bedroom" listing
-- spanning 62-72 sqm) -- mirrors the existing price/price_min/price_max
-- pattern: house_size_sqft stays as the typical/base size, these two are
-- optional and only populated when the listing is actually a range.

ALTER TABLE properties ADD COLUMN house_size_sqft_min numeric(10, 2);
ALTER TABLE properties ADD COLUMN house_size_sqft_max numeric(10, 2);
