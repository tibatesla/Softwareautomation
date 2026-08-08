-- 020_lead_messages_sender_type.sql
--
-- Distinguishes bot-sent from human-sent outbound messages, so the
-- qualification bot can decide whether to keep auto-replying after a
-- lead is fully qualified: it should fill the gap while no consultant
-- has responded yet, but back off entirely once a human has sent even
-- one reply -- never talk over an agent who has taken over the thread.
-- NULL for inbound rows (the concept doesn't apply -- those are always
-- from the lead, not "sent" by us).

CREATE TYPE message_sender_type AS ENUM ('bot', 'human');

ALTER TABLE lead_messages ADD COLUMN sender_type message_sender_type;

-- Backfill: historical outbound rows predate this column; the app sets
-- it explicitly on every insert going forward. Defaulting existing rows
-- to 'bot' is a safe historical assumption (the handful that were
-- actually manual test sends via curl have no real consequence either way).
UPDATE lead_messages SET sender_type = 'bot' WHERE direction = 'outbound';

ALTER TABLE lead_messages ADD CONSTRAINT lead_messages_sender_type_consistency CHECK (
  (direction = 'inbound' AND sender_type IS NULL) OR
  (direction = 'outbound' AND sender_type IS NOT NULL)
);
