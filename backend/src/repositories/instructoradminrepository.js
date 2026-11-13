const pool = require("../config/database");

const instructorSelectQuery = `
    SELECT
        i.id::text AS id,
        i.instructor_code,
        i.specialization,
        i.qualification,
        i.experience_years::text AS experience_years,
        i.profile_image_url,
        i.bio,
        i.designation,
        i.joined_at,
        i.is_active,
        i.created_by::text AS created_by,
        i.created_at,
        i.updated_by::text AS updated_by,
        i.updated_at,

        u.first_name,
        u.last_name,
        u.email,
        u.phone_number

    FROM learning.instructor AS i

    INNER JOIN olp_auth."user" AS u
        ON u.id = i.user_id

    WHERE
        i.soft_delete = FALSE
        AND u.soft_delete = FALSE
`;

const findAllInstructors = async () => {
    const query = `
        ${instructorSelectQuery}
        ORDER BY i.id DESC
    `;

    const result = await pool.query(query);

    return result.rows;
};

const findInstructorById = async (id) => {
    const query = `
        ${instructorSelectQuery}
        AND i.id = $1::bigint
        LIMIT 1
    `;

    const result = await pool.query(query, [id]);

    return result.rows[0] || null;
};

module.exports = {
    findAllInstructors,
    findInstructorById
};
