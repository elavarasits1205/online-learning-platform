async function createCourse(client, instructorId, data) {
    const result = await client.query(
        `INSERT INTO learning.course (
            category_id,
            course_code,
            title,
            short_description,
            description,
            thumbnail_url,
            level,
            language_code,
            currency_code,
            price,
            duration_minutes,
            status,
            approval_status,
            soft_delete,
            course_type,
            created_by
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            'DRAFT', 'NOT_SUBMITTED', FALSE, $12, $13
        )
        RETURNING *`,
        [
            data.category_id,
            data.course_code,
            data.title,
            data.short_description ?? null,
            data.description ?? null,
            data.thumbnail_url ?? null,
            data.level ?? "BEGINNER",
            data.language_code ?? "en",
            data.currency_code ?? "INR",
            data.price ?? 0,
            data.duration_minutes ?? null,
            data.course_type ?? "PAID",
            data.created_by ?? null
        ]
    );

    const course = result.rows[0];

    await client.query(
        `INSERT INTO learning.course_instructor (
            course_id,
            instructor_id,
            is_primary,
            is_active,
            created_by
        )
        VALUES ($1, $2, TRUE, TRUE, $3)`,
        [course.id, instructorId, data.created_by ?? null]
    );

    return course;
}


async function listMyCourses(client, instructorId) {
    const result = await client.query(
        `SELECT
            c.*,

            COALESCE(stats.enrolled_students, 0)::int
                AS enrolled_students,

            COALESCE(stats.completed_students, 0)::int
                AS completed_students,

            stats.last_enrollment_at,
            stats.last_student_activity_at,

            COALESCE(trend.enrollment_trend, '[]'::jsonb)
                AS enrollment_trend

         FROM learning.course AS c

         JOIN learning.course_instructor AS ci
           ON ci.course_id = c.id

         LEFT JOIN LATERAL (
             SELECT
                 COUNT(e.id)::int AS enrolled_students,

                 COUNT(e.id) FILTER (
                     WHERE e.status = 'COMPLETED'
                 )::int AS completed_students,

                 MAX(e.enrollment_date) AS last_enrollment_at,

                 MAX(e.last_accessed_at) AS last_student_activity_at

             FROM learning.enrollment AS e

             WHERE e.course_id = c.id
               AND e.soft_delete = FALSE
               AND e.status IN ('ACTIVE', 'COMPLETED')
         ) AS stats ON TRUE

         LEFT JOIN LATERAL (
             SELECT
                 COALESCE(
                     jsonb_agg(
                         jsonb_build_object(
                             'month', month_data.month,
                             'enrolled_students', month_data.enrolled_students,
                             'completed_students', month_data.completed_students
                         )
                         ORDER BY month_data.month
                     ),
                     '[]'::jsonb
                 ) AS enrollment_trend

             FROM (
                 SELECT
                     events.month,
                     SUM(events.enrolled_students)::int AS enrolled_students,
                     SUM(events.completed_students)::int AS completed_students

                 FROM (
                     SELECT
                         date_trunc(
                             'month',
                             e_month.enrollment_date
                         )::date AS month,

                         COUNT(*)::int AS enrolled_students,
                         0::int AS completed_students

                     FROM learning.enrollment AS e_month

                     WHERE e_month.course_id = c.id
                       AND e_month.soft_delete = FALSE
                       AND e_month.status IN ('ACTIVE', 'COMPLETED')
                       AND e_month.enrollment_date >=
                           date_trunc('month', CURRENT_DATE)
                           - INTERVAL '5 months'

                     GROUP BY 1

                     UNION ALL

                     SELECT
                         date_trunc(
                             'month',
                             e_month.completed_at
                         )::date AS month,

                         0::int AS enrolled_students,
                         COUNT(*)::int AS completed_students

                     FROM learning.enrollment AS e_month

                     WHERE e_month.course_id = c.id
                       AND e_month.soft_delete = FALSE
                       AND e_month.status = 'COMPLETED'
                       AND e_month.completed_at >=
                           date_trunc('month', CURRENT_DATE)
                           - INTERVAL '5 months'

                     GROUP BY 1

                 ) AS events

                 GROUP BY events.month

             ) AS month_data

         ) AS trend ON TRUE

         WHERE ci.instructor_id = $1
           AND ci.is_active = TRUE
           AND c.soft_delete = FALSE

         ORDER BY c.id DESC`,
        [instructorId]
    );

    return result.rows;
}

async function updateCourse(client, instructorId, courseId, data) {
    const result = await client.query(
        `UPDATE learning.course AS c
         SET category_id = COALESCE($3, c.category_id),
             title = COALESCE($4, c.title),
             short_description = COALESCE($5, c.short_description),
             description = COALESCE($6, c.description),
             thumbnail_url = COALESCE($7, c.thumbnail_url),
             level = COALESCE($8, c.level),
             language_code = COALESCE($9, c.language_code),
             currency_code = COALESCE($10, c.currency_code),
             price = COALESCE($11, c.price),
             duration_minutes = COALESCE($12, c.duration_minutes),
             course_type = COALESCE($13, c.course_type),
             updated_at = NOW(),
             updated_by = $14
         WHERE c.id = $1
           AND c.soft_delete = FALSE
           AND c.status = 'DRAFT'
           AND c.approval_status IN ('NOT_SUBMITTED', 'REJECTED')
           AND EXISTS (
               SELECT 1
               FROM learning.course_instructor AS ci
               WHERE ci.course_id = c.id
                 AND ci.instructor_id = $2
                 AND ci.is_active = TRUE
           )
         RETURNING c.*`,
        [
            courseId,
            instructorId,
            data.category_id ?? null,
            data.title ?? null,
            data.short_description ?? null,
            data.description ?? null,
            data.thumbnail_url ?? null,
            data.level ?? null,
            data.language_code ?? null,
            data.currency_code ?? null,
            data.price ?? null,
            data.duration_minutes ?? null,
            data.course_type ?? null,
            data.updated_by ?? null
        ]
    );

    return result.rows[0] || null;
}

async function submitCourse(client, instructorId, courseId) {
    const result = await client.query(
        `UPDATE learning.course AS c
         SET approval_status = 'PENDING',
             submitted_at = NOW(),
             reviewed_at = NULL,
             reviewed_by = NULL,
             rejection_reason = NULL,
             updated_at = NOW()
         WHERE c.id = $1
           AND c.soft_delete = FALSE
           AND c.status = 'DRAFT'
           AND c.approval_status IN ('NOT_SUBMITTED', 'REJECTED')
           AND EXISTS (
               SELECT 1
               FROM learning.course_instructor AS ci
               WHERE ci.course_id = c.id
                 AND ci.instructor_id = $2
                 AND ci.is_active = TRUE
           )
           AND EXISTS (
               SELECT 1
               FROM learning.module AS m
               WHERE m.course_id = c.id
                 AND m.is_active = TRUE
                 AND m.soft_delete = FALSE
           )
           AND EXISTS (
               SELECT 1
               FROM learning.module AS m
               JOIN learning.lesson AS l
                 ON l.module_id = m.id
               WHERE m.course_id = c.id
                 AND m.is_active = TRUE
                 AND m.soft_delete = FALSE
                 AND l.is_active = TRUE
                 AND l.soft_delete = FALSE
           )
         RETURNING c.*`,
        [courseId, instructorId]
    );

    return result.rows[0] || null;
}
async function updateCourseThumbnail(
    client,
    instructorId,
    courseId,
    thumbnailUrl,
    userId
) {
    const result = await client.query(
        `UPDATE learning.course AS c
         SET thumbnail_url = $3,
             updated_at = NOW(),
             updated_by = $4
         WHERE c.id = $1
           AND c.soft_delete = FALSE
           AND c.status = 'DRAFT'
           AND c.approval_status IN ('NOT_SUBMITTED', 'REJECTED')
           AND EXISTS (
               SELECT 1
               FROM learning.course_instructor AS ci
               WHERE ci.course_id = c.id
                 AND ci.instructor_id = $2
                 AND ci.is_active = TRUE
           )
         RETURNING c.*`,
        [courseId, instructorId, thumbnailUrl, userId]
    );

    return result.rows[0] || null;
}



async function getCourseById(client, instructorId, courseId) {
    const result = await client.query(
        `SELECT c.*
         FROM learning.course AS c
         WHERE c.id = $1
           AND c.soft_delete = FALSE
           AND EXISTS (
               SELECT 1
               FROM learning.course_instructor AS ci
               WHERE ci.course_id = c.id
                 AND ci.instructor_id = $2
                 AND ci.is_active = TRUE
           )
         LIMIT 1`,
        [courseId, instructorId]
    );

    return result.rows[0] || null;
}

async function getActiveCategories(client) {
    const result = await client.query(`
        SELECT
            id,
            code,
            name,
            description,
            parent_category_id
        FROM public.course_category
        WHERE is_active = TRUE
          AND soft_delete = FALSE
        ORDER BY display_order ASC, name ASC
    `);

    return result.rows;
}



module.exports = {
    createCourse,
    listMyCourses,
    updateCourse,
    submitCourse,
    updateCourseThumbnail,
     getCourseById,
    getActiveCategories
};
