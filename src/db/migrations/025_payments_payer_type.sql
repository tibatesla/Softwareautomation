-- 025_payments_payer_type.sql
--
-- Payments previously had no way to distinguish "a lead paid us a deposit"
-- from "a developer paid us a commission" -- every row implicitly meant
-- the former. property_id and lead_id already let a commission payment be
-- tied to which property/deal it came from; this just labels which
-- direction the money actually came from. Defaults to 'lead' so every
-- existing row keeps its current (correct) meaning without a backfill.

CREATE TYPE payment_payer_type AS ENUM ('lead', 'developer');

ALTER TABLE payments ADD COLUMN payer_type payment_payer_type NOT NULL DEFAULT 'lead';
