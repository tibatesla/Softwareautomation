-- 037_property_development_grouping.sql
--
-- CRM-only display grouping: many properties are really unit-type variants
-- of the same development (e.g. "Steller Bay Residence- 1 Bedroom" and
-- "Steller Bay- 2 Bedroom Duplex" are both Steller Bay). This is a plain
-- text field, not a parent-child FK to a separate table -- editing one
-- unit doesn't affect its siblings, it's purely a label the CRM properties
-- page groups rows by into collapsible sections. Deliberately not exposed
-- on the public website's property select at all, so this can never affect
-- what a visitor sees.

ALTER TABLE properties ADD COLUMN development_name text;

CREATE INDEX idx_properties_development_name ON properties (development_name) WHERE development_name IS NOT NULL;
