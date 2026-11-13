const pool = require("../config/database");

const COUPON_COURSE_SELECT = `
    SELECT
        cc.id::text AS id,
        cc.coupon_id::text AS coupon_id,
        c.coupon_code,
        cc.course_id::text AS course_id,
        co.course_code,
        co.title AS course_title,
        cc.is_active,
        cc.created_at,
        cc.created_by::text AS created_by,
        cc.updated_at,
        cc.updated_by::text AS updated_by
    FROM payment.coupon_course cc
    INNER JOIN payment.coupon c
        ON c.id = cc.coupon_id
    INNER JOIN learning.course co
        ON co.id = cc.course_id
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

async function findCourseById(courseId) {
    const query = `
        SELECT
            id::text AS id,
            course_code,
            title,
            is_active,
            soft_delete
        FROM learning.course
        WHERE id = $1
          AND soft_delete = FALSE
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [courseId]);
    return rows[0] || null;
}

async function findDuplicate(couponId, courseId, excludeId = null) {
    const query = `
        SELECT id::text AS id
        FROM payment.coupon_course
        WHERE coupon_id = $1
          AND course_id = $2
          AND ($3::bigint IS NULL OR id <> $3::bigint)
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [couponId, courseId, excludeId]);
    return rows[0] || null;
}

async function findById(id) {
    const query = `
        ${COUPON_COURSE_SELECT}
        WHERE cc.id = $1
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
    courseId = null,
    isActive = null
}) {
    const values = [];
    const conditions = [];

    if (search) {
        values.push(`%${search}%`);
        const index = values.length;

        conditions.push(`
            (
                c.coupon_code ILIKE $${index}
                OR co.course_code ILIKE $${index}
                OR co.title ILIKE $${index}
            )
        `);
    }

    if (couponId) {
        values.push(couponId);
        conditions.push(`cc.coupon_id = $${values.length}::bigint`);
    }

    if (courseId) {
        values.push(courseId);
        conditions.push(`cc.course_id = $${values.length}::bigint`);
    }

    if (isActive !== null) {
        values.push(isActive);
        conditions.push(`cc.is_active = $${values.length}`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM payment.coupon_course cc
        INNER JOIN payment.coupon c
            ON c.id = cc.coupon_id
        INNER JOIN learning.course co
            ON co.id = cc.course_id
        ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);
    const total = countResult.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataValues = [...values, limit, offset];
    const limitIndex = dataValues.length - 1;
    const offsetIndex = dataValues.length;

    const dataQuery = `
        ${COUPON_COURSE_SELECT}
        ${whereClause}
        ORDER BY cc.id DESC
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
        INSERT INTO payment.coupon_course (
            coupon_id,
            course_id,
            is_active,
            created_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id::text AS id
    `;

    const values = [
        data.coupon_id,
        data.course_id,
        data.is_active,
        actorId
    ];

    const { rows } = await pool.query(query, values);
    return findById(rows[0].id);
}

async function update(id, data, actorId = null) {
    const query = `
        UPDATE payment.coupon_course
        SET
            coupon_id = $2,
            course_id = $3,
            is_active = $4,
            updated_at = NOW(),
            updated_by = $5
        WHERE id = $1
        RETURNING id::text AS id
    `;

    const values = [
        id,
        data.coupon_id,
        data.course_id,
        data.is_active,
        actorId
    ];

    const { rows } = await pool.query(query, values);

    if (!rows.length) {
        return null;
    }

    return findById(rows[0].id);
}

async function remove(id, actorId = null) {
    const query = `
        UPDATE payment.coupon_course
        SET is_active = FALSE,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND is_active = TRUE
        RETURNING id::text AS id
    `;

    const { rows } = await pool.query(query, [id, actorId]);

    if (!rows[0]) return null;
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

async function getCourseDropdown() {
    const query = `
        SELECT
            id::text AS id,
            course_code,
            title
        FROM learning.course
        WHERE is_active = TRUE
          AND soft_delete = FALSE
        ORDER BY title ASC, id ASC
    `;

    const { rows } = await pool.query(query);
    return rows;
}

module.exports = {
    findCouponById,
    findCourseById,
    findDuplicate,
    findById,
    findAll,
    create,
    update,
    remove,
    getCouponDropdown,
    getCourseDropdown
};
