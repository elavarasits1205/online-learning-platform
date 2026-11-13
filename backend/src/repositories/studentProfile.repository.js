
const pool = require("../config/database");

// GET STUDENT PROFILE
async function findMyProfile(userId) {
    const result = await pool.query(
        `SELECT
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.username,
            u.phone_number,
            u.last_login_at,
            u.password_changed_at,
            s.id AS student_id,
            s.student_code,
            s.register_number,
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
            s.is_active
         FROM olp_auth."user" u
         INNER JOIN learning.student s
            ON s.user_id = u.id
         WHERE u.id = $1
           AND u.soft_delete = FALSE
           AND s.soft_delete = FALSE
         LIMIT 1`,
        [userId]
    );

    return result.rows[0] || null;
}

// TRANSACTION HANDLER
async function withTransaction(callback) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

// FIND ACTIVE STUDENT AND LOCK THE ROW
async function findActiveStudent(client, userId) {
    const result = await client.query(
        `SELECT id
         FROM learning.student
         WHERE user_id = $1
           AND soft_delete = FALSE
           AND is_active = TRUE
         FOR UPDATE`,
        [userId]
    );

    return result.rows[0] || null;
}

// UPDATE USER TABLE
async function updateUser(client, userId, updates) {
    const values = [];

    const assignments = updates.map((item, index) => {
        values.push(item.value);
        return `${item.column} = $${index + 1}`;
    });

    values.push(userId);
    const userIdPosition = values.length;

    values.push(userId);
    const updatedByPosition = values.length;

    await client.query(
        `UPDATE olp_auth."user"
         SET ${assignments.join(", ")},
             updated_by = $${updatedByPosition}
         WHERE id = $${userIdPosition}
           AND soft_delete = FALSE`,
        values
    );
}

// UPDATE STUDENT TABLE
async function updateStudent(
    client,
    studentId,
    userId,
    updates
) {
    const values = [];

    const assignments = updates.map((item, index) => {
        values.push(item.value);
        return `${item.column} = $${index + 1}`;
    });

    values.push(studentId);
    const studentIdPosition = values.length;

    values.push(userId);
    const updatedByPosition = values.length;

    await client.query(
        `UPDATE learning.student
         SET ${assignments.join(", ")},
             updated_by = $${updatedByPosition}
         WHERE id = $${studentIdPosition}
           AND soft_delete = FALSE`,
        values
    );
}

module.exports = {
    findMyProfile,
    withTransaction,
    findActiveStudent,
    updateUser,
    updateStudent
};
