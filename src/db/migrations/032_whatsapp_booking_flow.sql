-- 032_whatsapp_booking_flow.sql
--
-- Supports the new branching WhatsApp qualification script (visit
-- preference decides which second question gets asked) and native
-- in-chat booking (the client can pick a viewing time directly in
-- WhatsApp, which creates a real bookings row, instead of linking out to
-- an external calendar tool).
--
-- visit_preference: 'in_person' | 'virtual', free string like
-- investment_type/transaction_type already are -- not worth a Postgres
-- enum for a two-value field captured only by this one bot flow.
--
-- awaiting_booking_reply: true for the single turn between the bot asking
-- "what date/time works for you" and the client's reply -- lets the state
-- machine know the NEXT inbound message should be parsed as a scheduling
-- answer instead of routed through the normal qualification/fallback path.

ALTER TABLE leads ADD COLUMN visit_preference text;
ALTER TABLE leads ADD COLUMN awaiting_booking_reply boolean NOT NULL DEFAULT false;
