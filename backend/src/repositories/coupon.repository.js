const pool = require("../config/database");

const COUPON_SELECT = `
    SELECT
        c.id::text AS id,
        c.institution_id::text AS institution_id,
        i.name AS institution_name,
        c.coupon_code,
        c.description,
        c.discount_type,
        c.discount_value,
        c.minimum_amount,
        c.maximum_discount_amount,
        c.valid_from,
        c.valid_until,
        c.usage_limit,
        c.used_count,
        c.is_active,
        c.soft_delete,
        c.created_by::text AS created_by,
        c.created_at,
        c.updated_by::text AS updated_by,
        c.updated_at
    FROM payment.coupon c
    INNER JOIN public.institution i
        ON i.id = c.institution_id
`;

async function findInstitutionById(institutionId) {
    const query = `
        SELECT
            id::text AS id,
            name AS institution_name
        FROM public.institution
        WHERE id = $1
          AND is_active = TRUE
          AND soft_delete = FALSE
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [institutionId]);
    return rows[0] || null;
}

async function getInstitutionDropdown() {
    const query = `
        SELECT
            id::text AS id,
            name AS institution_name
        FROM public.institution
        WHERE is_active = TRUE
          AND soft_delete = FALSE
        ORDER BY name ASC, id ASC
    `;

    const { rows } = await pool.query(query);
    return rows;
}

async function findDuplicateCode(couponCode, excludeId = null) {
    const query = `
        SELECT id::text AS id
        FROM payment.coupon
        WHERE LOWER(coupon_code) = LOWER($1)
          AND soft_delete = FALSE
          AND ($2::bigint IS NULL OR id <> $2::bigint)
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [
        couponCode,
        excludeId
    ]);

    return rows[0] || null;
}

async function findById(id, { includeDeleted = false } = {}) {
    const query = `
        ${COUPON_SELECT}
        WHERE c.id = $1
          ${includeDeleted ? "" : "AND c.soft_delete = FALSE"}
        LIMIT 1
    `;

    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
}

async function findAll({
    page = 1,
    limit = 20,
    search = "",
    institutionId = null,
    isActive = null,
    includeDeleted = false
}) {
    const values = [];
    const conditions = [];

    if (!includeDeleted) {
        conditions.push("c.soft_delete = FALSE");
    }

    if (search) {
        values.push(`%${search}%`);
        const index = values.length;

        conditions.push(`
            (
                c.coupon_code ILIKE $${index}
                OR COALESCE(c.description, '') ILIKE $${index}
                OR i.name ILIKE $${index}
            )
        `);
    }

    if (institutionId) {
        values.push(institutionId);
        conditions.push(
            `c.institution_id = $${values.length}::bigint`
        );
    }

    if (isActive !== null) {
        values.push(isActive);
        conditions.push(`c.is_active = $${values.length}`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM payment.coupon c
        INNER JOIN public.institution i
            ON i.id = c.institution_id
        ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);
    const total = countResult.rows[0]?.total || 0;

    const offset = (page - 1) * limit;

    const dataValues = [...values, limit, offset];
    const limitIndex = dataValues.length - 1;
    const offsetIndex = dataValues.length;

    const dataQuery = `
        ${COUPON_SELECT}
        ${whereClause}
        ORDER BY c.id DESC
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
        INSERT INTO payment.coupon (
            institution_id,
            coupon_code,
            description,
            discount_type,
            discount_value,
            minimum_amount,
            maximum_discount_amount,
            valid_from,
            valid_until,
            usage_limit,
            used_count,
            is_active,
            created_by
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13
        )
        RETURNING id::text AS id
    `;

    const values = [
        data.institution_id,
        data.coupon_code,
        data.description,
        data.discount_type,
        data.discount_value,
        data.minimum_amount,
        data.maximum_discount_amount,
        data.valid_from,
        data.valid_until,
        data.usage_limit,
        data.used_count,
        data.is_active,
        actorId
    ];

    const { rows } = await pool.query(query, values);

    return findById(rows[0].id);
}

async function update(id, data, actorId = null) {
    const query = `
        UPDATE payment.coupon
        SET
            institution_id = $2,
            coupon_code = $3,
            description = $4,
            discount_type = $5,
            discount_value = $6,
            minimum_amount = $7,
            maximum_discount_amount = $8,
            valid_from = $9,
            valid_until = $10,
            usage_limit = $11,
            used_count = $12,
            is_active = $13,
            updated_at = NOW(),
            updated_by = $14
        WHERE id = $1
          AND soft_delete = FALSE
        RETURNING id::text AS id
    `;

    const values = [
        id,
        data.institution_id,
        data.coupon_code,
        data.description,
        data.discount_type,
        data.discount_value,
        data.minimum_amount,
        data.maximum_discount_amount,
        data.valid_from,
        data.valid_until,
        data.usage_limit,
        data.used_count,
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
        UPDATE payment.coupon
        SET
            soft_delete = TRUE,
            is_active = FALSE,
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

module.exports = {
    findInstitutionById,
    getInstitutionDropdown,
    findDuplicateCode,
    findById,
    findAll,
    create,
    update,
    softDelete
};
