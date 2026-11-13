const pool = require("../config/database");

const COUPON_REDEMPTION_SELECT = `
    SELECT
        r.id::text AS id,
        r.coupon_id::text AS coupon_id,
        c.coupon_code,
        r.payment_id::text AS payment_id,
        p.payment_number,
        r.enrollment_id::text AS enrollment_id,
        e.enrollment_number,
        r.student_id::text AS student_id,
        CONCAT_WS(
            ' ',
            NULLIF(BTRIM(u.first_name), ''),
            NULLIF(BTRIM(u.last_name), '')
        ) AS student_name,
        s.student_code,
        s.register_number,
        s.institution_id::text AS institution_id,
        i.name AS institution_name,
        e.course_id::text AS course_id,
        co.course_code,
        co.title AS course_title,
        r.coupon_code_snapshot,
        r.register_number_snapshot,
        r.original_amount,
        r.discount_amount,
        r.final_amount,
        r.status,
        r.is_active,
        r.applied_at,
        r.redeemed_at,
        r.cancelled_at,
        r.cancellation_reason,
        r.soft_delete,
        r.created_by::text AS created_by,
        r.created_at,
        r.updated_by::text AS updated_by,
        r.updated_at
    FROM payment.coupon_redemption r
    INNER JOIN payment.coupon c
        ON c.id = r.coupon_id
    INNER JOIN payment.payment p
        ON p.id = r.payment_id
    INNER JOIN learning.enrollment e
        ON e.id = r.enrollment_id
    INNER JOIN learning.student s
        ON s.id = r.student_id
    INNER JOIN olp_auth."user" u
        ON u.id = s.user_id
    LEFT JOIN public.institution i
        ON i.id = s.institution_id
    LEFT JOIN learning.course co
        ON co.id = e.course_id
`;

async function findCouponById(couponId) {
    const query = `
        SELECT
            id::text AS id,
            coupon_code,
            institution_id::text AS institution_id,
            is_active,
            soft_delete
        FROM payment.coupon
        WHERE id = $1
          AND soft_delete = FALSE
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [couponId]);
    return rows[0] || null;
}

async function findStudentById(studentId) {
    const query = `
        SELECT
            s.id::text AS id,
            s.student_code,
            s.register_number,
            s.institution_id::text AS institution_id,
            s.is_active,
            s.soft_delete,
            CONCAT_WS(
                ' ',
                NULLIF(BTRIM(u.first_name), ''),
                NULLIF(BTRIM(u.last_name), '')
            ) AS student_name
        FROM learning.student s
        INNER JOIN olp_auth."user" u
            ON u.id = s.user_id
        WHERE s.id = $1
          AND s.soft_delete = FALSE
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [studentId]);
    return rows[0] || null;
}

async function findPaymentById(paymentId) {
    const query = `
        SELECT
            id::text AS id,
            payment_number,
            enrollment_id::text AS enrollment_id,
            student_id::text AS student_id,
            course_id::text AS course_id,
            original_amount,
            discount_amount,
            final_amount,
            status,
            soft_delete
        FROM payment.payment
        WHERE id = $1
          AND soft_delete = FALSE
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [paymentId]);
    return rows[0] || null;
}

async function findEnrollmentById(enrollmentId) {
    const query = `
        SELECT
            id::text AS id,
            enrollment_number,
            student_id::text AS student_id,
            course_id::text AS course_id,
            status,
            soft_delete
        FROM learning.enrollment
        WHERE id = $1
          AND soft_delete = FALSE
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [enrollmentId]);
    return rows[0] || null;
}

async function findDuplicatePayment(paymentId, excludeId = null) {
    const query = `
        SELECT
            id::text AS id,
            soft_delete
        FROM payment.coupon_redemption
        WHERE payment_id = $1
          AND status = 'REDEEMED'
          AND soft_delete = FALSE
          AND ($2::bigint IS NULL OR id <> $2::bigint)
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [paymentId, excludeId]);
    return rows[0] || null;
}

async function findLatestByPayment(paymentId, client = pool) {
    const query = `
        SELECT
            id::text AS id,
            coupon_id::text AS coupon_id,
            status,
            is_active,
            soft_delete
        FROM payment.coupon_redemption
        WHERE payment_id = $1
          AND soft_delete = FALSE
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
    `;

    const { rows } = await client.query(query, [paymentId]);
    return rows[0] || null;
}

async function findById(id, { includeDeleted = false } = {}) {
    const query = `
        ${COUPON_REDEMPTION_SELECT}
        WHERE r.id = $1
          ${includeDeleted ? "" : "AND r.soft_delete = FALSE"}
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
}

async function findAll({
    page = 1,
    limit = 20,
    search = "",
    couponId = null,
    studentId = null,
    paymentId = null,
    status = null,
    isActive = null,
    includeDeleted = false
}) {
    const values = [];
    const conditions = [];

    if (!includeDeleted) {
        conditions.push("r.soft_delete = FALSE");
    }

    if (search) {
        values.push(`%${search}%`);
        const index = values.length;

        conditions.push(`
            (
                c.coupon_code ILIKE $${index}
                OR COALESCE(p.payment_number, '') ILIKE $${index}
                OR COALESCE(e.enrollment_number, '') ILIKE $${index}
                OR COALESCE(s.register_number, '') ILIKE $${index}
                OR COALESCE(s.student_code, '') ILIKE $${index}
                OR COALESCE(u.first_name, '') ILIKE $${index}
                OR COALESCE(u.last_name, '') ILIKE $${index}
                OR COALESCE(co.title, '') ILIKE $${index}
            )
        `);
    }

    if (couponId) {
        values.push(couponId);
        conditions.push(`r.coupon_id = $${values.length}::bigint`);
    }

    if (studentId) {
        values.push(studentId);
        conditions.push(`r.student_id = $${values.length}::bigint`);
    }

    if (paymentId) {
        values.push(paymentId);
        conditions.push(`r.payment_id = $${values.length}::bigint`);
    }

    if (status) {
        values.push(status);
        conditions.push(`r.status = $${values.length}`);
    }

    if (isActive !== null) {
        values.push(isActive);
        conditions.push(`r.is_active = $${values.length}`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM payment.coupon_redemption r
        INNER JOIN payment.coupon c
            ON c.id = r.coupon_id
        INNER JOIN payment.payment p
            ON p.id = r.payment_id
        INNER JOIN learning.enrollment e
            ON e.id = r.enrollment_id
        INNER JOIN learning.student s
            ON s.id = r.student_id
        INNER JOIN olp_auth."user" u
            ON u.id = s.user_id
        LEFT JOIN learning.course co
            ON co.id = e.course_id
        ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);
    const total = countResult.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataValues = [...values, limit, offset];
    const limitIndex = dataValues.length - 1;
    const offsetIndex = dataValues.length;

    const dataQuery = `
        ${COUPON_REDEMPTION_SELECT}
        ${whereClause}
        ORDER BY r.id DESC
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

async function create(data, actorId = null) {
    const query = `
        INSERT INTO payment.coupon_redemption (
            coupon_id,
            payment_id,
            enrollment_id,
            student_id,
            coupon_code_snapshot,
            register_number_snapshot,
            original_amount,
            discount_amount,
            final_amount,
            status,
            is_active,
            applied_at,
            redeemed_at,
            cancelled_at,
            cancellation_reason,
            created_by,
            updated_by,
            soft_delete
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16, $16, FALSE
        )
        RETURNING id::text AS id
    `;

    const values = [
        data.coupon_id,
        data.payment_id,
        data.enrollment_id,
        data.student_id,
        data.coupon_code_snapshot,
        data.register_number_snapshot,
        data.original_amount,
        data.discount_amount,
        data.final_amount,
        data.status,
        data.is_active,
        data.applied_at,
        data.redeemed_at,
        data.cancelled_at,
        data.cancellation_reason,
        actorId
    ];

    const { rows } = await pool.query(query, values);
    return findById(rows[0].id);
}

async function getCouponDropdown() {
    const query = `
        SELECT
            id::text AS id,
            coupon_code
        FROM payment.coupon
        WHERE is_active = TRUE
          AND soft_delete = FALSE
        ORDER BY coupon_code ASC, id ASC
    `;

    const { rows } = await pool.query(query);
    return rows;
}

async function getStudentDropdown() {
    const query = `
        SELECT
            s.id::text AS id,
            s.student_code,
            s.register_number,
            CONCAT_WS(
                ' ',
                NULLIF(BTRIM(u.first_name), ''),
                NULLIF(BTRIM(u.last_name), '')
            ) AS student_name
        FROM learning.student s
        INNER JOIN olp_auth."user" u
            ON u.id = s.user_id
        WHERE s.is_active = TRUE
          AND s.soft_delete = FALSE
        ORDER BY student_name ASC, s.id ASC
    `;

    const { rows } = await pool.query(query);
    return rows;
}

async function getPaymentDropdown() {
    const query = `
        SELECT
            p.id::text AS id,
            p.payment_number,
            p.enrollment_id::text AS enrollment_id,
            p.student_id::text AS student_id,
            p.course_id::text AS course_id,
            p.original_amount,
            p.discount_amount,
            p.final_amount,
            p.status,
            CONCAT_WS(
                ' ',
                NULLIF(BTRIM(u.first_name), ''),
                NULLIF(BTRIM(u.last_name), '')
            ) AS student_name,
            co.title AS course_title
        FROM payment.payment p
        INNER JOIN learning.student s
            ON s.id = p.student_id
        INNER JOIN olp_auth."user" u
            ON u.id = s.user_id
        LEFT JOIN learning.course co
            ON co.id = p.course_id
        WHERE p.soft_delete = FALSE
        ORDER BY p.id DESC
    `;

    const { rows } = await pool.query(query);
    return rows;
}

async function getEnrollmentDropdown() {
    const query = `
        SELECT
            e.id::text AS id,
            e.enrollment_number,
            e.student_id::text AS student_id,
            e.course_id::text AS course_id,
            e.status,
            CONCAT_WS(
                ' ',
                NULLIF(BTRIM(u.first_name), ''),
                NULLIF(BTRIM(u.last_name), '')
            ) AS student_name,
            co.title AS course_title
        FROM learning.enrollment e
        INNER JOIN learning.student s
            ON s.id = e.student_id
        INNER JOIN olp_auth."user" u
            ON u.id = s.user_id
        LEFT JOIN learning.course co
            ON co.id = e.course_id
        WHERE e.soft_delete = FALSE
        ORDER BY e.id DESC
    `;

    const { rows } = await pool.query(query);
    return rows;
}

module.exports = {
    findCouponById,
    findStudentById,
    findPaymentById,
    findEnrollmentById,
    findDuplicatePayment,
    findLatestByPayment,
    findById,
    findAll,
    create,
    getCouponDropdown,
    getStudentDropdown,
    getPaymentDropdown,
    getEnrollmentDropdown
};
