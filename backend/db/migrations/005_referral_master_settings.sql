BEGIN;

ALTER TABLE payment.payment
    ADD COLUMN IF NOT EXISTS referral_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coupon_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS referral_incentive_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_payment_referral_discount_amount'
          AND conrelid = 'payment.payment'::regclass
    ) THEN
        ALTER TABLE payment.payment
            ADD CONSTRAINT chk_payment_referral_discount_amount
            CHECK (referral_discount_amount >= 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_payment_coupon_discount_amount'
          AND conrelid = 'payment.payment'::regclass
    ) THEN
        ALTER TABLE payment.payment
            ADD CONSTRAINT chk_payment_coupon_discount_amount
            CHECK (coupon_discount_amount >= 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_payment_referral_incentive_amount'
          AND conrelid = 'payment.payment'::regclass
    ) THEN
        ALTER TABLE payment.payment
            ADD CONSTRAINT chk_payment_referral_incentive_amount
            CHECK (referral_incentive_amount >= 0);
    END IF;
END;
$migration$;

ALTER TABLE payroll.instructor_course_compensation
    ADD COLUMN IF NOT EXISTS referral_incentive_per_enrollment NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payroll.instructor_referral_earning (
    id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL REFERENCES learning.enrollment(id),
    payment_id BIGINT NOT NULL REFERENCES payment.payment(id),
    instructor_payroll_id BIGINT REFERENCES payroll.instructor_payroll(id),
    instructor_id BIGINT NOT NULL REFERENCES learning.instructor(id),
    student_id BIGINT NOT NULL REFERENCES learning.student(id),
    course_id BIGINT NOT NULL REFERENCES learning.course(id),
    compensation_id BIGINT REFERENCES payroll.instructor_course_compensation(id),
    referral_code_snapshot VARCHAR(30) NOT NULL,
    incentive_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (incentive_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'INCLUDED', 'PAID', 'CANCELLED')),
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ,
    updated_by BIGINT,
    soft_delete BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS payroll.referral_settings (
    currency_code VARCHAR(10) PRIMARY KEY,
    student_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    instructor_incentive_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ,
    updated_by BIGINT,
    CONSTRAINT chk_referral_settings_student_discount
        CHECK (student_discount_amount >= 0),
    CONSTRAINT chk_referral_settings_instructor_incentive
        CHECK (instructor_incentive_amount >= 0),
    CONSTRAINT chk_referral_settings_currency
        CHECK (currency_code = UPPER(BTRIM(currency_code)) AND LENGTH(currency_code) BETWEEN 3 AND 10)
);

INSERT INTO payroll.referral_settings (currency_code)
SELECT DISTINCT UPPER(BTRIM(COALESCE(currency_code, 'INR')))
FROM learning.course
WHERE BTRIM(COALESCE(currency_code, 'INR')) <> ''
ON CONFLICT (currency_code) DO NOTHING;

INSERT INTO payroll.referral_settings (currency_code)
VALUES ('INR')
ON CONFLICT (currency_code) DO NOTHING;

-- The global admin master setting is the source for referral incentives.
-- Keep the old FK for historical records while allowing new global settings
-- based records to have no course compensation row.
ALTER TABLE payroll.instructor_referral_earning
    ALTER COLUMN compensation_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ire_enrollment
    ON payroll.instructor_referral_earning (enrollment_id);

CREATE INDEX IF NOT EXISTS idx_ire_payroll_status_earned_at
    ON payroll.instructor_referral_earning (status, earned_at)
    WHERE soft_delete = FALSE;

ALTER TABLE learning.enrollment
    ADD COLUMN IF NOT EXISTS referred_by_instructor_id BIGINT,
    ADD COLUMN IF NOT EXISTS referral_code_snapshot VARCHAR(30),
    ADD COLUMN IF NOT EXISTS referral_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS referral_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_enrollment_referral_discount_amount'
          AND conrelid = 'learning.enrollment'::regclass
    ) THEN
        ALTER TABLE learning.enrollment
            ADD CONSTRAINT chk_enrollment_referral_discount_amount
            CHECK (referral_discount_amount >= 0);
    END IF;
END;
$migration$;

COMMIT;
