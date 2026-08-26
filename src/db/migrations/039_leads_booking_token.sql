-- 039_leads_booking_token.sql
--
-- Backs the new "book on the web instead of tapping in WhatsApp" link,
-- sent alongside (never instead of) the existing native slot-list buttons.
-- An opaque unguessable token, not the lead's own uuid -- lead ids are
-- otherwise never exposed to an unauthenticated caller, and this is the
-- one surface that has to be (a public booking page reachable by anyone
-- with the link, no login). Cleared back to null once the booking is made
-- or a fresh slot offer replaces it, so a used or stale link stops working.

ALTER TABLE leads ADD COLUMN booking_token text;

CREATE UNIQUE INDEX idx_leads_booking_token ON leads (booking_token) WHERE booking_token IS NOT NULL;
