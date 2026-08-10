-- 021_leads_ad_source_id.sql
--
-- Closes the qualified_leads/CPQL gap: ad_performance_logs.qualified_leads
-- was never being written to because nothing captured which specific ad
-- (not just which click) a lead came from. Meta's WhatsApp webhook
-- referral object includes source_id (the ad's ID) alongside ctwa_clid
-- whenever source_type is 'ad' -- ctwa_clid alone only identifies the
-- click, not the ad_performance_logs row (keyed on platform/campaign/ad/
-- window) that a qualified lead should be counted against. Capturing
-- source_id at first contact lets qualification time look that row up
-- directly (see ad-attribution.service.ts) with no extra Meta API call.

ALTER TABLE leads ADD COLUMN ad_source_id text;
