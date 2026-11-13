const pool = require("../config/database");

const PAYMENT_SELECT = `
    SELECT
        p.id::text AS id,
        p.payment_number,
        p.enrollment_id::text AS enrollment_id,
        e.enrollment_number,
        p.student_id::text AS student_id,
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
        p.course_id::text AS course_id,
        co.course_code,
        co.title AS course_title,
        p.currency_code,
        p.original_amount,
        p.discount_amount,
        p.tax_amount,
        p.final_amount,
        p.paid_amount,
        p.status,
        p.payment_method,
        p.payment_gateway,
        p.gateway_order_id,
        p.payment_due_at,
        p.paid_at,
        p.failed_at,
        p.failure_reason,
        p.cancelled_at,
        p.cancellation_reason,
        NOT p.soft_delete AS is_active
    FROM payment.payment p
    INNER JOIN learning.student s
        ON s.id = p.student_id
    INNER JOIN olp_auth."user" u
        ON u.id = s.user_id
    LEFT JOIN public.institution i
        ON i.id = s.institution_id
    LEFT JOIN learning.enrollment e
        ON e.id = p.enrollment_id
    LEFT JOIN learning.course co
        ON co.id = p.course_id
`;

const TRANSACTION_SELECT = `
    SELECT
        pt.id::text AS id,
        pt.payment_id::text AS payment_id,
        p.payment_number,
        pt.transaction_number,
        pt.gateway_transaction_id,
        pt.gateway_order_id,
        pt.payment_gateway,
        pt.payment_method,
        pt.transaction_type,
        pt.amount,
        pt.currency_code,
        pt.status,
        pt.gateway_status,
        pt.gateway_response_code,
        pt.gateway_response_message,
        pt.gateway_response,
        pt.initiated_at,
        pt.processed_at,
        pt.failed_at,
        pt.failure_reason,
        NOT pt.soft_delete AS is_active
    FROM payment.payment_transaction pt
    INNER JOIN payment.payment p
        ON p.id = pt.payment_id
`;

const REFUND_SELECT = `
    SELECT
        pr.id::text AS id,
        pr.payment_id::text AS payment_id,
        p.payment_number,
        pr.payment_transaction_id::text AS payment_transaction_id,
        pt.transaction_number,
        pr.refund_number,
        pr.gateway_refund_id,
        pr.refund_amount,
        pr.currency_code,
        pr.status,
        pr.reason,
        pr.gateway_response,
        pr.requested_at,
        pr.processed_at,
        pr.failed_at,
        pr.failure_reason,
        NOT pr.soft_delete AS is_active
    FROM payment.payment_refund pr
    INNER JOIN payment.payment p
        ON p.id = pr.payment_id
    LEFT JOIN payment.payment_transaction pt
        ON pt.id = pr.payment_transaction_id
`;

const WEBHOOK_SELECT = `
    SELECT
        pw.id::text AS id,
        pw.payment_id::text AS payment_id,
        p.payment_number,
        pw.payment_transaction_id::text AS payment_transaction_id,
        pt.transaction_number,
        pw.payment_gateway,
        pw.webhook_event_id,
        pw.event_type,
        pw.event_status,
        pw.payload,
        pw.signature,
        pw.signature_verified,
        pw.processing_status,
        pw.received_at,
        pw.processed_at,
        pw.processing_error,
        NOT pw.soft_delete AS is_active
    FROM payment.payment_webhook pw
    LEFT JOIN payment.payment p
        ON p.id = pw.payment_id
    LEFT JOIN payment.payment_transaction pt
        ON pt.id = pw.payment_transaction_id
`;

function buildPagination(values, limit, offset) {
    const dataValues = [...values, limit, offset];
    return {
        limitIndex: dataValues.length - 1,
        offsetIndex: dataValues.length,
        dataValues
    };
}

async function findAll({
    select,
    from,
    where,
    values,
    orderBy = "id DESC",
    page = 1,
    limit = 20
}) {
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM ${from}
        ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);
    const total = countResult.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const { limitIndex, offsetIndex, dataValues } = buildPagination(
        values,
        limit,
        offset
    );

    const dataQuery = `
        ${select}
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
    `;

    const { rows } = await pool.query(dataQuery, dataValues);

    return {
        rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

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

async function findPayments({
    page = 1,
    limit = 20,
    search = "",
    status = null,
    studentId = null,
    courseId = null,
    includeDeleted = false
}) {
    const values = [];
    const where = [];

    if (!includeDeleted) where.push("p.soft_delete = FALSE");

    addSearch(where, values, [
        "p.payment_number",
        "e.enrollment_number",
        "s.student_code",
        "s.register_number",
        "u.first_name",
        "u.last_name",
        "u.email",
        "co.title"
    ], search);

    addEquals(where, values, "p.status", status);
    addEquals(where, values, "p.student_id", studentId, "::bigint");
    addEquals(where, values, "p.course_id", courseId, "::bigint");

    return findAll({
        select: PAYMENT_SELECT,
        from: `payment.payment p
            INNER JOIN learning.student s ON s.id = p.student_id
            INNER JOIN olp_auth."user" u ON u.id = s.user_id
            LEFT JOIN learning.enrollment e ON e.id = p.enrollment_id
            LEFT JOIN learning.course co ON co.id = p.course_id`,
        where,
        values,
        orderBy: "p.id DESC",
        page,
        limit
    });
}

async function findPaymentReport({
    page = 1,
    limit = 20,
    search = "",
    status = null
}) {
    const values = [];
    const where = ["p.soft_delete = FALSE"];

    addEquals(where, values, "p.status", status);

    if (search) {
        values.push(`%${search}%`);
        const searchIndex = values.length;
        where.push(`(
            p.status ILIKE $${searchIndex}
            OR p.currency_code ILIKE $${searchIndex}
            OR TO_CHAR(date_trunc('month', COALESCE(p.paid_at, p.created_at, p.payment_due_at)), 'YYYY-MM') ILIKE $${searchIndex}
            OR s.student_code ILIKE $${searchIndex}
            OR CONCAT_WS(' ', NULLIF(BTRIM(u.first_name), ''), NULLIF(BTRIM(u.last_name), '')) ILIKE $${searchIndex}
            OR co.title ILIKE $${searchIndex}
        )`);
    }

    const from = `payment.payment p
        INNER JOIN learning.student s ON s.id = p.student_id
        INNER JOIN olp_auth."user" u ON u.id = s.user_id
        LEFT JOIN learning.course co ON co.id = p.course_id`;
    const whereClause = `WHERE ${where.join(" AND ")}`;
    const monthExpression = "date_trunc('month', COALESCE(p.paid_at, p.created_at, p.payment_due_at))";
    const groupedQuery = `
        SELECT
            COALESCE(TO_CHAR(${monthExpression}, 'YYYY-MM'), 'Undated') AS report_month,
            ${monthExpression}::date AS month_start,
            p.status AS payment_status,
            p.currency_code,
            COUNT(*)::int AS payment_count,
            COALESCE(SUM(p.original_amount), 0) AS original_total,
            COALESCE(SUM(p.discount_amount), 0) AS discount_total,
            COALESCE(SUM(p.tax_amount), 0) AS tax_total,
            COALESCE(SUM(p.final_amount), 0) AS final_total,
            COALESCE(SUM(p.paid_amount), 0) AS paid_total
        FROM ${from}
        ${whereClause}
        GROUP BY ${monthExpression}, p.status, p.currency_code
    `;

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM (${groupedQuery}) payment_report`,
        values
    );
    const total = countResult.rows[0]?.total || 0;
    const offset = (page - 1) * limit;
    const dataValues = [...values, limit, offset];
    const rowsResult = await pool.query(
        `SELECT
            CONCAT_WS('|', report_month, currency_code, payment_status) AS report_key,
            payment_report.*
         FROM (${groupedQuery}) payment_report
         ORDER BY month_start DESC NULLS LAST, currency_code, payment_status
         LIMIT $${dataValues.length - 1}
         OFFSET $${dataValues.length}`,
        dataValues
    );

    return {
        rows: rowsResult.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function findPaymentById(id) {
    const query = `${PAYMENT_SELECT} WHERE p.id = $1 AND p.soft_delete = FALSE LIMIT 1`;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
}

async function findTransactions({
    page = 1,
    limit = 20,
    search = "",
    status = null,
    paymentId = null,
    includeDeleted = false
}) {
    const values = [];
    const where = [];

    if (!includeDeleted) where.push("pt.soft_delete = FALSE");

    addSearch(where, values, [
        "pt.transaction_number",
        "pt.gateway_transaction_id",
        "p.payment_number"
    ], search);

    addEquals(where, values, "pt.status", status);
    addEquals(where, values, "pt.payment_id", paymentId, "::bigint");

    return findAll({
        select: TRANSACTION_SELECT,
        from: `payment.payment_transaction pt
            INNER JOIN payment.payment p ON p.id = pt.payment_id`,
        where,
        values,
        orderBy: "pt.id DESC",
        page,
        limit
    });
}

async function findTransactionById(id) {
    const query = `${TRANSACTION_SELECT} WHERE pt.id = $1 AND pt.soft_delete = FALSE LIMIT 1`;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
}

async function findRefunds({
    page = 1,
    limit = 20,
    search = "",
    status = null,
    paymentId = null,
    includeDeleted = false
}) {
    const values = [];
    const where = [];

    if (!includeDeleted) where.push("pr.soft_delete = FALSE");

    addSearch(where, values, [
        "pr.refund_number",
        "pr.gateway_refund_id",
        "p.payment_number",
        "pt.transaction_number"
    ], search);

    addEquals(where, values, "pr.status", status);
    addEquals(where, values, "pr.payment_id", paymentId, "::bigint");

    return findAll({
        select: REFUND_SELECT,
        from: `payment.payment_refund pr
            INNER JOIN payment.payment p ON p.id = pr.payment_id
            LEFT JOIN payment.payment_transaction pt ON pt.id = pr.payment_transaction_id`,
        where,
        values,
        orderBy: "pr.id DESC",
        page,
        limit
    });
}

async function findRefundById(id) {
    const query = `${REFUND_SELECT} WHERE pr.id = $1 AND pr.soft_delete = FALSE LIMIT 1`;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
}

async function findWebhooks({
    page = 1,
    limit = 20,
    search = "",
    processingStatus = null,
    paymentId = null,
    includeDeleted = false
}) {
    const values = [];
    const where = [];

    if (!includeDeleted) where.push("pw.soft_delete = FALSE");

    addSearch(where, values, [
        "pw.webhook_event_id",
        "pw.event_type",
        "pw.payment_gateway",
        "p.payment_number"
    ], search);

    addEquals(where, values, "pw.processing_status", processingStatus);
    addEquals(where, values, "pw.payment_id", paymentId, "::bigint");

    return findAll({
        select: WEBHOOK_SELECT,
        from: `payment.payment_webhook pw
            LEFT JOIN payment.payment p ON p.id = pw.payment_id
            LEFT JOIN payment.payment_transaction pt ON pt.id = pw.payment_transaction_id`,
        where,
        values,
        orderBy: "pw.id DESC",
        page,
        limit
    });
}

async function findWebhookById(id) {
    const query = `${WEBHOOK_SELECT} WHERE pw.id = $1 AND pw.soft_delete = FALSE LIMIT 1`;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
}

async function softDeletePayment(id, userId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT id, status
             FROM payment.payment
             WHERE id = $1 AND soft_delete = FALSE
             FOR UPDATE`,
            [id]
        );
        const payment = result.rows[0];

        if (!payment) {
            const error = new Error("Payment not found.");
            error.statusCode = 404;
            throw error;
        }

        if (!["PENDING", "FAILED", "CANCELLED"].includes(payment.status)) {
            const error = new Error(
                "Only pending, failed, or cancelled payments can be deleted. Settled payments must remain in the payment ledger."
            );
            error.statusCode = 409;
            throw error;
        }

        const activeTransaction = await client.query(
            `SELECT 1
             FROM payment.payment_transaction
             WHERE payment_id = $1
               AND soft_delete = FALSE
               AND status IN ('INITIATED', 'PROCESSING', 'SUCCESS')
             LIMIT 1`,
            [id]
        );

        if (activeTransaction.rowCount > 0) {
            const error = new Error(
                "Resolve the active payment transaction before deleting this payment."
            );
            error.statusCode = 409;
            throw error;
        }

        await client.query(
            `UPDATE payment.payment
             SET soft_delete = TRUE,
                 updated_by = $2,
                 updated_at = NOW()
             WHERE id = $1 AND soft_delete = FALSE`,
            [id, userId]
        );

        await client.query("COMMIT");
        return { id: String(id), is_active: false };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function getStatusOptions() {
    const { rows } = await pool.query(
        `SELECT DISTINCT status FROM payment.payment
         WHERE status IS NOT NULL ORDER BY status`
    );
    return rows.map((row) => row.status);
}

module.exports = {
    findPayments,
    findPaymentReport,
    findPaymentById,
    findTransactions,
    findTransactionById,
    findRefunds,
    findRefundById,
    findWebhooks,
    findWebhookById,
    softDeletePayment,
    getStatusOptions
};
