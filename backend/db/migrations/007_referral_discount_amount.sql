BEGIN;

-- Referral Master now configures a fixed student discount amount instead of a
-- percentage. Keep the legacy percentage column for compatibility, but stop it
-- from overriding the configured amount.
UPDATE payroll.referral_settings
SET student_discount_percentage = 0,
    updated_at = NOW()
WHERE student_discount_percentage <> 0;

ALTER TABLE payroll.referral_settings
    ALTER COLUMN student_discount_amount SET DEFAULT 0;

COMMIT;
