const pool = require("../config/database");

const USER_TABLE = 'olp_auth."user"';

const PAYROLL_FROM = `
    payroll.instructor_payroll ip
    INNER JOIN payroll.payroll_period p
        ON p.id = ip.payroll_period_id AND p.soft_delete = FALSE
    INNER JOIN learning.instructor i
        ON i.id = ip.instructor_id AND i.soft_delete = FALSE
    INNER JOIN ${USER_TABLE} u
        ON u.id = i.user_id AND u.soft_delete = FALSE
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pay.amount), 0) AS paid_amount
        FROM payroll.payroll_payment pay
        WHERE pay.instructor_payroll_id = ip.id
          AND pay.soft_delete = FALSE
          AND pay.status = 'SUCCESS'
    ) pay ON TRUE
`;

const PAYROLL_SELECT = `
    SELECT
        ip.id::text AS instructor_payroll_id,
        ip.payroll_number,
        ip.payroll_period_id::text AS payroll_period_id,
        p.period_code,
        p.period_start,
        p.period_end,
        i.id::text AS instructor_id,
        i.instructor_code,
        u.id::text AS instructor_user_id,
        u.username AS instructor_username,
        u.email AS instructor_email,
        TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')))
            AS instructor_name,
        ip.total_earnings,
        ip.incentive_amount,
        ip.incentive_notes,
        ip.total_deductions,
        ip.net_amount,
        ip.currency_code,
        ip.status,
        ip.approved_at,
        ip.paid_at,
        pay.paid_amount
    FROM ${PAYROLL_FROM}
`;

const ENROLLMENT_FROM = `
    learning.enrollment e
    INNER JOIN learning.student s
        ON s.id = e.student_id AND s.soft_delete = FALSE
    INNER JOIN ${USER_TABLE} u
        ON u.id = s.user_id AND u.soft_delete = FALSE
    LEFT JOIN public.institution i
        ON i.id = s.institution_id
    INNER JOIN learning.course c
        ON c.id = e.course_id AND c.soft_delete = FALSE
    LEFT JOIN LATERAL (
        SELECT
            ci.instructor_id,
            inst_i.instructor_code,
            CONCAT_WS(
                ' ',
                NULLIF(BTRIM(iu.first_name), ''),
                NULLIF(BTRIM(iu.last_name), '')
            ) AS instructor_name
        FROM learning.course_instructor ci
        INNER JOIN learning.instructor inst_i
            ON inst_i.id = ci.instructor_id
        INNER JOIN ${USER_TABLE} iu
            ON iu.id = inst_i.user_id
        WHERE ci.course_id = c.id
          AND ci.is_active = TRUE
          AND inst_i.soft_delete = FALSE
          AND iu.soft_delete = FALSE
        ORDER BY ci.is_primary DESC, ci.id ASC
        LIMIT 1
    ) inst ON TRUE
`;

const ENROLLMENT_SELECT = `
    SELECT
        e.id::text AS id,
        e.enrollment_number,
        e.student_id::text AS student_id,
        CONCAT_WS(
            ' ',
            NULLIF(BTRIM(u.first_name), ''),
            NULLIF(BTRIM(u.last_name), '')
        ) AS student_name,
        u.email AS student_email,
        s.student_code,
        s.register_number,
        s.institution_id::text AS institution_id,
        i.name AS institution_name,
        e.course_id::text AS course_id,
        c.course_code,
        c.title AS course_title,
        c.course_type,
        c.level,
        c.price,
        c.currency_code,
        inst.instructor_id::text AS instructor_id,
        inst.instructor_code,
        inst.instructor_name,
        e.enrollment_date,
        e.start_date,
        e.expected_completion_date,
        e.completed_at,
        e.status,
        e.last_accessed_at,
        e.created_at
    FROM ${ENROLLMENT_FROM}
`;

const USER_FROM = `
    ${USER_TABLE} u
    LEFT JOIN LATERAL (
        SELECT
            string_agg(DISTINCT r.code, ', ' ORDER BY r.code) AS roles,
            array_agg(DISTINCT r.code) AS role_codes
        FROM olp_auth.user_role ur
        INNER JOIN olp_auth.role r
            ON r.id = ur.role_id AND r.soft_delete = FALSE
        WHERE ur.user_id = u.id
          AND ur.soft_delete = FALSE
          AND ur.is_active = TRUE
    ) role_info ON TRUE
    LEFT JOIN LATERAL (
        SELECT s.student_code
        FROM learning.student s
        WHERE s.user_id = u.id AND s.soft_delete = FALSE
        ORDER BY s.id
        LIMIT 1
    ) student_info ON TRUE
    LEFT JOIN LATERAL (
        SELECT i.instructor_code
        FROM learning.instructor i
        WHERE i.user_id = u.id AND i.soft_delete = FALSE
        ORDER BY i.id
        LIMIT 1
    ) instructor_info ON TRUE
`;

const USER_SELECT = `
    SELECT
        u.id::text AS id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')))
            AS full_name,
        u.phone_number,
        u.is_active,
        u.is_locked,
        u.approval_status,
        u.email_verified_at,
        u.phone_verified_at,
        u.last_login_at,
        u.created_at,
        COALESCE(role_info.roles, '') AS roles,
        student_info.student_code,
        instructor_info.instructor_code
    FROM ${USER_FROM}
`;

function addSearch(conditions, values, columns, search) {
    if (!search) return;

    values.push(`%${search}%`);
    const index = values.length;

    conditions.push(
        `(${columns.map((column) => `${column} ILIKE $${index}`).join(" OR ")})`
    );
}

function addEquals(conditions, values, column, value, cast = "") {
    if (value === undefined || value === null || value === "") return;

    values.push(value);
    conditions.push(`${column} = $${values.length}${cast}`);
}

function addDateFrom(conditions, values, column, value) {
    if (!value) return;

    values.push(value);
    conditions.push(`${column} >= $${values.length}::date`);
}

function addDateTo(conditions, values, column, value) {
    if (!value) return;

    values.push(value);
    conditions.push(`${column} < ($${values.length}::date + INTERVAL '1 day')`);
}

function buildPayrollWhere(filters = {}) {
    const conditions = [
        "ip.soft_delete = FALSE",
        "p.soft_delete = FALSE",
        "i.soft_delete = FALSE",
        "u.soft_delete = FALSE"
    ];
    const values = [];

    addSearch(conditions, values, [
        "ip.payroll_number",
        "p.period_code",
        "i.instructor_code",
        "u.username",
        "u.email",
        "u.first_name",
        "u.last_name"
    ], filters.search);

    addEquals(conditions, values, "ip.payroll_period_id", filters.periodId, "::bigint");
    addEquals(conditions, values, "ip.instructor_id", filters.instructorId, "::bigint");
    addEquals(conditions, values, "ip.status", filters.status);

    return { conditions, values };
}

function buildEnrollmentWhere(filters = {}) {
    const conditions = [
        "e.soft_delete = FALSE",
        "s.soft_delete = FALSE",
        "u.soft_delete = FALSE"
    ];
    const values = [];

    addSearch(conditions, values, [
        "e.enrollment_number",
        "u.first_name",
        "u.last_name",
        "u.email",
        "s.student_code",
        "s.register_number",
        "c.course_code",
        "c.title",
        "inst.instructor_name"
    ], filters.search);

    addEquals(conditions, values, "e.status", filters.status);
    addEquals(conditions, values, "e.course_id", filters.courseId, "::bigint");
    addEquals(conditions, values, "s.institution_id", filters.institutionId, "::bigint");
    addDateFrom(conditions, values, "e.enrollment_date", filters.fromDate);
    addDateTo(conditions, values, "e.enrollment_date", filters.toDate);

    return { conditions, values };
}

function buildUserWhere(filters = {}) {
    const conditions = ["u.soft_delete = FALSE"];
    const values = [];

    addSearch(conditions, values, [
        "u.username",
        "u.email",
        "u.first_name",
        "u.last_name",
        "u.phone_number",
        "student_info.student_code",
        "instructor_info.instructor_code"
    ], filters.search);

    if (filters.isActive !== undefined && filters.isActive !== null) {
        values.push(filters.isActive);
        conditions.push(`u.is_active = $${values.length}`);
    }

    if (filters.isLocked !== undefined && filters.isLocked !== null) {
        values.push(filters.isLocked);
        conditions.push(`u.is_locked = $${values.length}`);
    }

    if (filters.approvalStatus) {
        values.push(filters.approvalStatus);
        conditions.push(`UPPER(u.approval_status) = UPPER($${values.length})`);
    }

    if (filters.role) {
        values.push(filters.role);
        conditions.push(`EXISTS (
            SELECT 1
            FROM olp_auth.user_role urf
            INNER JOIN olp_auth.role rf
                ON rf.id = urf.role_id AND rf.soft_delete = FALSE
            WHERE urf.user_id = u.id
              AND urf.soft_delete = FALSE
              AND urf.is_active = TRUE
              AND UPPER(rf.code) = UPPER($${values.length})
        )`);
    }

    return { conditions, values };
}

async function findPayrollReport({
    page = 1,
    limit = 20,
    search = "",
    periodId = null,
    instructorId = null,
    status = null
} = {}) {
    const { conditions, values } = buildPayrollWhere({
        search,
        periodId,
        instructorId,
        status
    });

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const offset = (page - 1) * limit;
    const dataValues = [...values, limit, offset];

    const [dataResult, countResult, summaryResult] = await Promise.all([
        pool.query(
            `${PAYROLL_SELECT}
             ${whereClause}
             ORDER BY p.period_start DESC, ip.id DESC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
            dataValues
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total
             FROM ${PAYROLL_FROM}
             ${whereClause}`,
            values
        ),
        pool.query(
            `SELECT
                COUNT(*)::int AS total_payrolls,
                COALESCE(SUM(ip.total_earnings), 0) AS total_earnings,
                COALESCE(SUM(ip.incentive_amount), 0) AS total_incentives,
                COALESCE(SUM(ip.total_deductions), 0) AS total_deductions,
                COALESCE(SUM(ip.net_amount), 0) AS total_net_amount,
                COALESCE(SUM(pay.paid_amount), 0) AS total_paid_amount,
                COUNT(*) FILTER (WHERE ip.status = 'DRAFT')::int AS draft_payrolls,
                COUNT(*) FILTER (WHERE ip.status = 'CALCULATED')::int AS calculated_payrolls,
                COUNT(*) FILTER (WHERE ip.status = 'APPROVED')::int AS approved_payrolls,
                COUNT(*) FILTER (WHERE ip.status = 'PAID')::int AS paid_payrolls,
                COUNT(*) FILTER (WHERE ip.status = 'CANCELLED')::int AS cancelled_payrolls
             FROM ${PAYROLL_FROM}
             ${whereClause}`,
            values
        )
    ]);

    const total = countResult.rows[0]?.total || 0;

    return {
        rows: dataResult.rows,
        summary: summaryResult.rows[0] || {},
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function findEnrollmentReport({
    page = 1,
    limit = 20,
    search = "",
    status = null,
    courseId = null,
    institutionId = null,
    fromDate = null,
    toDate = null
} = {}) {
    const { conditions, values } = buildEnrollmentWhere({
        search,
        status,
        courseId,
        institutionId,
        fromDate,
        toDate
    });

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const offset = (page - 1) * limit;
    const dataValues = [...values, limit, offset];

    const [dataResult, countResult, summaryResult] = await Promise.all([
        pool.query(
            `${ENROLLMENT_SELECT}
             ${whereClause}
             ORDER BY e.id DESC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
            dataValues
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total
             FROM ${ENROLLMENT_FROM}
             ${whereClause}`,
            values
        ),
        pool.query(
            `SELECT
                COUNT(*)::int AS total_enrollments,
                COUNT(DISTINCT e.student_id)::int AS total_students,
                COUNT(DISTINCT e.course_id)::int AS total_courses,
                COUNT(*) FILTER (WHERE UPPER(e.status) = 'ACTIVE')::int AS active_enrollments,
                COUNT(*) FILTER (WHERE UPPER(e.status) = 'COMPLETED')::int AS completed_enrollments,
                COUNT(*) FILTER (WHERE UPPER(e.status) = 'PENDING')::int AS pending_enrollments,
                COUNT(*) FILTER (WHERE UPPER(e.status) = 'CANCELLED')::int AS cancelled_enrollments,
                COALESCE(SUM(c.price), 0) AS total_course_value
             FROM ${ENROLLMENT_FROM}
             ${whereClause}`,
            values
        )
    ]);

    const total = countResult.rows[0]?.total || 0;

    return {
        rows: dataResult.rows,
        summary: summaryResult.rows[0] || {},
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function findUserReport({
    page = 1,
    limit = 20,
    search = "",
    role = null,
    isActive = null,
    isLocked = null,
    approvalStatus = null
} = {}) {
    const { conditions, values } = buildUserWhere({
        search,
        role,
        isActive,
        isLocked,
        approvalStatus
    });

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const offset = (page - 1) * limit;
    const dataValues = [...values, limit, offset];

    const [dataResult, countResult, summaryResult] = await Promise.all([
        pool.query(
            `${USER_SELECT}
             ${whereClause}
             ORDER BY u.id DESC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
            dataValues
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total
             FROM ${USER_FROM}
             ${whereClause}`,
            values
        ),
        pool.query(
            `SELECT
                COUNT(*)::int AS total_users,
                COUNT(*) FILTER (WHERE u.is_active)::int AS active_users,
                COUNT(*) FILTER (WHERE NOT u.is_active)::int AS inactive_users,
                COUNT(*) FILTER (WHERE u.is_locked)::int AS locked_users,
                COUNT(*) FILTER (WHERE UPPER(u.approval_status) = 'PENDING')::int AS pending_users,
                COUNT(*) FILTER (WHERE UPPER(u.approval_status) = 'APPROVED')::int AS approved_users,
                COUNT(*) FILTER (WHERE UPPER(u.approval_status) = 'REJECTED')::int AS rejected_users,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1
                    FROM olp_auth.user_role ura
                    INNER JOIN olp_auth.role ra
                        ON ra.id = ura.role_id AND ra.soft_delete = FALSE
                    WHERE ura.user_id = u.id
                      AND ura.soft_delete = FALSE
                      AND ura.is_active = TRUE
                      AND UPPER(ra.code) = 'ADMIN'
                ))::int AS admin_users,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1
                    FROM olp_auth.user_role urs
                    INNER JOIN olp_auth.role rs
                        ON rs.id = urs.role_id AND rs.soft_delete = FALSE
                    WHERE urs.user_id = u.id
                      AND urs.soft_delete = FALSE
                      AND urs.is_active = TRUE
                      AND UPPER(rs.code) = 'STUDENT'
                ))::int AS student_users,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1
                    FROM olp_auth.user_role uri
                    INNER JOIN olp_auth.role ri
                        ON ri.id = uri.role_id AND ri.soft_delete = FALSE
                    WHERE uri.user_id = u.id
                      AND uri.soft_delete = FALSE
                      AND uri.is_active = TRUE
                      AND UPPER(ri.code) = 'INSTRUCTOR'
                ))::int AS instructor_users
             FROM ${USER_FROM}
             ${whereClause}`,
            values
        )
    ]);

    const total = countResult.rows[0]?.total || 0;

    return {
        rows: dataResult.rows,
        summary: summaryResult.rows[0] || {},
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

module.exports = {
    findPayrollReport,
    findEnrollmentReport,
    findUserReport
};
