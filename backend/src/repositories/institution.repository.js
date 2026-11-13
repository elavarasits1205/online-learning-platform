
const pool = require("../config/database");

const SELECT_COLUMNS = `
    id::text AS id,
    code,
    name,
    institution_type,
    description,
    email,
    phone_number,
    website_url,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    country,
    logo_url,
    is_active,
    created_by::text AS created_by,
    created_at,
    updated_by::text AS updated_by,
    updated_at
`;

const EDITABLE_FIELDS = [
    "code",
    "name",
    "institution_type",
    "description",
    "email",
    "phone_number",
    "website_url",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "country",
    "logo_url",
    "is_active",
];

async function create(data, actorId = null) {
    const columns = [...EDITABLE_FIELDS, "created_by"];
    const values = [
        ...EDITABLE_FIELDS.map((field) => data[field] ?? null),
        actorId,
    ];

    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await pool.query(
        `
        INSERT INTO public.institution (${columns.join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING ${SELECT_COLUMNS}
        `,
        values
    );

    return result.rows[0];
}

async function findAll({
    search = "",
    isActive,
    page = 1,
    limit = 10,
}) {
    const conditions = ["soft_delete = FALSE"];
    const values = [];

    if (search) {
        values.push(`%${search}%`);
        const index = values.length;

        conditions.push(`
            (
                code ILIKE $${index}
                OR name ILIKE $${index}
                OR institution_type ILIKE $${index}
                OR email ILIKE $${index}
                OR city ILIKE $${index}
                OR state ILIKE $${index}
                OR country ILIKE $${index}
            )
        `);
    }

    if (typeof isActive === "boolean") {
        values.push(isActive);
        conditions.push(`is_active = $${values.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
        `
        SELECT COUNT(*)::text AS total
        FROM public.institution
        WHERE ${whereClause}
        `,
        values
    );

    const total = Number(countResult.rows[0].total);
    const offset = (page - 1) * limit;

    const listValues = [...values, limit, offset];

    const result = await pool.query(
        `
        SELECT ${SELECT_COLUMNS}
        FROM public.institution
        WHERE ${whereClause}
        ORDER BY id DESC
        LIMIT $${listValues.length - 1}
        OFFSET $${listValues.length}
        `,
        listValues
    );

    return {
        rows: result.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async function findById(id) {
    const result = await pool.query(
        `
        SELECT ${SELECT_COLUMNS}
        FROM public.institution
        WHERE id = $1
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [id]
    );

    return result.rows[0] || null;
}

async function findDuplicate(field, value, excludeId = null) {
    if (!["code", "name"].includes(field)) {
        throw new Error("Unsupported duplicate-check field");
    }

    const values = [value];

    let sql = `
        SELECT id::text AS id, ${field}
        FROM public.institution
        WHERE ${field} = $1
          AND soft_delete = FALSE
    `;

    if (excludeId !== null) {
        values.push(excludeId);
        sql += ` AND id <> $${values.length}`;
    }

    sql += " LIMIT 1";

    const result = await pool.query(sql, values);
    return result.rows[0] || null;
}

async function update(id, data, actorId = null) {
    const fields = EDITABLE_FIELDS.filter((field) =>
        Object.prototype.hasOwnProperty.call(data, field)
    );

    if (fields.length === 0) {
        return findById(id);
    }

    const values = fields.map((field) => data[field]);
    const assignments = fields.map(
        (field, index) => `${field} = $${index + 1}`
    );

    values.push(actorId);
    assignments.push(`updated_by = $${values.length}`);

    assignments.push("updated_at = NOW()");

    values.push(id);

    const result = await pool.query(
        `
        UPDATE public.institution
        SET ${assignments.join(", ")}
        WHERE id = $${values.length}
          AND soft_delete = FALSE
        RETURNING ${SELECT_COLUMNS}
        `,
        values
    );

    return result.rows[0] || null;
}

async function softDelete(id, actorId = null) {
    const result = await pool.query(
        `
        UPDATE public.institution
        SET soft_delete = TRUE,
            is_active = FALSE,
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
          AND soft_delete = FALSE
        RETURNING id::text AS id
        `,
        [actorId, id]
    );

    return result.rows[0] || null;
}

module.exports = {
    create,
    findAll,
    findById,
    findDuplicate,
    update,
    softDelete,
};
