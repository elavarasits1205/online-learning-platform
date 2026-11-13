const pool = require("../config/database");

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
        e.cancelled_at,
        e.cancellation_reason,
        e.soft_delete,
        e.created_by::text AS created_by,
        e.created_at,
        e.updated_by::text AS updated_by,
        e.updated_at
    FROM learning.enrollment e
    INNER JOIN learning.student s
        ON s.id = e.student_id
    INNER JOIN olp_auth."user" u
        ON u.id = s.user_id
    LEFT JOIN public.institution i
        ON i.id = s.institution_id
    INNER JOIN learning.course c
        ON c.id = e.course_id
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
        INNER JOIN olp_auth."user" iu
            ON iu.id = inst_i.user_id
        WHERE ci.course_id = c.id
          AND ci.is_active = TRUE
          AND inst_i.soft_delete = FALSE
          AND iu.soft_delete = FALSE
        ORDER BY ci.is_primary DESC, ci.id ASC
        LIMIT 1
    ) inst ON TRUE
`;

const ENROLLMENT_FROM = `
    learning.enrollment e
    INNER JOIN learning.student s
        ON s.id = e.student_id
    INNER JOIN olp_auth."user" u
        ON u.id = s.user_id
    LEFT JOIN public.institution i
        ON i.id = s.institution_id
    INNER JOIN learning.course c
        ON c.id = e.course_id
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
        INNER JOIN olp_auth."user" iu
            ON iu.id = inst_i.user_id
        WHERE ci.course_id = c.id
          AND ci.is_active = TRUE
          AND inst_i.soft_delete = FALSE
          AND iu.soft_delete = FALSE
        ORDER BY ci.is_primary DESC, ci.id ASC
        LIMIT 1
    ) inst ON TRUE
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

async function findAll({
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

    if (!includeDeleted) {
        where.push("e.soft_delete = FALSE");
    }

    addSearch(where, values, [
        "e.enrollment_number",
        "u.first_name",
        "u.last_name",
        "u.email",
        "s.student_code",
        "s.register_number",
        "c.course_code",
        "c.title",
        "inst.instructor_name"
    ], search);

    addEquals(where, values, "e.status", status);
    addEquals(where, values, "e.student_id", studentId, "::bigint");
    addEquals(where, values, "e.course_id", courseId, "::bigint");

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM ${ENROLLMENT_FROM}
         ${whereClause}`,
        values
    );

    const total = countResult.rows[0]?.total || 0;
    const offset = (page - 1) * limit;
    const dataValues = [...values, limit, offset];

    const dataResult = await pool.query(
        `${ENROLLMENT_SELECT}
         ${whereClause}
         ORDER BY e.id DESC
         LIMIT $${dataValues.length - 1}
         OFFSET $${dataValues.length}`,
        dataValues
    );

    return {
        rows: dataResult.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function findById(id) {
    const result = await pool.query(
        `${ENROLLMENT_SELECT}
         WHERE e.id = $1
         LIMIT 1`,
        [id]
    );

    return result.rows[0] || null;
}

async function getStatusOptions() {
    const result = await pool.query(
        `SELECT DISTINCT status
         FROM learning.enrollment
         WHERE status IS NOT NULL
         ORDER BY status`
    );

    return result.rows.map((row) => row.status);
}

module.exports = {
    findAll,
    findById,
    getStatusOptions
};
