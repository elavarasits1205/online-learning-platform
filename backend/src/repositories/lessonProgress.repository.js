
const pool = require("../config/database");


// ============================================================
// 1. FIND ACTIVE ENROLLMENT
// ============================================================
// Purpose:
// Verify whether the student has access to the requested course.
//
// Tables:
// learning.enrollment
// learning.student
//
// ACTIVE or COMPLETED enrollment is accepted.
//
// IMPORTANT:
// enrollment table does not have is_active.
// We use soft_delete and status instead.
//
// FOR UPDATE:
// Locks the selected enrollment row during the transaction.
// This helps prevent concurrent changes to the same enrollment.

async function findActiveEnrollment(client, courseId, userId) {

    const result = await client.query(
        `SELECT e.id, c.title AS course_title
         FROM learning.enrollment e

         JOIN learning.student s
           ON s.id = e.student_id

         JOIN learning.course c
           ON c.id = e.course_id

         WHERE e.course_id = $1
           AND s.user_id = $2

           -- Student must be active and not deleted.
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE

           -- Enrollment does not have an is_active column.
           AND e.soft_delete = FALSE
           AND e.status IN ('ACTIVE', 'COMPLETED')

         LIMIT 1
         FOR UPDATE OF e`,
        [courseId, userId]
    );

    return result.rows[0] || null;
}


// ============================================================
// 2. CHECK LESSON BELONGS TO COURSE
// ============================================================
// Purpose:
// Verify that the requested lesson belongs to the selected course.
//
// Tables:
// learning.lesson
// learning.module
//
// A lesson belongs to a module.
// A module belongs to a course.
//
// This validation prevents students from submitting a lesson ID
// that belongs to a different course.
//
// Only active and non-deleted lessons/modules are accepted.

async function lessonBelongsToCourse(
    client,
    courseId,
    lessonId
) {

    const result = await client.query(
        `SELECT l.id

         FROM learning.lesson l

         JOIN learning.module m
           ON m.id = l.module_id

         WHERE l.id = $1
           AND m.course_id = $2

           -- Lesson validation.
           AND l.is_active = TRUE
           AND l.soft_delete = FALSE

           -- Module validation.
           AND m.is_active = TRUE
           AND m.soft_delete = FALSE`,
        [lessonId, courseId]
    );

    // true means the lesson belongs to this course.
    return result.rowCount > 0;
}


// ============================================================
// 3. SAVE LESSON COMPLETION
// ============================================================
// Purpose:
// Mark a lesson as completed for a particular enrollment.
//
// If a progress record already exists:
//     UPDATE the existing record.
//
// If no record exists:
//     INSERT a new progress record.
//
// We check existing records instead of depending on an
// unverified unique constraint.
//
// IMPORTANT:
// lesson_progress table has soft_delete but does NOT have
// is_active in the latest database schema.
//
// When restoring an existing soft-deleted progress record,
// soft_delete is changed back to FALSE.

async function saveLessonCompletion(
    client,
    enrollmentId,
    lessonId,
    userId
) {

    // --------------------------------------------------------
    // CHECK EXISTING LESSON PROGRESS
    // --------------------------------------------------------
    // Prefer a non-deleted record.
    // If multiple records exist, select the latest one.
    //
    // FOR UPDATE locks the selected progress row.

    const existing = await client.query(
        `SELECT id
         FROM learning.lesson_progress

         WHERE enrollment_id = $1
           AND lesson_id = $2

         ORDER BY soft_delete ASC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [enrollmentId, lessonId]
    );


    // --------------------------------------------------------
    // UPDATE EXISTING PROGRESS
    // --------------------------------------------------------
    if (existing.rows.length) {

        await client.query(
            `UPDATE learning.lesson_progress

             SET status = 'COMPLETED',
                 progress_percentage = 100,

                 -- Preserve the original start time if available.
                 first_started_at =
                    COALESCE(first_started_at, NOW()),

                 -- Update last accessed time.
                 last_accessed_at = NOW(),

                 -- Preserve original completion time if available.
                 completed_at =
                    COALESCE(completed_at, NOW()),

                 updated_at = NOW(),
                 updated_by = $2,

                 -- Restore record if it was soft-deleted.
                 soft_delete = FALSE

             WHERE id = $1`,
            [existing.rows[0].id, userId]
        );

    } else {

        // ----------------------------------------------------
        // INSERT NEW PROGRESS
        // ----------------------------------------------------
        // First time completion record does not exist.
        // Create a new record with 100% completion.

        await client.query(
            `INSERT INTO learning.lesson_progress (
                enrollment_id,
                lesson_id,
                status,
                progress_percentage,
                first_started_at,
                last_accessed_at,
                completed_at,
                created_by,
                updated_by
             )

             VALUES (
                $1,
                $2,
                'COMPLETED',
                100,
                NOW(),
                NOW(),
                NOW(),
                $3,
                $3
             )`,
            [enrollmentId, lessonId, userId]
        );
    }
}

// Save monotonically increasing playback progress without marking a lesson
// complete. Completion is recorded by saveLessonCompletion when playback ends
// or the student uses the explicit completion button.
async function saveLessonProgress(
    client,
    enrollmentId,
    lessonId,
    userId,
    progressPercentage
) {
    const existing = await client.query(
        `SELECT id, status, progress_percentage
         FROM learning.lesson_progress
         WHERE enrollment_id = $1
           AND lesson_id = $2
         ORDER BY soft_delete ASC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [enrollmentId, lessonId]
    );

    if (existing.rows.length) {
        const row = existing.rows[0];
        const wasCompleted = String(row.status || "").toUpperCase() === "COMPLETED";
        const nextProgress = wasCompleted
            ? 100
            : Math.max(Number(row.progress_percentage || 0), progressPercentage);
        const nextStatus = wasCompleted || nextProgress >= 100
            ? "COMPLETED"
            : "IN_PROGRESS";

        const updated = await client.query(
            `UPDATE learning.lesson_progress
             SET status = $2::varchar,
                 progress_percentage = $3,
                 first_started_at = COALESCE(first_started_at, NOW()),
                 last_accessed_at = NOW(),
                 completed_at = CASE
                    WHEN $2::varchar = 'COMPLETED'
                    THEN COALESCE(completed_at, NOW())
                    ELSE completed_at
                 END,
                 updated_at = NOW(),
                 updated_by = $4,
                 soft_delete = FALSE
             WHERE id = $1
             RETURNING id, status, progress_percentage`,
            [row.id, nextStatus, nextProgress, userId]
        );

        return updated.rows[0];
    }

    const inserted = await client.query(
        `INSERT INTO learning.lesson_progress (
            enrollment_id,
            lesson_id,
            status,
            progress_percentage,
            first_started_at,
            last_accessed_at,
            created_by,
            updated_by
         )
         VALUES ($1, $2, 'IN_PROGRESS', $3, NOW(), NOW(), $4, $4)
         RETURNING id, status, progress_percentage`,
        [enrollmentId, lessonId, progressPercentage, userId]
    );

    return inserted.rows[0];
}


// ============================================================
// 4. GET COURSE TOTALS
// ============================================================
// Purpose:
// Calculate overall course progress for one enrollment.
//
// We calculate:
// - Total modules.
// - Completed modules.
// - Total lessons.
// - Completed lessons.
//
// A lesson is considered completed when its latest active
// progress record has status = 'COMPLETED'.
//
// LEFT JOIN LATERAL:
// Fetches at most one progress record for each lesson.
//
// This is important because saveLessonCompletion does not
// depend on an unverified unique constraint. Multiple progress
// records may exist for the same lesson and enrollment.
//
// Therefore, selecting only the latest non-deleted progress
// record prevents lesson counts from being duplicated.
//
// IMPORTANT:
// lesson_progress does not have an is_active column.
// Filter using soft_delete only.

async function getCourseTotals(client, courseId, enrollmentId) {

    const result = await client.query(
        `WITH module_totals AS (

            SELECT
                m.id,

                -- Count all active lessons in this module.
                COUNT(l.id)::int AS total_lessons,

                -- Count lessons whose latest progress is completed.
                COUNT(l.id) FILTER (
                    WHERE lp.status = 'COMPLETED'
                )::int AS completed_lessons,
                COALESCE(SUM(
                    CASE
                        WHEN lp.status = 'COMPLETED' THEN 100
                        ELSE COALESCE(lp.progress_percentage, 0)
                    END
                ), 0)::numeric AS progress_total,
                COALESCE(required_assessments.total_required_assessments, 0)::int
                    AS total_required_assessments,
                COALESCE(required_assessments.completed_required_assessments, 0)::int
                    AS completed_required_assessments

            FROM learning.module m

            -- Fetch active lessons belonging to each module.
            LEFT JOIN learning.lesson l
              ON l.module_id = m.id
             AND l.is_active = TRUE
             AND l.soft_delete = FALSE

            -- Fetch only the latest non-deleted progress record
            -- for each lesson and this student's enrollment.
            LEFT JOIN LATERAL (
                SELECT lp.status, lp.progress_percentage

                FROM learning.lesson_progress lp

                WHERE lp.lesson_id = l.id
                  AND lp.enrollment_id = $2
                  AND lp.soft_delete = FALSE

                ORDER BY lp.id DESC
                LIMIT 1

            ) lp ON TRUE

            LEFT JOIN LATERAL (
                SELECT
                    COUNT(a.id)::int AS total_required_assessments,
                    COUNT(a.id) FILTER (
                        WHERE EXISTS (
                            SELECT 1
                            FROM assessment.assessment_attempt aa
                            WHERE aa.assessment_id = a.id
                              AND aa.enrollment_id = $2
                              AND aa.status = 'EVALUATED'
                              AND aa.passed = TRUE
                              AND COALESCE(aa.soft_delete, FALSE) = FALSE
                        )
                    )::int AS completed_required_assessments
                FROM assessment.assessment a
                WHERE a.module_id = m.id
                  AND a.course_id = $1
                  AND a.status = 'PUBLISHED'
                  AND a.passing_required = TRUE
                  AND a.is_active = TRUE
                  AND a.soft_delete = FALSE
            ) required_assessments ON TRUE

            WHERE m.course_id = $1
              AND m.is_active = TRUE
              AND m.soft_delete = FALSE

            GROUP BY m.id, required_assessments.total_required_assessments,
                required_assessments.completed_required_assessments
        )

        SELECT

            -- Total lessons across all active modules.
            COALESCE(SUM(total_lessons), 0)::int
                AS total_lessons,

            -- Completed lessons across all active modules.
            COALESCE(SUM(completed_lessons), 0)::int
                AS completed_lessons,

            -- Sum each lesson's saved progress for the course average.
            COALESCE(SUM(progress_total), 0)::numeric
                AS progress_total,

            -- Total active modules.
            COUNT(*)::int AS total_modules,

            -- A module is completed when it has at least one
            -- lesson and all its lessons are completed.
            COUNT(*) FILTER (
                WHERE total_lessons > 0
                  AND total_lessons = completed_lessons
                  AND total_required_assessments = completed_required_assessments
            )::int AS completed_modules

        FROM module_totals`,
        [courseId, enrollmentId]
    );

    return result.rows[0];
}

async function getCourseAssessmentTotals(client, courseId, enrollmentId) {
    const result = await client.query(
        `SELECT
            COUNT(a.id)::int AS total_assessments,
            COUNT(a.id) FILTER (
                WHERE a.passing_required = TRUE
            )::int AS total_required_assessments,
            COUNT(a.id) FILTER (
                WHERE EXISTS (
                    SELECT 1
                    FROM assessment.assessment_attempt aa
                    WHERE aa.assessment_id = a.id
                      AND aa.enrollment_id = $2
                      AND aa.status = 'EVALUATED'
                      AND aa.passed = TRUE
                      AND COALESCE(aa.soft_delete, FALSE) = FALSE
                )
            )::int AS completed_assessments,
            COUNT(a.id) FILTER (
                WHERE a.passing_required = TRUE
                  AND EXISTS (
                    SELECT 1
                    FROM assessment.assessment_attempt aa
                    WHERE aa.assessment_id = a.id
                      AND aa.enrollment_id = $2
                      AND aa.status = 'EVALUATED'
                      AND aa.passed = TRUE
                      AND COALESCE(aa.soft_delete, FALSE) = FALSE
                  )
            )::int AS completed_required_assessments
         FROM assessment.assessment a
         LEFT JOIN learning.module m
           ON m.id = a.module_id
         WHERE a.course_id = $1
           AND a.status = 'PUBLISHED'
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND (
                a.module_id IS NULL OR
                (m.id IS NOT NULL AND m.is_active = TRUE AND m.soft_delete = FALSE)
           )`,
        [courseId, enrollmentId]
    );

    return result.rows[0];
}

async function getCourseIdForAssessment(client, assessmentId) {
    const result = await client.query(
        `SELECT course_id
         FROM assessment.assessment
         WHERE id = $1
           AND is_active = TRUE
           AND soft_delete = FALSE`,
        [assessmentId]
    );

    return result.rows[0]?.course_id ?? null;
}

async function getCourseTitle(client, courseId) {
    const result = await client.query(
        `SELECT title
         FROM learning.course
         WHERE id = $1`,
        [courseId]
    );

    return result.rows[0]?.title ?? null;
}



// ============================================================
// 5. SAVE COURSE PROGRESS
// ============================================================
// Purpose:
// Save the student's overall course progress.
//
// If a progress record exists, update it.
// Otherwise, insert a new progress record.
//
// IMPORTANT:
// course_progress does not have an is_active column.
// Use soft_delete to identify deleted records.

async function saveCourseProgress(client, data) {

    const {
        enrollmentId,
        totalModules,
        completedModules,
        totalLessons,
        completedLessons,
        percentage,
        status,
        lessonId,
        userId
    } = data;

    // --------------------------------------------------------
    // 1. CHECK EXISTING COURSE PROGRESS
    // --------------------------------------------------------
    // Prefer a non-deleted record.
    // If multiple records exist, select the latest one.
    // Lock the selected row during the transaction.

    const existing = await client.query(
        `SELECT id, status
         FROM learning.course_progress
         WHERE enrollment_id = $1
         ORDER BY soft_delete ASC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [enrollmentId]
    );

    // --------------------------------------------------------
    // 2. PREPARE SQL VALUES
    // --------------------------------------------------------
    // Keep parameter order consistent with SQL placeholders.

    const values = [
        totalModules,
        completedModules,
        totalLessons,
        completedLessons,
        percentage,
        status,
        lessonId,
        userId
    ];

    // --------------------------------------------------------
    // 3. UPDATE EXISTING COURSE PROGRESS
    // --------------------------------------------------------

    if (existing.rows.length) {

        await client.query(
            `UPDATE learning.course_progress

             SET total_modules = $1,
                 completed_modules = $2,
                 total_lessons = $3,
                 completed_lessons = $4,
                 progress_percentage = $5,
                 status = $6::varchar,

                 last_accessed_at = NOW(),

                 -- Set completion time when the course is completed.
                 -- Otherwise, clear the completion timestamp.
                 completed_at = CASE
                    WHEN $6::varchar = 'COMPLETED'
                    THEN COALESCE(completed_at, NOW())
                    ELSE NULL
                 END,

                 last_completed_lesson_id = COALESCE($7, last_completed_lesson_id),
                 updated_at = NOW(),
                 updated_by = $8,

                 -- Restore the record if it was soft-deleted.
                 soft_delete = FALSE

             WHERE id = $9`,

            [...values, existing.rows[0].id]
        );

        return existing.rows[0].status || null;

    } else {

        // ----------------------------------------------------
        // 4. INSERT NEW COURSE PROGRESS
        // ----------------------------------------------------
        // Create the first course progress record for
        // this student's enrollment.

        await client.query(
            `INSERT INTO learning.course_progress (
                enrollment_id,
                total_modules,
                completed_modules,
                total_lessons,
                completed_lessons,
                progress_percentage,
                status,
                first_started_at,
                last_accessed_at,
                completed_at,
                last_completed_lesson_id,
                created_by,
                updated_by
            )

            VALUES (
                $9,
                $1,
                $2,
                $3,
                $4,
                $5,
                $6::varchar,
                NOW(),
                NOW(),

                CASE
                    WHEN $6::varchar = 'COMPLETED'
                    THEN NOW()
                    ELSE NULL
                END,

                $7,
                $8,
                $8
            )`,

            [...values, enrollmentId]
        );

        return null;
    }
}


// ============================================================
// EXPORT REPOSITORY FUNCTIONS
// ============================================================
// These functions are imported by the lesson progress service.
// The service handles business logic and transaction control.

module.exports = {
    findActiveEnrollment,
    lessonBelongsToCourse,
    saveLessonCompletion,
    saveLessonProgress,
    getCourseTotals,
    getCourseAssessmentTotals,
    getCourseIdForAssessment,
    getCourseTitle,
    saveCourseProgress
};
