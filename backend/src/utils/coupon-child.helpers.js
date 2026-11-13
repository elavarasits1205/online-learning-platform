const MAX_BIGINT = 9223372036854775807n;

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function validateId(value, fieldName = "id") {
    const normalized = String(value ?? "").trim();

    if (!/^[1-9]\d*$/.test(normalized)) {
        throw createError(`${fieldName} must be a positive integer string.`);
    }

    if (BigInt(normalized) > MAX_BIGINT) {
        throw createError(`${fieldName} exceeds the PostgreSQL BIGINT range.`);
    }

    return normalized;
}

function parseBoolean(value, fieldName) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;

    throw createError(`${fieldName} must be true or false.`);
}

function parseAmount(value, fieldName, nullable = false) {
    if (nullable && (value === null || value === "" || value === undefined)) {
        return null;
    }

    if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isFinite(Number(value))
    ) {
        throw createError(`${fieldName} must be a valid number.`);
    }

    const number = Number(value);

    if (number < 0) {
        throw createError(`${fieldName} cannot be negative.`);
    }

    return Math.round((number + Number.EPSILON) * 100) / 100;
}

function parseOptionalInteger(value, fieldName, nullable = false) {
    if (nullable && (value === null || value === "" || value === undefined)) {
        return null;
    }

    if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isInteger(Number(value))
    ) {
        throw createError(`${fieldName} must be an integer.`);
    }

    const number = Number(value);

    if (number < 0) {
        throw createError(`${fieldName} cannot be negative.`);
    }

    return number;
}

function parseDate(value, fieldName, { nullable = false } = {}) {
    if (value === undefined || value === null || value === "") {
        if (nullable) return null;
        throw createError(`${fieldName} is required.`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw createError(`${fieldName} must be a valid date.`);
    }

    return date.toISOString();
}

function getActorId(user) {
    if (user?.id === undefined || user?.id === null) {
        return null;
    }

    return validateId(String(user.id), "authenticated user id");
}

function normalizeDatabaseError(error) {
    if (error.statusCode) return error;

    if (error.code === "23505") {
        return createError(
            "A record with the same unique value already exists.",
            409
        );
    }

    if (
        error.code === "23514" ||
        error.code === "22P02" ||
        error.code === "22003" ||
        error.code === "22007" ||
        error.code === "22008" ||
        error.code === "23502" ||
        error.code === "22001"
    ) {
        return createError(
            "The submitted data violates a database constraint.",
            400
        );
    }

    if (error.code === "23503") {
        return createError(
            "The referenced record does not exist or is still in use.",
            409
        );
    }

    return error;
}

function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

module.exports = {
    createError,
    hasOwn,
    validateId,
    parseBoolean,
    parseAmount,
    parseOptionalInteger,
    parseDate,
    getActorId,
    normalizeDatabaseError,
    round2
};
