-- 041_bookings_property_nullable.sql
--
-- Supports a "general consultation" booking not tied to any specific
-- listing -- the WhatsApp qualification bot's self-booking flow previously
-- required a property to have been auto-matched from the lead's opening
-- message before offering slots/the booking link at all, but most real
-- opening messages are generic greetings that never name a listing, so
-- almost nobody ever saw the offer. Now the bot offers a slot regardless;
-- if no property was matched, the resulting booking simply has no
-- property_id. CRM-created bookings (booking.schema.ts) still require a
-- property -- this only relaxes the database constraint, not that route's
-- own validation.

ALTER TABLE bookings ALTER COLUMN property_id DROP NOT NULL;
