
const pool = require("../config/database");

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function validateId(value, field = "id") {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw createError(`Invalid ${field}`);
    }

    return id;
}

async function getInstructorId(userId, client = pool) {
    const result = await client.query(
        `SELECT id
         FROM learning.instructor
         WHERE user_id = $1
           AND soft_delete = FALSE
           AND is_active = TRUE`,
        [validateId(userId, "user ID")]
    );

    if (!result.rows.length) {
        throw createError("Instructor profile not found", 404);
    }

    return result.rows[0].id;
}

module.exports = {
    createError,
    validateId,
    getInstructorId
};
