
const pool = require("../config/database");

const USER_TABLE = 'olp_auth."user"';

const RESOURCES = {
    compensation: {
        table: "payroll.instructor_course_compensation",
        alias: "c",
        instructorColumn: "c.instructor_id",
        select: `
            c.*,
            i.instructor_code,
            i.user_id AS instructor_user_id,
            iu.username AS instructor_username,
            iu.email AS instructor_email,
            iu.first_name AS instructor_first_name,
            iu.last_name AS instructor_last_name,
            TRIM(CONCAT(iu.first_name, ' ', COALESCE(iu.last_name, ''))) AS instructor_name,
            co.course_code,
            co.title AS course_title
        `,
        joins: `
            JOIN learning.instructor i
                ON i.id = c.instructor_id AND i.soft_delete = false
            JOIN ${USER_TABLE} iu
                ON iu.id = i.user_id AND iu.soft_delete = false
            JOIN learning.course co
                ON co.id = c.course_id AND co.soft_delete = false
        `,
        search: `
            LOWER(i.instructor_code) LIKE $SEARCH
            OR LOWER(iu.username) LIKE $SEARCH
            OR LOWER(iu.first_name) LIKE $SEARCH
            OR LOWER(iu.last_name) LIKE $SEARCH
            OR LOWER(co.course_code) LIKE $SEARCH
            OR LOWER(co.title) LIKE $SEARCH
        `,
        filters: {
            instructorId: "c.instructor_id",
            courseId: "c.course_id",
            isActive: "c.is_active"
        },
        columns: [
            "instructor_id", "course_id", "compensation_type",
            "fixed_amount", "commission_percentage",
            "currency_code",
            "effective_from", "effective_until", "is_active", "notes"
        ]
    },

    period: {
        table: "payroll.payroll_period",
        alias: "p",
        select: `
            p.*,
            EXISTS (
                SELECT 1
                FROM payroll.instructor_payroll generated
                WHERE generated.payroll_period_id = p.id
            ) AS has_payroll,
            EXISTS (
                SELECT 1
                FROM payroll.instructor_payroll generated
                WHERE generated.payroll_period_id = p.id
                  AND generated.status IN ('APPROVED', 'PAID', 'CANCELLED')
            ) AS payroll_review_locked,
            processor.id AS processed_by_user_id,
            processor.username AS processed_by_username,
            processor.first_name AS processed_by_first_name,
            processor.last_name AS processed_by_last_name,
            TRIM(CONCAT(
                processor.first_name, ' ',
                COALESCE(processor.last_name, '')
            )) AS processed_by_name,
            creator.username AS created_by_username
        `,
        joins: `
            LEFT JOIN ${USER_TABLE} processor
                ON processor.id = p.processed_by
            LEFT JOIN ${USER_TABLE} creator
                ON creator.id = p.created_by
        `,
        search: `
            LOWER(p.period_code) LIKE $SEARCH
            OR LOWER(processor.username) LIKE $SEARCH
            OR LOWER(processor.first_name) LIKE $SEARCH
        `,
        filters: {
            periodId: "p.id",
            status: "p.status",
            isActive: "p.is_active"
        },
        columns: [
            "period_code", "period_start", "period_end",
            "status", "processed_at", "processed_by", "is_active"
        ]
    },

    instructorPayroll: {
        table: "payroll.instructor_payroll",
        alias: "ip",
        instructorColumn: "ip.instructor_id",
        select: `
            ip.*,
            i.instructor_code,
            i.user_id AS instructor_user_id,
            iu.username AS instructor_username,
            iu.email AS instructor_email,
            iu.first_name AS instructor_first_name,
            iu.last_name AS instructor_last_name,
            TRIM(CONCAT(iu.first_name, ' ', COALESCE(iu.last_name, '')))
                AS instructor_name,

            p.period_code,
            p.period_start,
            p.period_end,

            approver.username AS approved_by_username,
            approver.first_name AS approved_by_first_name,
            approver.last_name AS approved_by_last_name,
            TRIM(CONCAT(
                approver.first_name, ' ',
                COALESCE(approver.last_name, '')
            )) AS approved_by_name
        `,
        joins: `
            JOIN learning.instructor i
                ON i.id = ip.instructor_id AND i.soft_delete = false
            JOIN ${USER_TABLE} iu
                ON iu.id = i.user_id AND iu.soft_delete = false
            JOIN payroll.payroll_period p
                ON p.id = ip.payroll_period_id AND p.soft_delete = false
            LEFT JOIN ${USER_TABLE} approver
                ON approver.id = ip.approved_by
        `,
        search: `
            LOWER(ip.payroll_number) LIKE $SEARCH
            OR LOWER(i.instructor_code) LIKE $SEARCH
            OR LOWER(iu.username) LIKE $SEARCH
            OR LOWER(iu.first_name) LIKE $SEARCH
            OR LOWER(iu.last_name) LIKE $SEARCH
            OR LOWER(p.period_code) LIKE $SEARCH
        `,
        filters: {
            instructorId: "ip.instructor_id",
            periodId: "ip.payroll_period_id",
            status: "ip.status"
        },
        columns: [
            "payroll_period_id", "instructor_id", "payroll_number",
            "total_earnings", "incentive_amount", "incentive_notes",
            "total_deductions", "net_amount",
            "currency_code", "status", "approved_at", "approved_by", "paid_at"
        ]
    },

    courseEarning: {
        table: "payroll.instructor_course_earning",
        alias: "e",
        instructorColumn: "e.instructor_id",
        select: `
            e.*,

            i.instructor_code,
            i.user_id AS instructor_user_id,
            iu.username AS instructor_username,
            iu.email AS instructor_email,
            iu.first_name AS instructor_first_name,
            iu.last_name AS instructor_last_name,
            TRIM(CONCAT(iu.first_name, ' ', COALESCE(iu.last_name, '')))
                AS instructor_name,

            co.course_code,
            co.title AS course_title,

            ip.payroll_number,
            ip.status AS payroll_status,
            ip.payroll_period_id,

            p.period_code,
            p.period_start,
            p.period_end,

            c.compensation_type,
            c.currency_code
        `,
        joins: `
            JOIN learning.instructor i
                ON i.id = e.instructor_id AND i.soft_delete = false
            JOIN ${USER_TABLE} iu
                ON iu.id = i.user_id AND iu.soft_delete = false
            JOIN learning.course co
                ON co.id = e.course_id AND co.soft_delete = false
            JOIN payroll.instructor_payroll ip
                ON ip.id = e.instructor_payroll_id AND ip.soft_delete = false
            JOIN payroll.payroll_period p
                ON p.id = ip.payroll_period_id AND p.soft_delete = false
            JOIN payroll.instructor_course_compensation c
                ON c.id = e.compensation_id AND c.soft_delete = false
        `,
        search: `
            LOWER(i.instructor_code) LIKE $SEARCH
            OR LOWER(iu.username) LIKE $SEARCH
            OR LOWER(iu.first_name) LIKE $SEARCH
            OR LOWER(co.course_code) LIKE $SEARCH
            OR LOWER(co.title) LIKE $SEARCH
            OR LOWER(ip.payroll_number) LIKE $SEARCH
            OR LOWER(p.period_code) LIKE $SEARCH
        `,
        filters: {
            instructorId: "e.instructor_id",
            courseId: "e.course_id",
            payrollId: "e.instructor_payroll_id",
            compensationId: "e.compensation_id"
        },
        columns: [
            "instructor_payroll_id", "instructor_id", "course_id",
            "compensation_id", "earning_type", "eligible_student_count",
            "gross_course_revenue",
            "eligible_course_revenue", "rate_percentage", "rate_amount",
            "fixed_amount", "commission_amount", "student_amount",
            "total_earning", "calculation_notes"
        ]
    },

    payment: {
        table: "payroll.payroll_payment",
        alias: "pay",
        instructorColumn: "ip.instructor_id",
        select: `
            pay.*,

            ip.payroll_number,
            ip.instructor_id,
            ip.payroll_period_id,
            ip.status AS payroll_status,

            i.instructor_code,
            i.user_id AS instructor_user_id,
            iu.username AS instructor_username,
            iu.email AS instructor_email,
            iu.first_name AS instructor_first_name,
            iu.last_name AS instructor_last_name,
            TRIM(CONCAT(iu.first_name, ' ', COALESCE(iu.last_name, '')))
                AS instructor_name,

            p.period_code,
            p.period_start,
            p.period_end
        `,
        joins: `
            JOIN payroll.instructor_payroll ip
                ON ip.id = pay.instructor_payroll_id AND ip.soft_delete = false
            JOIN learning.instructor i
                ON i.id = ip.instructor_id AND i.soft_delete = false
            JOIN ${USER_TABLE} iu
                ON iu.id = i.user_id AND iu.soft_delete = false
            JOIN payroll.payroll_period p
                ON p.id = ip.payroll_period_id AND p.soft_delete = false
        `,
        search: `
            LOWER(pay.payment_number) LIKE $SEARCH
            OR LOWER(ip.payroll_number) LIKE $SEARCH
            OR LOWER(i.instructor_code) LIKE $SEARCH
            OR LOWER(iu.username) LIKE $SEARCH
            OR LOWER(iu.first_name) LIKE $SEARCH
            OR LOWER(p.period_code) LIKE $SEARCH
        `,
        filters: {
            payrollId: "pay.instructor_payroll_id",
            instructorId: "ip.instructor_id",
            status: "pay.status"
        },
        columns: [
            "instructor_payroll_id", "payment_number",
            "payment_method", "payment_gateway", "amount",
            "currency_code", "bank_reference", "status",
            "initiated_at", "processed_at", "failed_at", "failure_reason"
        ]
    }
};

const getResource = (type) => {
    const resource = RESOURCES[type];
    if (!resource) throw new Error("Invalid payroll resource.");
    return resource;
};

const getClient = (client) => client || pool;

const getById = async (type, id, client) => {
    const r = getResource(type);

    const result = await getClient(client).query(
        `SELECT ${r.select}
         FROM ${r.table} ${r.alias}
         ${r.joins}
         WHERE ${r.alias}.id = $1
           AND ${r.alias}.soft_delete = false`,
        [id]
    );

    return result.rows[0] || null;
};

const getByIdForInstructor = async (type, id, instructorId, client) => {
    const r = getResource(type);

    if (!r.instructorColumn) {
        throw new Error("Resource is not instructor scoped.");
    }

    const visibilityCondition = type === "instructorPayroll"
        ? "AND ip.status IN ('APPROVED', 'PAID', 'CANCELLED')"
        : type === "courseEarning"
            ? "AND ip.status IN ('APPROVED', 'PAID')"
            : "";

    const result = await getClient(client).query(
        `SELECT ${r.select}
         FROM ${r.table} ${r.alias}
         ${r.joins}
         WHERE ${r.alias}.id = $1
           AND ${r.instructorColumn} = $2
           AND ${r.alias}.soft_delete = false
           ${visibilityCondition}`,
        [id, instructorId]
    );

    return result.rows[0] || null;
};

const getAll = async (type, query = {}, client) => {
    const r = getResource(type);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = [`${r.alias}.soft_delete = false`];
    const values = [];

    const addCondition = (sql, value) => {
        values.push(value);
        conditions.push(sql.replace("?", `$${values.length}`));
    };

    for (const [key, column] of Object.entries(r.filters)) {
        if (query[key] !== undefined && query[key] !== "") {
            addCondition(`${column} = ?`, query[key]);
        }
    }

    if (query.selfService && type === "instructorPayroll") {
        conditions.push("ip.status IN ('APPROVED', 'PAID', 'CANCELLED')");
    } else if (query.selfService && type === "courseEarning") {
        conditions.push("ip.status IN ('APPROVED', 'PAID')");
    }

    if (query.search) {
        values.push(`%${String(query.search).toLowerCase()}%`);
        conditions.push(
            r.search.replaceAll("$SEARCH", `$${values.length}`)
        );
    }

    const where = conditions.join(" AND ");

    const dataValues = [...values, limit, offset];

    const [dataResult, countResult] = await Promise.all([
        getClient(client).query(
            `SELECT ${r.select}
             FROM ${r.table} ${r.alias}
             ${r.joins}
             WHERE ${where}
             ORDER BY ${r.alias}.created_at DESC, ${r.alias}.id DESC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
            dataValues
        ),
        getClient(client).query(
            `SELECT COUNT(*) AS total
             FROM ${r.table} ${r.alias}
             ${r.joins}
             WHERE ${where}`,
            values
        )
    ]);

    const total = countResult.rows[0].total;

    return {
        data: dataResult.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(Number(total) / limit)
        }
    };
};

const create = async (type, payload, userId, client) => {
    const r = getResource(type);

    const keys = Object.keys(payload).filter((key) => r.columns.includes(key));
    if (!keys.length) throw new Error("No valid fields supplied.");

    const values = keys.map((key) => payload[key]);

    if (userId !== undefined && userId !== null) {
        keys.push("created_by");
        values.push(userId);
    }

    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const result = await getClient(client).query(
        `INSERT INTO ${r.table} (${keys.join(", ")})
         VALUES (${placeholders.join(", ")})
         RETURNING id`,
        values
    );

    return getById(type, result.rows[0].id, client);
};

const update = async (type, id, payload, userId, client) => {
    const r = getResource(type);

    const keys = Object.keys(payload).filter(
        (key) => r.columns.includes(key) && key !== "created_by"
    );

    const values = keys.map((key) => payload[key]);
    const assignments = keys.map((key, i) => `${key} = $${i + 1}`);

    if (userId !== undefined && userId !== null) {
        values.push(userId);
        assignments.push(`updated_by = $${values.length}`);
    }

    if (!assignments.length) return getById(type, id, client);

    values.push(id);

    await getClient(client).query(
        `UPDATE ${r.table}
         SET ${assignments.join(", ")}, updated_at = NOW()
         WHERE id = $${values.length} AND soft_delete = false`,
        values
    );

    return getById(type, id, client);
};

const remove = async (type, id, userId, client) => {
    const r = getResource(type);

    const result = await getClient(client).query(
        `UPDATE ${r.table}
         SET soft_delete = true,
             updated_by = $1,
             updated_at = NOW()
         WHERE id = $2 AND soft_delete = false
         RETURNING id`,
        [userId, id]
    );

    return result.rowCount > 0;
};

const getInstructorIdByUserId = async (userId, client) => {
    const result = await getClient(client).query(
        `SELECT id
         FROM learning.instructor
         WHERE user_id = $1
           AND soft_delete = false
           AND is_active = true
         LIMIT 1`,
        [userId]
    );

    return result.rows[0]?.id || null;
};

const getInstructorCourses = async (instructorId, client) => {
    const result = await getClient(client).query(
        `SELECT DISTINCT
            c.id,
            c.course_code,
            c.title AS course_title
         FROM learning.course c
         JOIN learning.course_instructor ci
           ON ci.course_id = c.id
          AND ci.instructor_id = $1
          AND ci.is_active = TRUE
         WHERE c.soft_delete = FALSE
         ORDER BY c.title, c.id`,
        [instructorId]
    );

    return result.rows;
};

const isCourseAssignedToInstructor = async (courseId, instructorId, client) => {
    const result = await getClient(client).query(
        `SELECT 1
         FROM learning.course c
         JOIN learning.course_instructor ci
           ON ci.course_id = c.id
          AND ci.instructor_id = $2
          AND ci.is_active = TRUE
         WHERE c.id = $1
           AND c.soft_delete = FALSE
         LIMIT 1`,
        [courseId, instructorId]
    );

    return result.rowCount > 0;
};

const getInstructorOverview = async (instructorId) => {
    const result = await pool.query(
        `SELECT
            i.id AS instructor_id,
            i.instructor_code,
            i.user_id AS instructor_user_id,
            u.username AS instructor_username,
            u.email AS instructor_email,
            u.first_name AS instructor_first_name,
            u.last_name AS instructor_last_name,
            TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')))
                AS instructor_name,

            COUNT(DISTINCT ip.id) AS payroll_count,
            COALESCE(SUM(ip.total_earnings), 0) AS total_earnings,
            COALESCE(SUM(ip.incentive_amount), 0) AS total_incentives,
            COALESCE(SUM(ip.total_deductions), 0) AS total_deductions,
            COALESCE(SUM(ip.net_amount), 0) AS net_amount,

            COALESCE((
                SELECT SUM(pay.amount)
                FROM payroll.payroll_payment pay
                JOIN payroll.instructor_payroll pip
                  ON pip.id = pay.instructor_payroll_id
                WHERE pip.instructor_id = i.id
                  AND pip.soft_delete = false
                  AND pay.soft_delete = false
                  AND pay.status = 'SUCCESS'
            ), 0) AS paid_amount

         FROM learning.instructor i
         JOIN ${USER_TABLE} u ON u.id = i.user_id
         LEFT JOIN payroll.instructor_payroll ip
           ON ip.instructor_id = i.id
          AND ip.soft_delete = false
          AND ip.status IN ('APPROVED', 'PAID')
         WHERE i.id = $1
           AND i.soft_delete = false
         GROUP BY i.id, u.id`,
        [instructorId]
    );

    return result.rows[0] || null;
};

const getReports = async (filters = {}) => {
    const values = [];
    const conditions = [
        "ip.soft_delete = false",
        "p.soft_delete = false",
        "ip.status IN ('APPROVED', 'PAID')"
    ];

    if (filters.periodId) {
        values.push(filters.periodId);
        conditions.push(`ip.payroll_period_id = $${values.length}`);
    }

    if (filters.instructorId) {
        values.push(filters.instructorId);
        conditions.push(`ip.instructor_id = $${values.length}`);
    }

    if (filters.courseId) {
        values.push(filters.courseId);
        conditions.push(`EXISTS (
            SELECT 1
            FROM payroll.instructor_course_earning report_earning
            WHERE report_earning.instructor_payroll_id = ip.id
              AND report_earning.course_id = $${values.length}
              AND report_earning.soft_delete = false
        )`);
    }

    const result = await pool.query(
        `SELECT
            ip.id AS instructor_payroll_id,
            ip.payroll_number,
            ip.payroll_period_id,
            p.period_code,
            p.period_start,
            p.period_end,

            ip.instructor_id,
            i.instructor_code,
            i.user_id AS instructor_user_id,
            u.username AS instructor_username,
            u.email AS instructor_email,
            u.first_name AS instructor_first_name,
            u.last_name AS instructor_last_name,
            TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')))
                AS instructor_name,

            ip.total_earnings,
            ip.incentive_amount,
            ip.incentive_notes,
            ip.total_deductions,
            ip.net_amount,
            ip.currency_code,
            ip.status,
            payment.payment_number,
            payment.status AS payment_status,
            payment.payment_method,
            payment.bank_reference,
            payment.processed_at AS payment_processed_at

         FROM payroll.instructor_payroll ip
         JOIN payroll.payroll_period p ON p.id = ip.payroll_period_id
         JOIN learning.instructor i ON i.id = ip.instructor_id
         JOIN ${USER_TABLE} u ON u.id = i.user_id
         LEFT JOIN LATERAL (
            SELECT
                attempt.payment_number,
                attempt.status,
                attempt.payment_method,
                attempt.bank_reference,
                attempt.processed_at
            FROM payroll.payroll_payment attempt
            WHERE attempt.instructor_payroll_id = ip.id
              AND attempt.soft_delete = false
            ORDER BY
                CASE WHEN attempt.status = 'SUCCESS' THEN 0 ELSE 1 END,
                attempt.id DESC
            LIMIT 1
         ) payment ON TRUE
         WHERE ${conditions.join(" AND ")}
         ORDER BY p.period_start DESC, ip.id DESC`,
        values
    );

    return result.rows;
};

const getPayslip = async (payrollId, instructorId) => {
    const payroll = await getById("instructorPayroll", payrollId);

    if (
        !payroll ||
        String(payroll.instructor_id) !== String(instructorId) ||
        !["APPROVED", "PAID"].includes(payroll.status)
    ) {
        return null;
    }

    const earnings = await pool.query(
        `SELECT
            e.*,
            e.instructor_id,
            i.instructor_code,
            u.username AS instructor_username,
            TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')))
                AS instructor_name,
            e.course_id,
            co.course_code,
            co.title AS course_title,
            e.compensation_id,
            c.compensation_type,
            ip.payroll_number,
            ip.payroll_period_id,
            p.period_code
         FROM payroll.instructor_course_earning e
         JOIN learning.instructor i ON i.id = e.instructor_id
         JOIN ${USER_TABLE} u ON u.id = i.user_id
         JOIN learning.course co ON co.id = e.course_id
         JOIN payroll.instructor_course_compensation c
           ON c.id = e.compensation_id
         JOIN payroll.instructor_payroll ip
           ON ip.id = e.instructor_payroll_id
         JOIN payroll.payroll_period p
           ON p.id = ip.payroll_period_id
         WHERE e.instructor_payroll_id = $1
           AND e.instructor_id = $2
           AND e.soft_delete = false
         ORDER BY e.id`,
        [payrollId, instructorId]
    );

    const payments = await pool.query(
        `SELECT
            pay.*,
            ip.payroll_number,
            ip.instructor_id,
            i.instructor_code,
            u.username AS instructor_username,
            TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')))
                AS instructor_name,
            ip.payroll_period_id,
            p.period_code
         FROM payroll.payroll_payment pay
         JOIN payroll.instructor_payroll ip
           ON ip.id = pay.instructor_payroll_id
         JOIN learning.instructor i ON i.id = ip.instructor_id
         JOIN ${USER_TABLE} u ON u.id = i.user_id
         JOIN payroll.payroll_period p ON p.id = ip.payroll_period_id
         WHERE pay.instructor_payroll_id = $1
           AND pay.soft_delete = false
         ORDER BY pay.id`,
        [payrollId]
    );

    return {
        payroll,
        earnings: earnings.rows,
        payments: payments.rows
    };
};

const payrollWorkflowError = (message, statusCode = 409) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const calculatePayrollPeriod = async (periodId, userId) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(937512, 1)");

        const periodResult = await client.query(
            `SELECT id, period_code, period_start, period_end, status, is_active
             FROM payroll.payroll_period
             WHERE id = $1 AND soft_delete = FALSE
             FOR UPDATE`,
            [periodId]
        );
        const period = periodResult.rows[0];

        if (!period) throw payrollWorkflowError("Payroll period not found.", 404);
        if (!period.is_active) {
            throw payrollWorkflowError("Activate this payroll period before calculating it.");
        }
        if (["APPROVED", "CLOSED"].includes(period.status)) {
            throw payrollWorkflowError("An approved or closed payroll period cannot be recalculated.");
        }

        const existingPayrollsResult = await client.query(
            `SELECT id, instructor_id, status, total_deductions,
                    incentive_amount, incentive_notes, soft_delete
             FROM payroll.instructor_payroll
             WHERE payroll_period_id = $1
             FOR UPDATE`,
            [periodId]
        );
        if (existingPayrollsResult.rows.some((row) =>
            ["APPROVED", "PAID"].includes(row.status)
        )) {
            throw payrollWorkflowError(
                "This period has approved or paid payrolls. Recalculation is locked."
            );
        }

        await client.query(
            `UPDATE payroll.instructor_referral_earning
             SET instructor_payroll_id = NULL, status = 'PENDING',
                 updated_at = NOW(), updated_by = $2
             WHERE instructor_payroll_id = ANY($1::bigint[])
               AND status = 'INCLUDED'
               AND soft_delete = FALSE`,
            [existingPayrollsResult.rows.map((row) => row.id), userId]
        );

        await client.query(
            `UPDATE payroll.payroll_period
             SET status = 'PROCESSING', updated_at = NOW(), updated_by = $2
             WHERE id = $1`,
            [periodId, userId]
        );

        const rulesResult = await client.query(
            `WITH net_payment AS (
                SELECT
                    pay.id,
                    pay.enrollment_id,
                    pay.course_id,
                    pay.original_amount,
                    pay.paid_at,
                    GREATEST(
                        pay.paid_amount - COALESCE(refunds.refunded_amount, 0),
                        0
                    ) AS net_amount
                FROM payment.payment pay
                LEFT JOIN LATERAL (
                    SELECT SUM(refund.refund_amount) AS refunded_amount
                    FROM payment.payment_refund refund
                    WHERE refund.payment_id = pay.id
                      AND refund.status = 'SUCCESS'
                      AND refund.soft_delete = FALSE
                ) refunds ON TRUE
                WHERE pay.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
                  AND pay.soft_delete = FALSE
                  AND pay.paid_at IS NOT NULL
            ),
            course_revenue AS (
                SELECT
                    enrollment.course_id,
                    SUM(payment.original_amount) FILTER (
                        WHERE payment.paid_at >= $1::date
                          AND payment.paid_at < ($2::date + INTERVAL '1 day')
                    ) AS gross_revenue,
                    SUM(payment.net_amount) FILTER (
                        WHERE payment.paid_at >= $1::date
                          AND payment.paid_at < ($2::date + INTERVAL '1 day')
                    ) AS eligible_revenue
                FROM net_payment payment
                JOIN learning.enrollment enrollment
                  ON enrollment.id = payment.enrollment_id
                 AND enrollment.soft_delete = FALSE
                 AND enrollment.status IN ('ACTIVE', 'COMPLETED')
                GROUP BY enrollment.course_id
            ),
            eligible_students AS (
                SELECT
                    enrollment.course_id,
                    enrollment.referred_by_instructor_id,
                    COUNT(DISTINCT enrollment.id)::int AS student_count
                FROM learning.enrollment enrollment
                WHERE enrollment.soft_delete = FALSE
                  AND enrollment.status IN ('ACTIVE', 'COMPLETED')
                  AND enrollment.referred_by_instructor_id IS NOT NULL
                  AND enrollment.enrollment_date >= $1::date
                  AND enrollment.enrollment_date < ($2::date + INTERVAL '1 day')
                  AND EXISTS (
                      SELECT 1 FROM net_payment payment
                      WHERE payment.enrollment_id = enrollment.id
                        AND payment.paid_at < ($2::date + INTERVAL '1 day')
                        AND payment.net_amount > 0
                  )
                GROUP BY enrollment.course_id, enrollment.referred_by_instructor_id
            )
            SELECT
                compensation.id AS compensation_id,
                compensation.instructor_id,
                compensation.course_id,
                compensation.compensation_type,
                compensation.fixed_amount,
                compensation.commission_percentage,
                compensation.currency_code,
                course.currency_code AS course_currency_code,
                course.course_code,
                course.title AS course_title,
                instructor.instructor_code,
                COALESCE(eligible.student_count, 0)::int AS eligible_student_count,
                COALESCE(revenue.gross_revenue, 0)::numeric(12,2) AS gross_course_revenue,
                COALESCE(revenue.eligible_revenue, 0)::numeric(12,2) AS eligible_course_revenue
            FROM payroll.instructor_course_compensation compensation
            JOIN learning.instructor instructor
              ON instructor.id = compensation.instructor_id
             AND instructor.is_active = TRUE
             AND instructor.soft_delete = FALSE
            JOIN learning.course course
              ON course.id = compensation.course_id
             AND course.soft_delete = FALSE
            LEFT JOIN eligible_students eligible
              ON eligible.course_id = compensation.course_id
             AND eligible.referred_by_instructor_id = compensation.instructor_id
            LEFT JOIN course_revenue revenue ON revenue.course_id = compensation.course_id
            WHERE compensation.is_active = TRUE
              AND compensation.soft_delete = FALSE
              AND compensation.compensation_type IN (
                  'FIXED', 'COMMISSION', 'FIXED_PLUS_COMMISSION', 'FIXED_PLUS_PER_STUDENT'
              )
              AND compensation.effective_from <= $1::date
              AND (compensation.effective_until IS NULL OR compensation.effective_until >= $2::date)
            ORDER BY compensation.instructor_id, compensation.course_id, compensation.id
            FOR UPDATE OF compensation`,
            [period.period_start, period.period_end]
        );

        const instructors = new Map();
        const courseRules = new Set();
        const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

        for (const rule of rulesResult.rows) {
            if (String(rule.currency_code).toUpperCase() !== String(rule.course_currency_code).toUpperCase()) {
                throw payrollWorkflowError(
                    `Compensation currency must match the course currency for ${rule.course_code}.`
                );
            }

            const ruleKey = `${rule.instructor_id}:${rule.course_id}`;
            if (courseRules.has(ruleKey)) {
                throw payrollWorkflowError(
                    `More than one active compensation rule covers ${rule.course_code} for this period. Fix the overlapping rules first.`
                );
            }
            courseRules.add(ruleKey);

            const type = String(rule.compensation_type).toUpperCase();
            const fixedAmount = ["FIXED", "FIXED_PLUS_COMMISSION", "FIXED_PLUS_PER_STUDENT"].includes(type)
                ? roundMoney(rule.fixed_amount)
                : 0;
            const commissionRate = ["COMMISSION", "FIXED_PLUS_COMMISSION"].includes(type)
                ? Number(rule.commission_percentage || 0)
                : null;
            const commissionAmount = commissionRate === null
                ? 0
                : roundMoney(Number(rule.eligible_course_revenue) * commissionRate / 100);
            const baseEarning = roundMoney(fixedAmount + commissionAmount);
            const totalEarning = baseEarning;

            const instructorKey = String(rule.instructor_id);
            const group = instructors.get(instructorKey) || {
                instructor_id: instructorKey,
                currency_code: String(rule.currency_code).toUpperCase(),
                total_earnings: 0,
                incentive_amount: 0,
                incentive_lines: [],
                referral_earning_ids: [],
                earnings: []
            };
            if (group.currency_code !== String(rule.currency_code).toUpperCase()) {
                throw payrollWorkflowError(
                    `Instructor ${rule.instructor_code} has compensation rules in multiple currencies. Use one currency per payroll period.`
                );
            }

            group.total_earnings = roundMoney(group.total_earnings + baseEarning);
            group.earnings.push({
                compensation_id: rule.compensation_id,
                course_id: rule.course_id,
                earning_type: type,
                eligible_student_count: Number(rule.eligible_student_count),
                gross_course_revenue: roundMoney(rule.gross_course_revenue),
                eligible_course_revenue: roundMoney(rule.eligible_course_revenue),
                rate_percentage: commissionRate,
                rate_amount: null,
                fixed_amount: fixedAmount,
                commission_amount: commissionAmount,
                student_amount: 0,
                total_earning: totalEarning,
                calculation_notes: "Course compensation from eligible paid transactions in the payroll period."
            });
            instructors.set(instructorKey, group);
        }

        const referralEarningsResult = await client.query(
            `SELECT earning.id, earning.instructor_id, earning.course_id,
                    earning.incentive_amount, earning.referral_code_snapshot,
                    course.currency_code, course.course_code, course.title AS course_title
             FROM payroll.instructor_referral_earning earning
             JOIN learning.course course ON course.id = earning.course_id
             JOIN payment.payment paid ON paid.id = earning.payment_id
             LEFT JOIN LATERAL (
                 SELECT SUM(refund.refund_amount) AS refunded_amount
                 FROM payment.payment_refund refund
                 WHERE refund.payment_id = paid.id
                   AND refund.status = 'SUCCESS'
                   AND refund.soft_delete = FALSE
             ) refunds ON TRUE
             WHERE earning.status = 'PENDING'
                AND earning.soft_delete = FALSE
                -- Settle every unpaid referral incentive earned up to the
                -- period end. This catches incentives created after an
                -- earlier period was already locked or paid.
                AND earning.earned_at < ($1::date + INTERVAL '1 day')
                AND paid.status IN ('PAID', 'PARTIALLY_REFUNDED')
                AND paid.soft_delete = FALSE
                AND GREATEST(paid.paid_amount - COALESCE(refunds.refunded_amount, 0), 0) > 0
             ORDER BY earning.instructor_id, earning.course_id, earning.id
             FOR UPDATE OF earning`,
            [period.period_end]
        );

        for (const earning of referralEarningsResult.rows) {
            const instructorKey = String(earning.instructor_id);
            const earningCurrency = String(earning.currency_code || "INR").toUpperCase();
            const group = instructors.get(instructorKey) || {
                instructor_id: instructorKey,
                currency_code: earningCurrency,
                total_earnings: 0,
                incentive_amount: 0,
                incentive_lines: [],
                referral_earning_ids: [],
                earnings: []
            };
            if (group.currency_code !== earningCurrency) {
                throw payrollWorkflowError(
                    `Instructor ${instructorKey} has referral incentives in multiple currencies for this period.`
                );
            }
            const amount = roundMoney(earning.incentive_amount);
            group.incentive_amount = roundMoney(group.incentive_amount + amount);
            group.referral_earning_ids.push(earning.id);
            group.incentive_lines.push(
                `${earning.course_code}: referral enrollment ${earning.referral_code_snapshot} = ${amount} ${earningCurrency}`
            );
            instructors.set(instructorKey, group);
        }

        if (!instructors.size) {
            throw payrollWorkflowError(
                "No course compensation or pending referral incentives cover this period."
            );
        }

        const existingByInstructor = new Map(
            existingPayrollsResult.rows.map((row) => [String(row.instructor_id), row])
        );
        let courseEarningCount = 0;
        let payrollTotal = 0;
        let incentiveTotal = 0;
        let deductionTotal = 0;

        for (const group of instructors.values()) {
            const existing = existingByInstructor.get(group.instructor_id);
            const deductions = Number(existing?.total_deductions || 0);
            const incentiveNotes = group.incentive_lines.length
                ? `Referral incentives from paid enrollments: ${group.incentive_lines.join("; ")}.`
                : null;
            if (deductions > group.total_earnings + group.incentive_amount) {
                throw payrollWorkflowError(
                    `Existing deductions exceed recalculated earnings for instructor ${group.instructor_id}. Adjust the deductions before recalculating.`
                );
            }

            let payrollId;
            if (existing) {
                payrollId = existing.id;
                await client.query(
                    `UPDATE payroll.instructor_course_earning
                     SET soft_delete = TRUE, updated_at = NOW(), updated_by = $2
                     WHERE instructor_payroll_id = $1 AND soft_delete = FALSE`,
                    [payrollId, userId]
                );
                await client.query(
                    `UPDATE payroll.instructor_payroll
                     SET total_earnings = $1,
                         incentive_amount = $2,
                         incentive_notes = $3,
                         total_deductions = $4,
                         net_amount = $5,
                         currency_code = $6,
                         status = 'CALCULATED',
                         approved_at = NULL,
                         approved_by = NULL,
                         paid_at = NULL,
                         soft_delete = FALSE,
                         updated_at = NOW(),
                         updated_by = $7
                     WHERE id = $8`,
                    [group.total_earnings, group.incentive_amount, incentiveNotes,
                        deductions,
                        roundMoney(group.total_earnings + group.incentive_amount - deductions),
                        group.currency_code, userId, payrollId]
                );
            } else {
                const inserted = await client.query(
                    `INSERT INTO payroll.instructor_payroll
                        (payroll_period_id, instructor_id, payroll_number,
                         total_earnings, incentive_amount, incentive_notes,
                         total_deductions, net_amount,
                         currency_code, status, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'CALCULATED', $9)
                     RETURNING id`,
                    [periodId, group.instructor_id, `PAY-${periodId}-${group.instructor_id}`,
                        group.total_earnings, group.incentive_amount, incentiveNotes,
                        roundMoney(group.total_earnings + group.incentive_amount),
                        group.currency_code, userId]
                );
                payrollId = inserted.rows[0].id;
            }

            for (const earning of group.earnings) {
                await client.query(
                    `INSERT INTO payroll.instructor_course_earning
                        (instructor_payroll_id, instructor_id, course_id, compensation_id,
                         earning_type, eligible_student_count,
                         gross_course_revenue, eligible_course_revenue, rate_percentage,
                         rate_amount, fixed_amount, commission_amount, student_amount,
                         total_earning, calculation_notes, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                    [payrollId, group.instructor_id, earning.course_id, earning.compensation_id,
                        earning.earning_type, earning.eligible_student_count,
                        earning.gross_course_revenue, earning.eligible_course_revenue, earning.rate_percentage,
                        earning.rate_amount, earning.fixed_amount, earning.commission_amount,
                        earning.student_amount, earning.total_earning, earning.calculation_notes, userId]
                );
                courseEarningCount += 1;
            }

            if (group.referral_earning_ids.length) {
                const includedReferralEarnings = await client.query(
                    `UPDATE payroll.instructor_referral_earning
                     SET instructor_payroll_id = $1, status = 'INCLUDED',
                         updated_at = NOW(), updated_by = $2
                     WHERE id = ANY($3::bigint[])
                       AND status = 'PENDING'
                       AND soft_delete = FALSE
                     RETURNING id`,
                    [payrollId, userId, group.referral_earning_ids]
                );
                if (includedReferralEarnings.rowCount !== group.referral_earning_ids.length) {
                    throw payrollWorkflowError(
                        `Referral earnings for instructor ${group.instructor_id} changed during payroll calculation. Recalculate the period.`
                    );
                }
            }

            payrollTotal = roundMoney(payrollTotal + group.total_earnings);
            incentiveTotal = roundMoney(incentiveTotal + group.incentive_amount);
            deductionTotal = roundMoney(deductionTotal + deductions);
            existingByInstructor.delete(group.instructor_id);
        }

        // If a rule was deactivated before approval, remove that draft payroll's
        // calculated lines so a rerun cannot leave an obsolete amount to approve.
        for (const stalePayroll of existingByInstructor.values()) {
            await client.query(
                `UPDATE payroll.instructor_course_earning
                 SET soft_delete = TRUE, updated_at = NOW(), updated_by = $2
                 WHERE instructor_payroll_id = $1 AND soft_delete = FALSE`,
                [stalePayroll.id, userId]
            );
            await client.query(
                `UPDATE payroll.instructor_payroll
                 SET total_earnings = 0, incentive_amount = 0,
                     incentive_notes = NULL, total_deductions = 0, net_amount = 0,
                     status = 'CALCULATED', updated_at = NOW(), updated_by = $1
                 WHERE id = $2`,
                [userId, stalePayroll.id]
            );
        }

        await client.query(
            `UPDATE payroll.payroll_period
             SET status = 'PROCESSED', processed_at = NOW(), processed_by = $2,
                 updated_at = NOW(), updated_by = $2
             WHERE id = $1`,
            [periodId, userId]
        );

        await client.query("COMMIT");
        return {
            period_id: String(periodId),
            period_code: period.period_code,
            payroll_count: instructors.size,
            course_earning_count: courseEarningCount,
            total_earnings: payrollTotal,
            total_incentives: incentiveTotal,
            total_deductions: deductionTotal,
            total_payable: roundMoney(payrollTotal + incentiveTotal - deductionTotal),
            status: "PROCESSED"
        };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

const initiatePayrollPayment = async (payload, userId) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const payrollResult = await client.query(
            `SELECT id, net_amount, currency_code, status
             FROM payroll.instructor_payroll
             WHERE id = $1 AND soft_delete = FALSE
             FOR UPDATE`,
            [payload.instructor_payroll_id]
        );
        const payroll = payrollResult.rows[0];
        if (!payroll) throw payrollWorkflowError("Instructor payroll not found.", 404);
        if (payroll.status !== "APPROVED") {
            throw payrollWorkflowError("Payment can only be initiated for an approved payroll.");
        }
        if (Number(payroll.net_amount) <= 0) {
            throw payrollWorkflowError("Payroll net amount must be greater than zero before payment.");
        }

        const activePayment = await client.query(
            `SELECT id, status FROM payroll.payroll_payment
             WHERE instructor_payroll_id = $1
               AND soft_delete = FALSE
               AND status IN ('INITIATED', 'PROCESSING', 'SUCCESS')
             LIMIT 1
             FOR UPDATE`,
            [payroll.id]
        );
        if (activePayment.rowCount) {
            throw payrollWorkflowError(
                activePayment.rows[0].status === "SUCCESS"
                    ? "This payroll has already been paid."
                    : "A payment attempt is already active for this payroll."
            );
        }

        const attemptResult = await client.query(
            `SELECT COUNT(*)::int AS attempt_count
             FROM payroll.payroll_payment
             WHERE instructor_payroll_id = $1`,
            [payroll.id]
        );
        const paymentNumber = `PAY-${payroll.id}-${Number(attemptResult.rows[0].attempt_count) + 1}`;
        const inserted = await client.query(
            `INSERT INTO payroll.payroll_payment
                (instructor_payroll_id, payment_number, payment_method, payment_gateway,
                 amount, currency_code, bank_reference, status, initiated_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'INITIATED', NOW(), $8)
             RETURNING id`,
            [payroll.id, paymentNumber, payload.payment_method, payload.payment_gateway || null,
                payroll.net_amount, payroll.currency_code, payload.bank_reference || null, userId]
        );
        const record = await getById("payment", inserted.rows[0].id, client);
        await client.query("COMMIT");
        return record;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

const updatePayrollPayment = async (id, payload, expectedStatus, userId) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const paymentReference = await client.query(
            `SELECT id, instructor_payroll_id
             FROM payroll.payroll_payment
             WHERE id = $1 AND soft_delete = FALSE`,
            [id]
        );
        const reference = paymentReference.rows[0];
        if (!reference) throw payrollWorkflowError("Record not found.", 404);

        const payrollResult = await client.query(
            `SELECT id, status, net_amount
             FROM payroll.instructor_payroll
             WHERE id = $1 AND soft_delete = FALSE
             FOR UPDATE`,
            [reference.instructor_payroll_id]
        );
        const payroll = payrollResult.rows[0];
        if (!payroll) throw payrollWorkflowError("Instructor payroll not found.", 404);

        const paymentResult = await client.query(
            `SELECT id, instructor_payroll_id, status
             FROM payroll.payroll_payment
             WHERE id = $1 AND soft_delete = FALSE
             FOR UPDATE`,
            [id]
        );
        const payment = paymentResult.rows[0];
        if (!payment) throw payrollWorkflowError("Record not found.", 404);
        if (payment.status !== expectedStatus) {
            throw payrollWorkflowError("This payment was updated by another user. Refresh and try again.");
        }
        if (payment.status === "SUCCESS") {
            throw payrollWorkflowError("Successful payment cannot be edited.");
        }

        if (payload.status === "SUCCESS") {
            if (payroll.status !== "APPROVED") {
                throw payrollWorkflowError("Only an approved payroll can be marked paid.");
            }
            if (Number(payroll.net_amount) <= 0) {
                throw payrollWorkflowError("Payroll net amount must be greater than zero.");
            }
        }

        await update("payment", id, payload, userId, client);

        if (payload.status === "SUCCESS") {
            const payrollUpdate = await client.query(
                `UPDATE payroll.instructor_payroll
                 SET status = 'PAID', paid_at = NOW(), updated_at = NOW(), updated_by = $1
                 WHERE id = $2 AND status = 'APPROVED'`,
                [userId, payment.instructor_payroll_id]
            );
            if (payrollUpdate.rowCount !== 1) {
                throw payrollWorkflowError("Payment succeeded but payroll status could not be finalized.");
            }
            await client.query(
                `UPDATE payroll.instructor_referral_earning
                 SET status = 'PAID', updated_at = NOW(), updated_by = $1
                 WHERE instructor_payroll_id = $2
                   AND status = 'INCLUDED'
                   AND soft_delete = FALSE`,
                [userId, payment.instructor_payroll_id]
            );
        }

        const record = await getById("payment", id, client);
        await client.query("COMMIT");
        return record;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

const updateInstructorPayroll = async (id, payload, expectedStatus, userId) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const payrollResult = await client.query(
            `SELECT id, status
             FROM payroll.instructor_payroll
             WHERE id = $1 AND soft_delete = FALSE
             FOR UPDATE`,
            [id]
        );
        const payroll = payrollResult.rows[0];
        if (!payroll) throw payrollWorkflowError("Record not found.", 404);
        if (payroll.status !== expectedStatus) {
            throw payrollWorkflowError("This payroll was updated by another user. Refresh and try again.");
        }

        if (payload.status === "CANCELLED") {
            const activePayments = await client.query(
                `SELECT 1
                 FROM payroll.payroll_payment
                 WHERE instructor_payroll_id = $1
                   AND soft_delete = FALSE
                   AND status IN ('INITIATED', 'PROCESSING', 'SUCCESS')
                 LIMIT 1`,
                [id]
            );
            if (activePayments.rowCount) {
                throw payrollWorkflowError(
                    "Cancel or resolve the active payment attempt before cancelling this payroll."
                );
            }
        }

        const record = await update("instructorPayroll", id, payload, userId, client);

        // Cancelling a payroll must release its referral incentives so a
        // later payroll calculation can settle them again.
        if (payload.status === "CANCELLED") {
            await client.query(
                `UPDATE payroll.instructor_referral_earning
                 SET instructor_payroll_id = NULL, status = 'PENDING',
                     updated_at = NOW(), updated_by = $1
                 WHERE instructor_payroll_id = $2
                   AND status = 'INCLUDED'
                   AND soft_delete = FALSE`,
                [userId, id]
            );
        }

        await client.query("COMMIT");
        return record;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

const hasPayrollForPeriod = async (periodId, client) => {
    const result = await getClient(client).query(
        `SELECT EXISTS (
             SELECT 1 FROM payroll.instructor_payroll
             WHERE payroll_period_id = $1
         ) AS has_payroll`,
        [periodId]
    );
    return Boolean(result.rows[0]?.has_payroll);
};

const hasOverlappingPayrollPeriod = async (periodStart, periodEnd, excludePeriodId, client) => {
    const result = await getClient(client).query(
        `SELECT EXISTS (
             SELECT 1 FROM payroll.payroll_period period
             WHERE period.soft_delete = FALSE
               AND period.is_active = TRUE
               AND period.period_start <= $2::date
               AND period.period_end >= $1::date
               AND ($3::bigint IS NULL OR period.id <> $3::bigint)
         ) AS has_overlap`,
        [periodStart, periodEnd, excludePeriodId || null]
    );
    return Boolean(result.rows[0]?.has_overlap);
};

const createPayrollPeriod = async (payload, userId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(937512, 1)");
        if (await hasOverlappingPayrollPeriod(payload.period_start, payload.period_end, null, client)) {
            throw payrollWorkflowError("Payroll periods cannot overlap.");
        }
        const record = await create("period", payload, userId, client);
        await client.query("COMMIT");
        return record;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

const updatePayrollPeriod = async (id, payload, userId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(937512, 1)");
        const lockedPeriod = await client.query(
            `SELECT id, period_start, period_end, status
             FROM payroll.payroll_period
             WHERE id = $1 AND soft_delete = FALSE
             FOR UPDATE`,
            [id]
        );
        if (!lockedPeriod.rowCount) throw payrollWorkflowError("Record not found.", 404);

        const changingPeriod = ["period_code", "period_start", "period_end"].some((field) =>
            Object.prototype.hasOwnProperty.call(payload || {}, field)
        );
        if (changingPeriod && lockedPeriod.rows[0].status !== "OPEN") {
            throw payrollWorkflowError("A processed payroll period cannot have its dates or code changed.");
        }
        if (changingPeriod && await hasPayrollForPeriod(id, client)) {
            throw payrollWorkflowError("A payroll period with generated payroll records cannot be edited.");
        }

        const periodStart = payload.period_start ?? lockedPeriod.rows[0].period_start;
        const periodEnd = payload.period_end ?? lockedPeriod.rows[0].period_end;
        if (
            await hasOverlappingPayrollPeriod(periodStart, periodEnd, id, client)
        ) {
            throw payrollWorkflowError("Payroll periods cannot overlap.");
        }

        const record = await update("period", id, payload, userId, client);
        await client.query("COMMIT");
        return record;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

const removePayrollPeriod = async (id, userId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(937512, 1)");
        const periodResult = await client.query(
            `SELECT id, status
             FROM payroll.payroll_period
             WHERE id = $1 AND soft_delete = FALSE
             FOR UPDATE`,
            [id]
        );
        const period = periodResult.rows[0];
        if (!period) throw payrollWorkflowError("Record not found.", 404);
        if (period.status !== "OPEN" || await hasPayrollForPeriod(id, client)) {
            throw payrollWorkflowError(
                "Only an open payroll period without generated payrolls can be deleted."
            );
        }

        const deleted = await remove("period", id, userId, client);
        if (!deleted) throw payrollWorkflowError("Record not found.", 404);
        await client.query("COMMIT");
        return { id: String(id) };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

const isCompensationUsed = async (compensationId, client) => {
    const result = await getClient(client).query(
        `SELECT EXISTS (
             SELECT 1 FROM payroll.instructor_course_earning
             WHERE compensation_id = $1
         ) AS is_used`,
        [compensationId]
    );
    return Boolean(result.rows[0]?.is_used);
};

const getReferralSettings = async () => {
    const result = await pool.query(
        `SELECT currency_code, student_discount_percentage, student_discount_amount,
                instructor_incentive_amount, is_active, updated_at
         FROM payroll.referral_settings
         ORDER BY currency_code`
    );
    return result.rows;
};

const upsertReferralSettings = async (payload, userId) => {
    const result = await pool.query(
        `INSERT INTO payroll.referral_settings
            (currency_code, student_discount_amount, student_discount_percentage,
             instructor_incentive_amount, is_active, created_by, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, TRUE, $5, NOW(), $5)
         ON CONFLICT (currency_code) DO UPDATE
         SET student_discount_amount = EXCLUDED.student_discount_amount,
             student_discount_percentage = EXCLUDED.student_discount_percentage,
             instructor_incentive_amount = EXCLUDED.instructor_incentive_amount,
             is_active = TRUE,
             updated_at = NOW(), updated_by = EXCLUDED.updated_by
         RETURNING currency_code, student_discount_percentage, student_discount_amount,
                   instructor_incentive_amount, is_active, updated_at`,
        [payload.currency_code, payload.student_discount_amount,
            payload.student_discount_percentage,
            payload.instructor_incentive_amount, userId]
    );
    return result.rows[0];
};

module.exports = {
    getResource,
    getById,
    getByIdForInstructor,
    getAll,
    create,
    update,
    remove,
    getInstructorIdByUserId,
    getInstructorCourses,
    isCourseAssignedToInstructor,
    getInstructorOverview,
    getReports,
    getPayslip,
    calculatePayrollPeriod,
    initiatePayrollPayment,
    updatePayrollPayment,
    hasPayrollForPeriod,
    hasOverlappingPayrollPeriod,
    createPayrollPeriod,
    updatePayrollPeriod,
    updateInstructorPayroll,
    removePayrollPeriod,
    isCompensationUsed,
    getReferralSettings,
    upsertReferralSettings
};
