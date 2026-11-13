BEGIN;

ALTER TABLE learning.instructor
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(30);

ALTER TABLE learning.student
    ADD COLUMN IF NOT EXISTS referred_by_instructor_id BIGINT,
    ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

ALTER TABLE learning.enrollment
    ADD COLUMN IF NOT EXISTS referred_by_instructor_id BIGINT,
    ADD COLUMN IF NOT EXISTS referral_code_snapshot VARCHAR(30),
    ADD COLUMN IF NOT EXISTS referral_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS referral_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE learning.instructor i
SET referral_code = 'INS' || (i.id + 1000)::text
FROM olp_auth."user" u
WHERE u.id = i.user_id
  AND u.approval_status = 'APPROVED'
  AND u.is_active = TRUE
  AND u.soft_delete = FALSE
  AND i.is_active = TRUE
  AND i.soft_delete = FALSE
  AND i.referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_learning_instructor_referral_code
    ON learning.instructor (LOWER(referral_code))
    WHERE referral_code IS NOT NULL;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_student_referred_by_instructor'
          AND conrelid = 'learning.student'::regclass
    ) THEN
        ALTER TABLE learning.student
            ADD CONSTRAINT fk_student_referred_by_instructor
            FOREIGN KEY (referred_by_instructor_id)
            REFERENCES learning.instructor(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_enrollment_referred_by_instructor'
          AND conrelid = 'learning.enrollment'::regclass
    ) THEN
        ALTER TABLE learning.enrollment
            ADD CONSTRAINT fk_enrollment_referred_by_instructor
            FOREIGN KEY (referred_by_instructor_id)
            REFERENCES learning.instructor(id)
            ON DELETE RESTRICT;
    END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS idx_learning_student_referred_by
    ON learning.student (referred_by_instructor_id)
    WHERE referred_by_instructor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_enrollment_referred_by
    ON learning.enrollment (referred_by_instructor_id, enrollment_date)
    WHERE referred_by_instructor_id IS NOT NULL;

-- Referral incentives are now stored once per paid enrollment. Keep the
-- course earning student count constraint compatible with the current schema.
ALTER TABLE payroll.instructor_course_earning
    DROP CONSTRAINT IF EXISTS chk_ice_completed_students,
    DROP CONSTRAINT IF EXISTS chk_ice_student_count;

ALTER TABLE payroll.instructor_course_earning
    DROP COLUMN IF EXISTS completed_student_count;

ALTER TABLE payroll.instructor_course_earning
    ADD CONSTRAINT chk_ice_student_count CHECK (eligible_student_count >= 0);

ALTER TABLE payroll.instructor_course_compensation
    ADD COLUMN IF NOT EXISTS referral_incentive_per_enrollment NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMIT;
