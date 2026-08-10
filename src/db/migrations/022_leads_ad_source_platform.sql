-- 022_leads_ad_source_platform.sql
--
-- Extends the Meta-only ad attribution (021) to Google and TikTok. Unlike
-- Meta, neither platform's ads can embed attribution into the WhatsApp
-- webhook itself -- WhatsApp is a Meta product, so Meta's referral object
-- only ever gets populated for clicks Meta's own ad system recognizes.
-- Google/TikTok ads that click straight to WhatsApp are indistinguishable
-- from an organic message at the webhook level.
--
-- Fix: those ads' destination becomes a wa.me link with a reference code
-- baked into the pre-filled message text (e.g. "...(ref: GOOGLE-8821172)"),
-- parsed back out of the first inbound message (see
-- parseAdReferenceCode in whatsapp.schema.ts). ad_source_id alone is no
-- longer enough to know which platform's ad_performance_logs to attribute
-- against, since Google and TikTok ad IDs aren't guaranteed distinct from
-- each other -- hence a separate platform column rather than assuming.

ALTER TABLE leads ADD COLUMN ad_source_platform ad_platform;
