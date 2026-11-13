-- Coupon / payment fixes
-- 1) Add is_active to the coupon mapping and redemption tables.
-- 2) Turn coupon_redemption into an append-only event ledger (no one-row-per-payment limit).

ALTER TABLE payment.coupon_student
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT TRUE;

ALTER TABLE payment.coupon_redemption
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT TRUE;

ALTER TABLE payment.coupon_redemption
    DROP CONSTRAINT IF EXISTS uq_coupon_redemption_payment;

DROP INDEX IF EXISTS payment.uq_coupon_redemption_payment;

CREATE INDEX IF NOT EXISTS idx_coupon_redemption_payment
    ON payment.coupon_redemption (payment_id);

CREATE INDEX IF NOT EXISTS idx_coupon_redemption_payment_event
    ON payment.coupon_redemption (payment_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_coupon_redemption_active
    ON payment.coupon_redemption (is_active);
