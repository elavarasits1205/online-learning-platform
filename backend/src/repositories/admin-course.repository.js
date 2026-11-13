
async function listPendingCourses(client) {
    const result = await client.query(`
        SELECT
            c.id::text AS id,
            c.category_id::text AS category_id,
            COALESCE(
                to_jsonb(cc)->>'category_name',
                to_jsonb(cc)->>'course_category_name',
                to_jsonb(cc)->>'name',
                to_jsonb(cc)->>'title'
            ) AS category_name,
            c.course_code,
            c.title,
            c.short_description,
            c.status,
            c.approval_status,
            c.submitted_at,
            ci.instructor_id::text AS instructor_id
        FROM learning.course c
        LEFT JOIN public.course_category cc
            ON cc.id = c.category_id
        LEFT JOIN LATERAL (
            SELECT ci.instructor_id
            FROM learning.course_instructor ci
            WHERE ci.course_id = c.id
              AND ci.is_primary = TRUE
              AND ci.is_active = TRUE
            ORDER BY ci.instructor_id
            LIMIT 1
        ) ci ON TRUE
        WHERE c.approval_status = 'PENDING'
          AND c.status = 'DRAFT'
          AND c.soft_delete = FALSE
        ORDER BY c.submitted_at ASC NULLS LAST, c.id ASC
    `);

    return result.rows;
}

async function listAllCourses(client) {
    const result = await client.query(`
        SELECT
            c.id::text AS id,
            c.category_id::text AS category_id,
            COALESCE(
                to_jsonb(cc)->>'category_name',
                to_jsonb(cc)->>'course_category_name',
                to_jsonb(cc)->>'name',
                to_jsonb(cc)->>'title'
            ) AS category_name,
            c.course_code,
            c.title,
            c.short_description,
            c.description,
            c.thumbnail_url,
            c.level,
            c.language_code,
            c.price,
            c.currency_code,
            c.duration_minutes,
            c.status,
            c.published_at,
            c.start_date,
            c.end_date,
            c.max_students,
            c.is_featured,
            c.is_active,
            c.course_type,
            c.approval_status,
            c.submitted_at,
            c.reviewed_at,
            c.rejection_reason,
            c.created_by::text AS created_by,
            c.created_at,
            c.updated_by::text AS updated_by,
            c.updated_at
        FROM learning.course c
        LEFT JOIN public.course_category cc
            ON cc.id = c.category_id
        WHERE c.soft_delete = FALSE
        ORDER BY c.id DESC
    `);

    return result.rows;
}

async function getCourseBundle(client, courseId) {
    const result = await client.query(
        `
        SELECT
            c.id::text AS id,
            c.category_id::text AS category_id,
            COALESCE(
                to_jsonb(cc)->>'category_name',
                to_jsonb(cc)->>'course_category_name',
                to_jsonb(cc)->>'name',
                to_jsonb(cc)->>'title'
            ) AS category_name,
            c.course_code,
            c.title,
            c.short_description,
            c.description,
            c.thumbnail_url,
            c.level,
            c.language_code,
            c.price,
            c.currency_code,
            c.duration_minutes,
            c.status,
            c.published_at,
            c.start_date,
            c.end_date,
            c.max_students,
            c.is_featured,
            c.is_active,
            c.course_type,
            c.approval_status,
            c.submitted_at,
            c.reviewed_at,
            c.rejection_reason,
            c.created_by::text AS created_by,
            c.created_at,
            c.updated_by::text AS updated_by,
            c.updated_at,
            COALESCE(
                (
                    SELECT jsonb_agg(
                        to_jsonb(m) ||
                        jsonb_build_object(
                            'lessons',
                            COALESCE(
                                (
                                    SELECT jsonb_agg(
                                        to_jsonb(l)
                                        ORDER BY l.sort_order, l.id
                                    )
                                    FROM learning.lesson l
                                    WHERE l.module_id = m.id
                                      AND l.is_active = TRUE
                                      AND l.soft_delete = FALSE
                                ),
                                '[]'::jsonb
                            )
                        )
                        ORDER BY m.sort_order, m.id
                    )
                    FROM learning.module m
                    WHERE m.course_id = c.id
                      AND m.is_active = TRUE
                      AND m.soft_delete = FALSE
                ),
                '[]'::jsonb
            ) AS modules
        FROM learning.course c
        LEFT JOIN public.course_category cc
            ON cc.id = c.category_id
        WHERE c.id = $1
          AND c.soft_delete = FALSE
        `,
        [courseId]
    );

    return result.rows[0] || null;
}

// Submit a course owned by the logged-in instructor.
async function submitCourseForApproval(client, courseId, instructorId) {
    const result = await client.query(
        `
        UPDATE learning.course AS c
        SET approval_status = 'PENDING',
            submitted_at = NOW(),
            reviewed_at = NULL,
            reviewed_by = NULL,
            rejection_reason = NULL,
            updated_at = NOW(),
            updated_by = $2
        WHERE c.id = $1
          AND c.status = 'DRAFT'
          AND c.approval_status IN ('NOT_SUBMITTED', 'REJECTED')
          AND c.soft_delete = FALSE
          AND EXISTS (
              SELECT 1
              FROM learning.course_instructor ci
              WHERE ci.course_id = c.id
                AND ci.instructor_id = $2
                AND ci.is_active = TRUE
          )
        RETURNING
            c.id::text AS id,
            c.category_id::text AS category_id,
            c.course_code,
            c.title,
            c.status,
            c.approval_status,
            c.submitted_at,
            c.updated_at
        `,
        [courseId, instructorId]
    );

    return result.rows[0] || null;
}

// Admin approval automatically publishes the course.
async function approveCourse(client, courseId, adminUserId) {
    const result = await client.query(
        `
        UPDATE learning.course
        SET status = 'PUBLISHED',
            approval_status = 'APPROVED',
            published_at = COALESCE(published_at, NOW()),
            reviewed_at = NOW(),
            reviewed_by = $2,
            rejection_reason = NULL,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND status = 'DRAFT'
          AND approval_status = 'PENDING'
          AND soft_delete = FALSE
        RETURNING
            id::text AS id,
            category_id::text AS category_id,
            course_code,
            title,
            status,
            approval_status,
            published_at,
            reviewed_at,
            reviewed_by::text AS reviewed_by,
            updated_at,
            updated_by::text AS updated_by,
            is_active
        `,
        [courseId, adminUserId]
    );

    return result.rows[0] || null;
}

async function rejectCourse(client, courseId, adminUserId, reason) {
    const result = await client.query(
        `
        UPDATE learning.course
        SET status = 'DRAFT',
            approval_status = 'REJECTED',
            reviewed_at = NOW(),
            reviewed_by = $2,
            rejection_reason = $3,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND status = 'DRAFT'
          AND approval_status = 'PENDING'
          AND soft_delete = FALSE
        RETURNING
            id::text AS id,
            category_id::text AS category_id,
            course_code,
            title,
            status,
            approval_status,
            rejection_reason,
            reviewed_at,
            reviewed_by::text AS reviewed_by,
            updated_at,
            is_active
        `,
        [courseId, adminUserId, reason]
    );

    return result.rows[0] || null;
}

module.exports = {
    listPendingCourses,
    listAllCourses,
    getCourseBundle,
    submitCourseForApproval,
    approveCourse,
    rejectCourse
};
