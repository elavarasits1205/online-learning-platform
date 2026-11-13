// Shared server-side validation for sequential module unlocking.
// This helper does not require any database schema changes.

async function isModuleUnlocked(db, {
    courseId,
    moduleId,
    enrollmentId
}) {
    const result = await db.query(
        `SELECT
            EXISTS (
                SELECT 1
                FROM learning.module target
                WHERE target.id = $2
                  AND target.course_id = $1
                  AND target.is_active = TRUE
                  AND target.soft_delete = FALSE
            )
            AND NOT EXISTS (
                SELECT 1
                FROM learning.module previous
                JOIN learning.module target
                  ON target.id = $2
                 AND target.course_id = $1
                WHERE previous.course_id = $1
                  AND previous.is_active = TRUE
                  AND previous.soft_delete = FALSE
                  AND (previous.sort_order, previous.module_number, previous.id)
                      < (target.sort_order, target.module_number, target.id)
                  AND (
                      // Previous module mandatory lessons
                      EXISTS (
                          SELECT 1
                          FROM learning.lesson l
                          WHERE l.module_id = previous.id
                            AND l.is_active = TRUE
                            AND l.soft_delete = FALSE
                            AND l.is_mandatory = TRUE
                            AND NOT EXISTS (
                                SELECT 1
                                FROM learning.lesson_progress lp
                                WHERE lp.lesson_id = l.id
                                  AND lp.enrollment_id = $3
                                  AND lp.status = 'COMPLETED'
                                  AND lp.soft_delete = FALSE
                            )
                      )
                      OR
                      // Previous module required assessments
                      EXISTS (
                          SELECT 1
                          FROM assessment.assessment a
                          WHERE a.module_id = previous.id
                            AND a.course_id = $1
                            AND a.assessment_type = 'MODULE'
                            AND a.passing_required = TRUE
                            AND a.status = 'PUBLISHED'
                            AND a.is_active = TRUE
                            AND a.soft_delete = FALSE
                            AND NOT EXISTS (
                                SELECT 1
                                FROM assessment.assessment_attempt aa
                                WHERE aa.assessment_id = a.id
                                  AND aa.enrollment_id = $3
                                  AND aa.status = 'EVALUATED'
                                  AND aa.passed = TRUE
                                  AND COALESCE(aa.soft_delete, FALSE) = FALSE
                            )
                      )
                  )
            ) AS is_unlocked`,
        [courseId, moduleId, enrollmentId]
    );

    return result.rows[0]?.is_unlocked === true;
}

module.exports = { isModuleUnlocked };
