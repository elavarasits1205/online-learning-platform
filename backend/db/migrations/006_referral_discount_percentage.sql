BEGIN;

ALTER TABLE payroll.referral_settings
    ADD COLUMN IF NOT EXISTS student_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_referral_settings_student_discount_percentage'
          AND conrelid = 'payroll.referral_settings'::regclass
    ) THEN
        ALTER TABLE payroll.referral_settings
            ADD CONSTRAINT chk_referral_settings_student_discount_percentage
            CHECK (
                student_discount_percentage >= 0
                AND student_discount_percentage <= 100
            );
    END IF;
END;
$migration$;

-- Activate the default 10% student referral discount for existing currency
-- settings. Administrators can change this from the Referral Master page.
UPDATE payroll.referral_settings
SET student_discount_percentage = 10,
    updated_at = NOW()
WHERE student_discount_percentage = 0
  AND student_discount_amount = 0;

COMMIT;
