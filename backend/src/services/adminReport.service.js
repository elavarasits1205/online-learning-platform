const repository = require("../repositories/adminReport.repository");

const {
    createError,
    validateId,
    parseBoolean,
    normalizeDatabaseError
} = require("../utils/coupon-child.helpers");

const ROLE_CODES = ["ADMIN", "INSTRUCTOR", "STUDENT"];
const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

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
    return value !== undefined && value !== null && value !== ""
        ? validateId(value, field)
        : null;
}

function optionalBoolean(value, field) {
    return value !== undefined && value !== null && value !== ""
        ? parseBoolean(value, field)
        : null;
}

function optionalText(value) {
    if (value === undefined || value === null) return null;

    const normalized = String(value).trim();

    return normalized || null;
}

function optionalEnum(value, allowed, field) {
    const normalized = optionalText(value);

    if (!normalized) return null;

    const upper = normalized.toUpperCase();

    if (!allowed.includes(upper)) {
        throw createError(`${field} must be one of: ${allowed.join(", ")}.`);
    }

    return upper;
}

function optionalDate(value, field) {
    const normalized = optionalText(value);

    if (!normalized) return null;

    if (Number.isNaN(new Date(normalized).getTime())) {
        throw createError(`${field} must be a valid date.`);
    }

    return normalized;
}

async function getPayrollReport(query = {}) {
    try {
        const { page, limit } = parsePagination(query);

        return await repository.findPayrollReport({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            periodId: optionalId(query.periodId ?? query.period_id, "periodId"),
            instructorId: optionalId(
                query.instructorId ?? query.instructor_id,
                "instructorId"
            ),
            status: optionalText(query.status)
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getEnrollmentReport(query = {}) {
    try {
        const { page, limit } = parsePagination(query);
        const fromDate = optionalDate(query.fromDate ?? query.from_date, "fromDate");
        const toDate = optionalDate(query.toDate ?? query.to_date, "toDate");

        if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
            throw createError("fromDate must not be later than toDate.");
        }

        return await repository.findEnrollmentReport({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            status: optionalText(query.status),
            courseId: optionalId(query.courseId ?? query.course_id, "courseId"),
            institutionId: optionalId(
                query.institutionId ?? query.institution_id,
                "institutionId"
            ),
            fromDate,
            toDate
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getUserReport(query = {}) {
    try {
        const { page, limit } = parsePagination(query);

        return await repository.findUserReport({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            role: optionalEnum(query.role, ROLE_CODES, "role"),
            isActive: optionalBoolean(
                query.isActive ?? query.is_active,
                "isActive"
            ),
            isLocked: optionalBoolean(
                query.isLocked ?? query.is_locked,
                "isLocked"
            ),
            approvalStatus: optionalEnum(
                query.approvalStatus ?? query.approval_status,
                APPROVAL_STATUSES,
                "approvalStatus"
            )
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

module.exports = {
    getPayrollReport,
    getEnrollmentReport,
    getUserReport
};
