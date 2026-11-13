const pool = require("../config/database");

const CATEGORY_FIELDS = `
    id,
    code,
    name,
    description,
    parent_category_id,
    display_order,
    is_active,
    soft_delete,
    created_by::text AS created_by,
    created_at,
    updated_by::text AS updated_by,
    updated_at
`;

async function getAll() {
    const result = await pool.query(`
        SELECT ${CATEGORY_FIELDS}
        FROM public.course_category
        WHERE soft_delete = FALSE
        ORDER BY display_order ASC, id ASC
    `);

    return result.rows;
}

async function getById(id) {
    const result = await pool.query(
        `
        SELECT ${CATEGORY_FIELDS}
        FROM public.course_category
        WHERE id = $1
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [id]
    );

    return result.rows[0] || null;
}

async function getByCode(code, excludeId = null) {
    const result = await pool.query(
        `
        SELECT id
        FROM public.course_category
        WHERE LOWER(code) = LOWER($1)
          AND ($2::bigint IS NULL OR id <> $2::bigint)
        LIMIT 1
        `,
        [code, excludeId]
    );

    return result.rows[0] || null;
}

async function getByName(name, excludeId = null) {
    const result = await pool.query(
        `
        SELECT id
        FROM public.course_category
        WHERE LOWER(name) = LOWER($1)
          AND ($2::bigint IS NULL OR id <> $2::bigint)
        LIMIT 1
        `,
        [name, excludeId]
    );

    return result.rows[0] || null;
}

async function parentExists(parentId) {
    if (parentId === null) {
        return true;
    }

    const result = await pool.query(
        `
        SELECT id
        FROM public.course_category
        WHERE id = $1
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [parentId]
    );

    return Boolean(result.rows[0]);
}

async function create(category, createdBy) {
    const result = await pool.query(
        `
        INSERT INTO public.course_category (
            code,
            name,
            description,
            parent_category_id,
            display_order,
            is_active,
            soft_delete,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
        RETURNING ${CATEGORY_FIELDS}
        `,
        [
            category.code,
            category.name,
            category.description,
            category.parent_category_id,
            category.display_order,
            category.is_active,
            createdBy,
        ]
    );

    return result.rows[0];
}

async function update(id, category, updatedBy) {
    const result = await pool.query(
        `
        UPDATE public.course_category
        SET
            code = $2,
            name = $3,
            description = $4,
            parent_category_id = $5,
            display_order = $6,
            is_active = $7,
            updated_at = NOW(),
            updated_by = $8
        WHERE id = $1
          AND soft_delete = FALSE
        RETURNING ${CATEGORY_FIELDS}
        `,
        [
            id,
            category.code,
            category.name,
            category.description,
            category.parent_category_id,
            category.display_order,
            category.is_active,
            updatedBy,
        ]
    );

    return result.rows[0] || null;
}

async function hasActiveChildren(id) {
    const result = await pool.query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM public.course_category
            WHERE parent_category_id = $1
              AND soft_delete = FALSE
        ) AS has_children
        `,
        [id]
    );

    return result.rows[0].has_children;
}

async function softDelete(id, updatedBy) {
    const result = await pool.query(
        `
        UPDATE public.course_category
        SET
            soft_delete = TRUE,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND soft_delete = FALSE
        RETURNING ${CATEGORY_FIELDS}
        `,
        [id, updatedBy]
    );

    return result.rows[0] || null;
}

module.exports = {
    getAll,
    getById,
    getByCode,
    getByName,
    parentExists,
    create,
    update,
    hasActiveChildren,
    softDelete,
};
