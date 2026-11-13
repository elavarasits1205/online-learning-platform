const repository = require("../repositories/enrollmentAdmin.repository");

const {
    createError,
    validateId,
    parseBoolean,
    normalizeDatabaseError
} = require("../utils/coupon-child.helpers");

function parsePagination(query) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    if (!Number.isInteger(page) || page < 1) {
        throw createError("page must be a positive integer.");
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw createError("limit must be between 1 and 100.");
    }

    return { page, limit };
}

function optionalId(value, field) {
    return value !== undefined && value !== ""
        ? validateId(value, field)
        : null;
}

function optionalBoolean(value, field) {
    return value !== undefined && value !== ""
        ? parseBoolean(value, field)
        : false;
}

function optionalText(value) {
    return value !== undefined && value !== null
        ? String(value).trim()
        : null;
}

async function getAllEnrollments(query = {}) {
    try {
        const { page, limit } = parsePagination(query);

        return await repository.findAll({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            status: optionalText(query.status),
            studentId: optionalId(query.student_id, "student_id"),
            courseId: optionalId(query.course_id, "course_id"),
            includeDeleted: optionalBoolean(
                query.include_deleted,
                "include_deleted"
            )
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getEnrollmentById(id) {
    try {
        const enrollment = await repository.findById(validateId(id));

        if (!enrollment) {
            throw createError("Enrollment not found.", 404);
        }

        return enrollment;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getStatusOptions() {
    try {
        return await repository.getStatusOptions();
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

module.exports = {
    getAllEnrollments,
    getEnrollmentById,
    getStatusOptions
};
