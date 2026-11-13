const pool = require("../config/database");

const STUDENT_SELECT_QUERY = `
    SELECT
        s.id::text AS id,
        s.user_id::text AS user_id,
        s.institution_id::text AS institution_id,

        s.register_number,
        s.student_code,
        s.date_of_birth,
        s.gender,
        s.profile_image_url,

        s.address_line1,
        s.address_line2,
        s.city,
        s.state,
        s.postal_code,
        s.country,
        s.bio,

        s.joined_at,
        s.is_active,

        s.created_at,
        s.created_by::text AS created_by,
        s.updated_at,
        s.updated_by::text AS updated_by,
        s.soft_delete,

        CONCAT_WS(
            ' ',
            NULLIF(BTRIM(u.first_name), ''),
            NULLIF(BTRIM(u.last_name), '')
        ) AS user_name,

        u.username,
        u.email,
        u.phone_number,

        u.is_active AS user_is_active,
        u.is_locked AS user_is_locked,
        u.email_verified_at,
        u.phone_verified_at,
        u.last_login_at,
        u.password_changed_at,
        u.approval_status,

        i.name AS institution_name,
        i.code AS institution_code,
        i.institution_type,
        i.email AS institution_email,
        i.phone_number AS institution_phone_number,
        i.website_url AS institution_website_url,

        i.address_line1 AS institution_address_line1,
        i.address_line2 AS institution_address_line2,
        i.city AS institution_city,
        i.state AS institution_state,
        i.postal_code AS institution_postal_code,
        i.country AS institution_country,
        i.logo_url AS institution_logo_url,

        i.is_active AS institution_is_active

    FROM learning.student AS s

    INNER JOIN olp_auth."user" AS u
        ON u.id = s.user_id

    LEFT JOIN public.institution AS i
        ON i.id = s.institution_id
`;

async function findAllStudents() {
    const query = `
        ${STUDENT_SELECT_QUERY}

        WHERE s.soft_delete = FALSE

        ORDER BY s.id DESC;
    `;

    const result = await pool.query(query);

    return result.rows;
}

async function findStudentById(studentId) {
    const query = `
        ${STUDENT_SELECT_QUERY}

        WHERE
            s.id = $1::bigint
            AND s.soft_delete = FALSE

        LIMIT 1;
    `;

    const result = await pool.query(query, [studentId]);

    return result.rows[0] || null;
}

module.exports = {
    findAllStudents,
    findStudentById
};
