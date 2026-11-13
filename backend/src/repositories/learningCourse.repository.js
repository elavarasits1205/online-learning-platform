
const pool = require("../config/database");


// ============================================================
// 1. GET ENROLLED COURSE
// ============================================================
// Purpose:
// Check whether the logged-in student has access to this course.
//
// Database connections:
// student -> enrollment -> course
//
// Validation:
// - Student must be active and not deleted.
// - Enrollment must not be deleted.
// - Enrollment status must be ACTIVE or COMPLETED.
// - Course must be active and not deleted.
//
// IMPORTANT:
// learning.enrollment does not have an is_active column.
// So we use soft_delete and status for enrollment validation.

async function getEnrolledCourse(userId, courseId) {

    const result = await pool.query(
        `SELECT
            c.id,
            c.title,
            c.short_description,
            c.description,
            c.thumbnail_url,
            c.duration_minutes,
            c.level,
            e.id AS enrollment_id,
            e.status AS enrollment_status

         FROM learning.student AS s

         JOIN learning.enrollment AS e
           ON e.student_id = s.id

         JOIN learning.course AS c
           ON c.id = e.course_id

         WHERE s.user_id = $1
           AND c.id = $2

           -- Student must be active and not deleted.
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE

           -- Enrollment table uses soft_delete and status.
           -- It does not contain an is_active column.
           AND e.soft_delete = FALSE
           AND e.status IN ('ACTIVE', 'COMPLETED')

           -- Course must be active and available.
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE

         ORDER BY e.enrollment_date DESC
         LIMIT 1`,
        [userId, courseId]
    );

    // Return course details if enrollment exists.
    // Otherwise, return null.
    return result.rows[0] || null;
}

async function getLearningActivityDates(userId) {
    const result = await pool.query(
        `SELECT DISTINCT TO_CHAR((lp.last_accessed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS activity_date
         FROM learning.lesson_progress lp
         JOIN learning.enrollment e ON e.id = lp.enrollment_id
         JOIN learning.student s ON s.id = e.student_id
         WHERE s.user_id = $1
           AND s.is_active = TRUE AND s.soft_delete = FALSE
           AND e.soft_delete = FALSE
           AND e.status IN ('ACTIVE', 'COMPLETED')
           AND lp.soft_delete = FALSE
           AND lp.last_accessed_at >= NOW() - INTERVAL '400 days'
         ORDER BY activity_date DESC`,
        [userId]
    );
    return result.rows.map((row) => row.activity_date);
}


// ============================================================
// 2. GET ACTIVE MODULES BY COURSE ID
// ============================================================
// Purpose:
// Fetch all active modules belonging to a particular course.
//
// A course can contain multiple modules.
// Each module contains multiple lessons.
//
// We fetch module information here.
// Lesson information is fetched separately below.

async function getActiveModulesByCourseId(courseId) {

    const result = await pool.query(
        `SELECT
            m.id,
            m.course_id,
            m.module_number,
            m.title,
            m.description,
            m.sort_order

         FROM learning.module AS m

         WHERE m.course_id = $1

           -- Only active modules are displayed.
           AND m.is_active = TRUE

           -- Exclude soft-deleted modules.
           AND m.soft_delete = FALSE

         ORDER BY
            m.sort_order,
            m.module_number,
            m.id`,
        [courseId]
    );

    return result.rows;
}


// ============================================================
// 3. GET ACTIVE LESSONS BY COURSE ID
// ============================================================
// Purpose:
// Fetch all active lessons belonging to a course.
//
// Lesson information includes:
// - Lesson title and description.
// - Video URL.
// - Lesson type.
// - Duration.
// - Preview availability.
// - Student progress status.
//
// Database connections:
// module -> lesson
//
// LEFT JOIN LATERAL:
// Fetches the latest progress record for each lesson
// belonging to this student's enrollment.
//
// COALESCE:
// If no progress record exists, show NOT_STARTED
// and 0% progress by default.
//
// IMPORTANT:
// The latest learning.lesson_progress table does not have
// an is_active column. Therefore, filter only by soft_delete.

async function getActiveLessonsByCourseId(courseId, enrollmentId) {

    const result = await pool.query(
        `SELECT
            l.id,
            l.module_id,
            l.lesson_number,
            l.title,
            l.description,
            l.lesson_type,
            l.content,
            l.video_url,
            l.duration_minutes,
            to_jsonb(l) -> 'resources' AS resources,
            to_jsonb(l) -> 'lesson_resources' AS lesson_resources,
            to_jsonb(l) -> 'attachments' AS attachments,
            to_jsonb(l) -> 'materials' AS materials,
            to_jsonb(l) -> 'lesson_materials' AS lesson_materials,
            to_jsonb(l) -> 'resource_links' AS resource_links,
            to_jsonb(l) -> 'resource_urls' AS resource_urls,
            l.sort_order,
            l.is_preview,
            l.is_active,

            -- Display default progress when no progress exists.
            COALESCE(lp.status, 'NOT_STARTED') AS progress_status,

            -- Default lesson progress to 0%.
            COALESCE(lp.progress_percentage, 0)
                AS lesson_progress_percentage

         FROM learning.lesson AS l

         JOIN learning.module AS m
           ON m.id = l.module_id

         -- Fetch the latest progress record for this lesson
         -- and this particular enrollment.
         LEFT JOIN LATERAL (
             SELECT
                 lp.status,
                 lp.progress_percentage

             FROM learning.lesson_progress AS lp

             WHERE lp.lesson_id = l.id
               AND lp.enrollment_id = $2

               -- lesson_progress uses soft_delete.
               -- It does not have an is_active column.
               AND lp.soft_delete = FALSE

             -- If multiple progress records exist,
             -- select the latest record using its ID.
             ORDER BY lp.id DESC
             LIMIT 1

         ) AS lp ON TRUE

         WHERE m.course_id = $1

           -- Only active, non-deleted modules.
           AND m.is_active = TRUE
           AND m.soft_delete = FALSE

           -- Only active, non-deleted lessons.
           AND l.is_active = TRUE
           AND l.soft_delete = FALSE

         ORDER BY
            m.sort_order,
            m.module_number,
            l.sort_order,
            l.lesson_number,
            l.id`,
        [courseId, enrollmentId]
    );

    return result.rows;
}


// ============================================================
// 4. GET REQUIRED MODULE ASSESSMENT STATUS
// ============================================================
// Purpose:
// Check whether the student has passed each required
// published assessment belonging to a module.

async function getModuleAssessmentStatuses(courseId, enrollmentId) {

    const result = await pool.query(
        `SELECT
            a.id AS assessment_id,
            a.module_id,
            a.title,
            a.passing_required,

            EXISTS (
                SELECT 1
                FROM assessment.assessment_attempt aa
                WHERE aa.assessment_id = a.id
                  AND aa.enrollment_id = $2
                  AND aa.status = 'EVALUATED'
                  AND aa.passed = TRUE
                  AND COALESCE(aa.soft_delete, FALSE) = FALSE
            ) AS has_passed

         FROM assessment.assessment a

         JOIN learning.module m
           ON m.id = a.module_id

         WHERE a.course_id = $1
           AND a.module_id IS NOT NULL
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND a.status = 'PUBLISHED'
           AND a.passing_required = TRUE
           AND m.is_active = TRUE
           AND m.soft_delete = FALSE

         ORDER BY m.sort_order, a.id`,
        [courseId, enrollmentId]
    );

    return result.rows;
}

async function getCourseAssessmentProgress(courseId, enrollmentId) {
    const result = await pool.query(
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



// ============================================================
// EXPORT REPOSITORY FUNCTIONS
// ============================================================
// The service layer imports these functions.
//
// The repository communicates directly with PostgreSQL.
// The service layer handles the business logic and combines
// the results before sending them to the controller.

module.exports = {
    getLearningActivityDates,
    getEnrolledCourse,
    getActiveModulesByCourseId,
    getActiveLessonsByCourseId,
    getModuleAssessmentStatuses,
    getCourseAssessmentProgress
};
