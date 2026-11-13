const pool = require("../config/database");

async function getSummary() {
    const [usersResult, coursesResult, enrollmentsResult, revenueResult] =
        await Promise.all([
            pool.query(`
                SELECT
                    COUNT(DISTINCT u.id) FILTER (
                        WHERE UPPER(r.code) = 'STUDENT'
                    )::int AS "activeStudents",
                    COUNT(DISTINCT u.id) FILTER (
                        WHERE UPPER(r.code) = 'INSTRUCTOR'
                    )::int AS "activeInstructors"
                FROM olp_auth."user" u
                INNER JOIN olp_auth.user_role ur
                    ON ur.user_id = u.id
                   AND ur.is_active = TRUE
                   AND ur.soft_delete = FALSE
                INNER JOIN olp_auth.role r
                    ON r.id = ur.role_id
                   AND r.is_active = TRUE
                   AND r.soft_delete = FALSE
                WHERE u.soft_delete = FALSE
                  AND u.is_active = TRUE
                  AND u.is_locked = FALSE
                  AND UPPER(u.approval_status) = 'APPROVED'
            `),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (
                        WHERE c.status = 'PUBLISHED'
                          AND c.is_active = TRUE
                    )::int AS "publishedCourses",
                    COUNT(*) FILTER (
                        WHERE c.status = 'DRAFT'
                          AND c.approval_status = 'PENDING'
                    )::int AS "pendingCourseApprovals"
                FROM learning.course c
                WHERE c.soft_delete = FALSE
            `),
            pool.query(`
                SELECT COUNT(*)::int AS "enrollmentsThisMonth"
                FROM learning.enrollment e
                WHERE e.soft_delete = FALSE
                  AND e.enrollment_date >= date_trunc('month', CURRENT_DATE)::date
                  AND e.enrollment_date <
                      (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
            `),
            pool.query(`
                SELECT
                    COALESCE(NULLIF(BTRIM(p.currency_code), ''), 'INR') AS "currencyCode",
                    COALESCE(SUM(p.paid_amount), 0) AS "totalAmount",
                    COALESCE(SUM(p.paid_amount) FILTER (
                        WHERE p.paid_at >= date_trunc('month', CURRENT_DATE)
                          AND p.paid_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
                    ), 0) AS "monthAmount"
                FROM payment.payment p
                WHERE p.soft_delete = FALSE
                  AND p.status = 'PAID'
                GROUP BY COALESCE(NULLIF(BTRIM(p.currency_code), ''), 'INR')
                ORDER BY "currencyCode"
            `)
        ]);

    return {
        ...(usersResult.rows[0] || {}),
        ...(coursesResult.rows[0] || {}),
        ...(enrollmentsResult.rows[0] || {}),
        revenueByCurrency: revenueResult.rows.map((row) => ({
            currencyCode: row.currencyCode,
            totalAmount: row.totalAmount,
            monthAmount: row.monthAmount
        }))
    };
}

async function getWidgets() {
    const [enrollmentTrend, revenueTrend, topCourses, pendingApprovals,
        recentFinancialActivity, payrollAttention] = await Promise.all([
        pool.query(`
            WITH months AS (
                SELECT generate_series(
                    date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                    date_trunc('month', CURRENT_DATE),
                    INTERVAL '1 month'
                )::date AS month_start
            )
            SELECT
                TO_CHAR(m.month_start, 'YYYY-MM-DD') AS "monthKey",
                TO_CHAR(m.month_start, 'Mon') AS "monthLabel",
                COUNT(e.id)::int AS "totalEnrollments"
            FROM months m
            LEFT JOIN learning.enrollment e
                ON e.enrollment_date >= m.month_start
               AND e.enrollment_date < (m.month_start + INTERVAL '1 month')::date
               AND e.soft_delete = FALSE
            GROUP BY m.month_start
            ORDER BY m.month_start
        `),
        pool.query(`
            WITH months AS (
                SELECT generate_series(
                    date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                    date_trunc('month', CURRENT_DATE),
                    INTERVAL '1 month'
                )::date AS month_start
            ), currencies AS (
                SELECT DISTINCT
                    COALESCE(NULLIF(BTRIM(p.currency_code), ''), 'INR') AS currency_code
                FROM payment.payment p
                WHERE p.soft_delete = FALSE
                  AND p.status = 'PAID'
            )
            SELECT
                TO_CHAR(m.month_start, 'YYYY-MM-DD') AS "monthKey",
                TO_CHAR(m.month_start, 'Mon') AS "monthLabel",
                c.currency_code AS "currencyCode",
                COALESCE(SUM(p.paid_amount), 0) AS "totalAmount"
            FROM months m
            CROSS JOIN currencies c
            LEFT JOIN payment.payment p
                ON COALESCE(NULLIF(BTRIM(p.currency_code), ''), 'INR') = c.currency_code
               AND p.status = 'PAID'
               AND p.soft_delete = FALSE
               AND p.paid_at >= m.month_start
               AND p.paid_at < (m.month_start + INTERVAL '1 month')
            GROUP BY m.month_start, c.currency_code
            ORDER BY m.month_start, c.currency_code
        `),
        pool.query(`
            SELECT
                c.id::text AS id,
                c.course_code AS "courseCode",
                c.title,
                COUNT(e.id)::int AS "enrollmentCount"
            FROM learning.course c
            LEFT JOIN learning.enrollment e
                ON e.course_id = c.id
               AND e.soft_delete = FALSE
            WHERE c.status = 'PUBLISHED'
              AND c.is_active = TRUE
              AND c.soft_delete = FALSE
            GROUP BY c.id, c.course_code, c.title
            ORDER BY COUNT(e.id) DESC, c.title ASC
            LIMIT 5
        `),
        pool.query(`
            SELECT
                c.id::text AS id,
                c.course_code AS "courseCode",
                c.title,
                c.submitted_at AS "submittedAt",
                instructor.instructor_name AS "instructorName"
            FROM learning.course c
            LEFT JOIN LATERAL (
                SELECT
                    TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS instructor_name
                FROM learning.course_instructor ci
                INNER JOIN learning.instructor i
                    ON i.id = ci.instructor_id
                   AND i.soft_delete = FALSE
                INNER JOIN olp_auth."user" u
                    ON u.id = i.user_id
                   AND u.soft_delete = FALSE
                WHERE ci.course_id = c.id
                  AND ci.is_active = TRUE
                ORDER BY ci.is_primary DESC, ci.id ASC
                LIMIT 1
            ) instructor ON TRUE
            WHERE c.approval_status = 'PENDING'
              AND c.status = 'DRAFT'
              AND c.soft_delete = FALSE
            ORDER BY c.submitted_at ASC NULLS LAST, c.id ASC
            LIMIT 6
        `),
        pool.query(`
            SELECT activity.*
            FROM (
                SELECT
                    p.id::text AS id,
                    'PAYMENT'::text AS "activityType",
                    p.payment_number AS reference,
                    COALESCE(
                        NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''),
                        u.username
                    ) AS "customerName",
                    c.title AS "courseTitle",
                    p.paid_amount AS amount,
                    COALESCE(NULLIF(BTRIM(p.currency_code), ''), 'INR') AS "currencyCode",
                    p.status,
                    COALESCE(p.paid_at, p.updated_at, p.created_at) AS "occurredAt"
                FROM payment.payment p
                INNER JOIN learning.student s
                    ON s.id = p.student_id
                   AND s.soft_delete = FALSE
                INNER JOIN olp_auth."user" u
                    ON u.id = s.user_id
                   AND u.soft_delete = FALSE
                LEFT JOIN learning.course c
                    ON c.id = p.course_id
                WHERE p.soft_delete = FALSE

                UNION ALL

                SELECT
                    r.id::text AS id,
                    'REFUND'::text AS "activityType",
                    r.refund_number AS reference,
                    COALESCE(
                        NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''),
                        u.username
                    ) AS "customerName",
                    c.title AS "courseTitle",
                    r.refund_amount AS amount,
                    COALESCE(NULLIF(BTRIM(r.currency_code), ''), 'INR') AS "currencyCode",
                    r.status,
                    COALESCE(r.processed_at, r.requested_at, r.created_at) AS "occurredAt"
                FROM payment.payment_refund r
                INNER JOIN payment.payment p
                    ON p.id = r.payment_id
                   AND p.soft_delete = FALSE
                INNER JOIN learning.student s
                    ON s.id = p.student_id
                   AND s.soft_delete = FALSE
                INNER JOIN olp_auth."user" u
                    ON u.id = s.user_id
                   AND u.soft_delete = FALSE
                LEFT JOIN learning.course c
                    ON c.id = p.course_id
                WHERE r.soft_delete = FALSE
            ) activity
            ORDER BY activity."occurredAt" DESC NULLS LAST
            LIMIT 8
        `),
        pool.query(`
            SELECT
                ip.id::text AS id,
                ip.payroll_number AS "payrollNumber",
                p.period_code AS "periodCode",
                COALESCE(
                    NULLIF(TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))), ''),
                    u.username
                ) AS "instructorName",
                ip.net_amount AS "netAmount",
                COALESCE(NULLIF(BTRIM(ip.currency_code), ''), 'INR') AS "currencyCode",
                ip.status,
                ip.updated_at AS "updatedAt"
            FROM payroll.instructor_payroll ip
            INNER JOIN payroll.payroll_period p
                ON p.id = ip.payroll_period_id
               AND p.soft_delete = FALSE
            INNER JOIN learning.instructor i
                ON i.id = ip.instructor_id
               AND i.soft_delete = FALSE
            INNER JOIN olp_auth."user" u
                ON u.id = i.user_id
               AND u.soft_delete = FALSE
            WHERE ip.soft_delete = FALSE
              AND ip.status IN ('DRAFT', 'CALCULATED', 'APPROVED')
            ORDER BY
                CASE ip.status
                    WHEN 'DRAFT' THEN 1
                    WHEN 'CALCULATED' THEN 2
                    WHEN 'APPROVED' THEN 3
                    ELSE 4
                END,
                p.period_start DESC,
                ip.id DESC
            LIMIT 6
        `)
    ]);

    return {
        enrollmentTrend: enrollmentTrend.rows,
        revenueTrend: revenueTrend.rows,
        topCourses: topCourses.rows,
        pendingApprovals: pendingApprovals.rows,
        recentFinancialActivity: recentFinancialActivity.rows,
        payrollAttention: payrollAttention.rows
    };
}

module.exports = {
    getSummary,
    getWidgets
};
