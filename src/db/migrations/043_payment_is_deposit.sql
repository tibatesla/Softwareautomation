-- 043_payment_is_deposit.sql
--
-- Backs the client's "fire a Meta conversion event when the 20% deposit is
-- paid" request. Staff explicitly flag a payment as the deposit at record
-- time (see payment.controller.ts) rather than the system inferring it from
-- amount thresholds -- deposit percentages and structures vary by
-- development, so an explicit flag is the only reliable signal.

ALTER TABLE payments ADD COLUMN is_deposit boolean NOT NULL DEFAULT false;
