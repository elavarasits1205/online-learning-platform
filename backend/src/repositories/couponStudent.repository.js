const pool = require("../config/database");

const COUPON_STUDENT_SELECT = `
    SELECT
        cs.id::text AS id,
        cs.coupon_id::text AS coupon_id,
        c.coupon_code,
        cs.student_id::text AS student_id,
        CONCAT_WS(
            ' ',
            NULLIF(BTRIM(u.first_name), ''),
            NULLIF(BTRIM(u.last_name), '')
        ) AS student_name,
        u.email AS student_email,
        s.student_code,
        s.register_number,
        cs.register_number_snapshot,
        c.institution_id::text AS coupon_institution_id,
        s.institution_id::text AS institution_id,
        i.name AS institution_name,
        cs.is_active,
        cs.soft_delete,
        cs.created_by::text AS created_by,
        cs.created_at,
        cs.updated_by::text AS updated_by,
        cs.updated_at
    FROM payment.coupon_student cs
    INNER JOIN payment.coupon c
        ON c.id = cs.coupon_id
    INNER JOIN learning.student s
        ON s.id = cs.student_id
    INNER JOIN olp_auth."user" u
        ON u.id = s.user_id
    LEFT JOIN public.institution i
        ON i.id = s.institution_id
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
            ) AS student_name,
            u.email AS student_email
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

async function findDuplicate(couponId, studentId, excludeId = null) {
    const query = `
        SELECT
            id::text AS id,
            soft_delete
        FROM payment.coupon_student
        WHERE coupon_id = $1
          AND student_id = $2
          AND ($3::bigint IS NULL OR id <> $3::bigint)
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [couponId, studentId, excludeId]);
    return rows[0] || null;
}

async function findById(id, { includeDeleted = false } = {}) {
    const query = `
        ${COUPON_STUDENT_SELECT}
        WHERE cs.id = $1
          ${includeDeleted ? "" : "AND cs.soft_delete = FALSE"}
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
    isActive = null,
    includeDeleted = false
}) {
    const values = [];
    const conditions = [];

    if (!includeDeleted) {
        conditions.push("cs.soft_delete = FALSE");
    }

    if (search) {
        values.push(`%${search}%`);
        const index = values.length;

        conditions.push(`
            (
                c.coupon_code ILIKE $${index}
                OR COALESCE(s.register_number, '') ILIKE $${index}
                OR COALESCE(s.student_code, '') ILIKE $${index}
                OR COALESCE(u.first_name, '') ILIKE $${index}
                OR COALESCE(u.last_name, '') ILIKE $${index}
                OR COALESCE(u.email, '') ILIKE $${index}
            )
        `);
    }

    if (couponId) {
        values.push(couponId);
        conditions.push(`cs.coupon_id = $${values.length}::bigint`);
    }

    if (studentId) {
        values.push(studentId);
        conditions.push(`cs.student_id = $${values.length}::bigint`);
    }

    if (isActive !== null) {
        values.push(isActive);
        conditions.push(`cs.is_active = $${values.length}`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM payment.coupon_student cs
        INNER JOIN payment.coupon c
            ON c.id = cs.coupon_id
        INNER JOIN learning.student s
            ON s.id = cs.student_id
        INNER JOIN olp_auth."user" u
            ON u.id = s.user_id
        ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);
    const total = countResult.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataValues = [...values, limit, offset];
    const limitIndex = dataValues.length - 1;
    const offsetIndex = dataValues.length;

    const dataQuery = `
        ${COUPON_STUDENT_SELECT}
        ${whereClause}
        ORDER BY cs.id DESC
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
        INSERT INTO payment.coupon_student (
            coupon_id,
            student_id,
            register_number_snapshot,
            is_active,
            created_by,
            soft_delete
        )
        VALUES ($1, $2, $3, $4, $5, FALSE)
        RETURNING id::text AS id
    `;

    const values = [
        data.coupon_id,
        data.student_id,
        data.register_number_snapshot,
        data.is_active,
        actorId
    ];

    const { rows } = await pool.query(query, values);
    return findById(rows[0].id);
}

async function update(id, data, actorId = null) {
    const query = `
        UPDATE payment.coupon_student
        SET
            coupon_id = $2,
            student_id = $3,
            register_number_snapshot = $4,
            is_active = $5,
            updated_at = NOW(),
            updated_by = $6
        WHERE id = $1
          AND soft_delete = FALSE
        RETURNING id::text AS id
    `;

    const values = [
        id,
        data.coupon_id,
        data.student_id,
        data.register_number_snapshot,
        data.is_active,
        actorId
    ];

    const { rows } = await pool.query(query, values);

    if (!rows.length) {
        return null;
    }

    return findById(rows[0].id);
}

async function revive(id, data, actorId = null) {
    const query = `
        UPDATE payment.coupon_student
        SET
            coupon_id = $2,
            student_id = $3,
            register_number_snapshot = $4,
            is_active = $5,
            soft_delete = FALSE,
            updated_at = NOW(),
            updated_by = $6
        WHERE id = $1
        RETURNING id::text AS id
    `;

    const values = [
        id,
        data.coupon_id,
        data.student_id,
        data.register_number_snapshot,
        data.is_active,
        actorId
    ];

    const { rows } = await pool.query(query, values);

    if (!rows.length) {
        return null;
    }

    return findById(rows[0].id);
}

async function softDelete(id, actorId = null) {
    const query = `
        UPDATE payment.coupon_student
        SET
            soft_delete = TRUE,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND soft_delete = FALSE
        RETURNING id::text AS id
    `;

    const { rows } = await pool.query(query, [id, actorId]);

    if (!rows.length) {
        return null;
    }

    return findById(rows[0].id, { includeDeleted: true });
}

async function getCouponDropdown() {
    const query = `
        SELECT
            id::text AS id,
            coupon_code,
            institution_id::text AS institution_id,
            is_active
        FROM payment.coupon
        WHERE is_active = TRUE
          AND soft_delete = FALSE
        ORDER BY coupon_code ASC, id ASC
    `;

    const { rows } = await pool.query(query);
    return rows;
}

async function getStudentDropdown(couponId = null) {
    const values = [];
    let institutionFilter = "";

    if (couponId) {
        values.push(couponId);
        institutionFilter = `
          AND s.institution_id = (
              SELECT institution_id FROM payment.coupon
              WHERE id = $${values.length}::bigint
          )`;
    }

    const query = `
        SELECT
            s.id::text AS id,
            s.student_code,
            s.register_number,
            s.institution_id::text AS institution_id,
            CONCAT_WS(
                ' ',
                NULLIF(BTRIM(u.first_name), ''),
                NULLIF(BTRIM(u.last_name), '')
            ) AS student_name,
            u.email AS student_email
        FROM learning.student s
        INNER JOIN olp_auth."user" u
            ON u.id = s.user_id
        WHERE s.is_active = TRUE
          AND s.soft_delete = FALSE
          ${institutionFilter}
        ORDER BY student_name ASC, s.id ASC
    `;

    const { rows } = await pool.query(query, values);
    return rows;
}

module.exports = {
    findCouponById,
    findStudentById,
    findDuplicate,
    findById,
    findAll,
    create,
    update,
    revive,
    softDelete,
    getCouponDropdown,
    getStudentDropdown
};
