-- 038_leads_proxy_visit_nullable.sql
--
-- The new WhatsApp flow (client's revised script) asks capital-readiness /
-- timeline as tap buttons, then keeps a separate free-text follow-up
-- question for the virtual-tour branch's proxy-visit check -- the bot
-- needs to distinguish "not asked yet" from "asked, answered no", which a
-- non-nullable boolean defaulting to false can't do. Existing rows (all
-- currently false, from before this column was ever asked about) are left
-- as false rather than backfilled to null -- they were never actually
-- asked either way under the old script, but reopening that question for
-- already-qualified leads isn't worth the churn.

ALTER TABLE leads ALTER COLUMN requires_proxy_visit DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN requires_proxy_visit DROP DEFAULT;
