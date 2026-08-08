-- 015_leads_ctwa_clid.sql
--
-- Module 4's Meta Conversions API dispatch needs the Click-to-WhatsApp
-- click ID to attribute a qualified lead back to the ad that generated it
-- (action_source: 'business_messaging', user_data.ctwa_clid). This is
-- distinct from the generic fbclid column added in 004_create_leads.sql
-- (that one models website-Pixel-style attribution; ctwa_clid is WhatsApp
-- Business Messaging-specific, per Meta's documented CAPI payload shape).

ALTER TABLE leads ADD COLUMN ctwa_clid text;
