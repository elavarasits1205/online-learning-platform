-- Student course reviews and ratings.
CREATE TABLE IF NOT EXISTS learning.course_review (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL
        REFERENCES learning.course(id) ON DELETE CASCADE,
    student_user_id BIGINT NOT NULL
        REFERENCES olp_auth."user"(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_course_review_student UNIQUE (course_id, student_user_id),
    CONSTRAINT chk_course_review_length CHECK (char_length(review_text) <= 3000)
);

CREATE INDEX IF NOT EXISTS idx_course_review_course_created
    ON learning.course_review (course_id, created_at DESC)
    WHERE soft_delete = FALSE;
