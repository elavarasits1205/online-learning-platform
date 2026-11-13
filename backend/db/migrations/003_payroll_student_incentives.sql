BEGIN;

ALTER TABLE payroll.instructor_payroll
    ADD COLUMN IF NOT EXISTS incentive_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS incentive_notes TEXT;

UPDATE payroll.instructor_payroll
SET incentive_amount = 0
WHERE incentive_amount IS NULL;

ALTER TABLE payroll.instructor_payroll
    ALTER COLUMN incentive_amount SET DEFAULT 0,
    ALTER COLUMN incentive_amount SET NOT NULL;

-- Replace any older net-pay check so the generated student incentive is
-- accounted for separately from fixed and commission course earnings.
DO $migration$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'payroll.instructor_payroll'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%net_amount%'
    LOOP
        EXECUTE format(
            'ALTER TABLE payroll.instructor_payroll DROP CONSTRAINT %I',
            constraint_row.conname
        );
    END LOOP;
END;
$migration$;

ALTER TABLE payroll.instructor_payroll
    DROP CONSTRAINT IF EXISTS instructor_payroll_incentive_amount_nonnegative,
    DROP CONSTRAINT IF EXISTS instructor_payroll_total_earnings_nonnegative,
    DROP CONSTRAINT IF EXISTS instructor_payroll_total_deductions_nonnegative,
    DROP CONSTRAINT IF EXISTS instructor_payroll_net_amount_nonnegative,
    DROP CONSTRAINT IF EXISTS instructor_payroll_net_amount_matches_components;

ALTER TABLE payroll.instructor_payroll
    ADD CONSTRAINT instructor_payroll_incentive_amount_nonnegative
        CHECK (incentive_amount >= 0),
    ADD CONSTRAINT instructor_payroll_total_earnings_nonnegative
        CHECK (total_earnings >= 0),
    ADD CONSTRAINT instructor_payroll_total_deductions_nonnegative
        CHECK (total_deductions >= 0),
    ADD CONSTRAINT instructor_payroll_net_amount_nonnegative
        CHECK (net_amount >= 0),
    ADD CONSTRAINT instructor_payroll_net_amount_matches_components
        CHECK (
            net_amount = total_earnings + incentive_amount - total_deductions
        );

COMMENT ON COLUMN payroll.instructor_payroll.incentive_amount IS
    'Automatically calculated from eligible paid enrollments and course completions using compensation rules.';

COMMENT ON COLUMN payroll.instructor_payroll.incentive_notes IS
    'System-generated breakdown of student activity used to calculate incentive_amount.';

COMMIT;
