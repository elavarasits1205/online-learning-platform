const repository = require("../repositories/coupon.repository");

const MAX_BIGINT = 9223372036854775807n;

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function validateId(value, fieldName = "id") {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value)
    ) {
        throw createError(`${fieldName} must be a positive integer string.`);
    }

    if (BigInt(value) > MAX_BIGINT) {
        throw createError(`${fieldName} exceeds the PostgreSQL BIGINT range.`);
    }

    return value;
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function parseBoolean(value, fieldName) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;

    throw createError(`${fieldName} must be true or false.`);
}

function parseAmount(value, fieldName, nullable = false) {
    if (nullable && (value === null || value === "")) {
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

    return number;
}

function parseOptionalInteger(value, fieldName, nullable = false) {
    if (nullable && (value === null || value === "")) {
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

function parseDate(value, fieldName) {
    if (value === undefined || value === null || value === "") {
        throw createError(`${fieldName} is required.`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw createError(`${fieldName} must be a valid date.`);
    }

    return date.toISOString();
}

function normalizeCoupon(input, { partial = false } = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw createError("Request body must be a JSON object.");
    }

    const allowedFields = new Set([
        "institution_id",
        "institution_name",
        "coupon_code",
        "description",
        "discount_type",
        "discount_value",
        "minimum_amount",
        "maximum_discount_amount",
        "valid_from",
        "valid_until",
        "usage_limit",
        "used_count",
        "is_active"
    ]);

    for (const key of Object.keys(input)) {
        if (!allowedFields.has(key)) {
            throw createError(`Unsupported field: ${key}.`);
        }
    }

    if (partial && Object.keys(input).length === 0) {
        throw createError("At least one field is required for an update.");
    }

    const result = {};

    if (hasOwn(input, "institution_id")) {
        result.institution_id = validateId(
            input.institution_id,
            "institution_id"
        );
    }

    if (hasOwn(input, "institution_name")) {
        if (
            typeof input.institution_name !== "string" ||
            !input.institution_name.trim()
        ) {
            throw createError("institution_name is required and cannot be empty.");
        }

        result.institution_name = input.institution_name.trim();
    }

    if (hasOwn(input, "coupon_code")) {
        if (
            typeof input.coupon_code !== "string" ||
            !input.coupon_code.trim()
        ) {
            throw createError("coupon_code is required.");
        }

        const couponCode = input.coupon_code.trim();

        if (couponCode.length > 50) {
            throw createError("coupon_code cannot exceed 50 characters.");
        }

        result.coupon_code = couponCode;
    }

    if (hasOwn(input, "description")) {
        if (input.description !== null && typeof input.description !== "string") {
            throw createError("description must be a string or null.");
        }

        const description =
            typeof input.description === "string"
                ? input.description.trim()
                : null;

        if (description && description.length > 255) {
            throw createError("description cannot exceed 255 characters.");
        }

        result.description = description || null;
    }

    if (hasOwn(input, "discount_type")) {
        const type = String(input.discount_type).trim().toUpperCase();

        if (!["PERCENTAGE", "FIXED"].includes(type)) {
            throw createError("discount_type must be PERCENTAGE or FIXED.");
        }

        result.discount_type = type;
    }

    if (hasOwn(input, "discount_value")) {
        result.discount_value = parseAmount(
            input.discount_value,
            "discount_value"
        );
    }

    if (hasOwn(input, "minimum_amount")) {
        result.minimum_amount = parseAmount(
            input.minimum_amount,
            "minimum_amount"
        );
    }

    if (hasOwn(input, "maximum_discount_amount")) {
        result.maximum_discount_amount = parseAmount(
            input.maximum_discount_amount,
            "maximum_discount_amount",
            true
        );
    }

    if (hasOwn(input, "valid_from")) {
        result.valid_from = parseDate(input.valid_from, "valid_from");
    }

    if (hasOwn(input, "valid_until")) {
        result.valid_until = parseDate(input.valid_until, "valid_until");
    }

    if (hasOwn(input, "usage_limit")) {
        result.usage_limit = parseOptionalInteger(
            input.usage_limit,
            "usage_limit",
            true
        );

        if (result.usage_limit !== null && result.usage_limit < 1) {
            throw createError("usage_limit must be greater than zero or null.");
        }
    }

    if (hasOwn(input, "used_count")) {
        result.used_count = parseOptionalInteger(
            input.used_count,
            "used_count"
        );
    }

    if (hasOwn(input, "is_active")) {
        result.is_active = parseBoolean(input.is_active, "is_active");
    }

    return result;
}

function mergeCoupon(current, changes) {
    return {
        institution_id: changes.institution_id ?? current.institution_id,
        institution_name:
            changes.institution_name ?? current.institution_name,
        coupon_code: changes.coupon_code ?? current.coupon_code,
        description: hasOwn(changes, "description")
            ? changes.description
            : current.description,
        discount_type: changes.discount_type ?? current.discount_type,
        discount_value: changes.discount_value ?? current.discount_value,
        minimum_amount: changes.minimum_amount ?? current.minimum_amount,
        maximum_discount_amount: hasOwn(changes, "maximum_discount_amount")
            ? changes.maximum_discount_amount
            : current.maximum_discount_amount,
        valid_from: changes.valid_from ?? current.valid_from,
        valid_until: changes.valid_until ?? current.valid_until,
        usage_limit: hasOwn(changes, "usage_limit")
            ? changes.usage_limit
            : current.usage_limit,
        used_count: changes.used_count ?? current.used_count,
        is_active: hasOwn(changes, "is_active")
            ? changes.is_active
            : current.is_active
    };
}

function validateCompleteCoupon(data) {
    const required = [
        "institution_id",
        "institution_name",
        "coupon_code",
        "discount_type",
        "discount_value",
        "valid_from",
        "valid_until"
    ];

    for (const field of required) {
        if (
            data[field] === undefined ||
            data[field] === null ||
            data[field] === ""
        ) {
            throw createError(`${field} is required.`);
        }
    }

    if (
        data.discount_type === "PERCENTAGE" &&
        data.discount_value > 100
    ) {
        throw createError("Percentage discount_value cannot exceed 100.");
    }

    if (new Date(data.valid_until) < new Date(data.valid_from)) {
        throw createError("valid_until must be on or after valid_from.");
    }

    if (
        data.usage_limit !== null &&
        data.usage_limit !== undefined &&
        data.used_count > data.usage_limit
    ) {
        throw createError("used_count cannot exceed usage_limit.");
    }

    if (
        data.maximum_discount_amount !== null &&
        data.maximum_discount_amount !== undefined &&
        data.discount_type !== "PERCENTAGE"
    ) {
        throw createError(
            "maximum_discount_amount is only supported for PERCENTAGE coupons."
        );
    }
}

async function validateInstitution(institutionId, institutionName) {
    const institution = await repository.findInstitutionById(institutionId);

    if (!institution) {
        throw createError(
            "The selected institution does not exist, is inactive, or has been deleted.",
            400
        );
    }

    if (
        institution.institution_name.trim().toLowerCase() !==
        institutionName.trim().toLowerCase()
    ) {
        throw createError(
            "institution_id and institution_name do not match.",
            400
        );
    }

    return institution;
}

async function ensureUniqueCouponCode(code, excludeId = null) {
    const duplicate = await repository.findDuplicateCode(code, excludeId);

    if (duplicate) {
        throw createError("A coupon with this coupon_code already exists.", 409);
    }
}

function normalizeDatabaseError(error) {
    if (error.statusCode) return error;

    if (error.code === "23505") {
        return createError("A record with the same unique value already exists.", 409);
    }

    if (error.code === "23514" || error.code === "22P02" ||
        error.code === "22003" || error.code === "22007" ||
        error.code === "22008" || error.code === "23502" ||
        error.code === "22001") {
        return createError(
            "The submitted coupon data violates a database constraint.",
            400
        );
    }

    return error;
}

async function getCoupons(query = {}) {
    try {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 20);

        if (!Number.isInteger(page) || page < 1) {
            throw createError("page must be a positive integer.");
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            throw createError("limit must be between 1 and 100.");
        }

        let institutionId = null;
        if (query.institution_id !== undefined) {
            institutionId = validateId(query.institution_id, "institution_id");
        }

        let isActive = null;
        if (query.is_active !== undefined) {
            isActive = parseBoolean(query.is_active, "is_active");
        }

        let includeDeleted = false;
        if (query.include_deleted !== undefined) {
            includeDeleted = parseBoolean(
                query.include_deleted,
                "include_deleted"
            );
        }

        return await repository.findAll({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            institutionId,
            isActive,
            includeDeleted
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getCouponById(id) {
    try {
        const validId = validateId(id);

        const coupon = await repository.findById(validId);

        if (!coupon) {
            throw createError("Coupon not found.", 404);
        }

        return coupon;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

function getActorId(user) {
    if (user?.id === undefined || user?.id === null) {
        return null;
    }

    return validateId(String(user.id), "authenticated user id");
}

async function createCoupon(input, user) {
    try {
        const data = normalizeCoupon(input);

        data.minimum_amount ??= 0;
        data.maximum_discount_amount ??= null;
        data.usage_limit ??= null;
        data.used_count ??= 0;
        data.is_active ??= true;
        data.description ??= null;

        validateCompleteCoupon(data);
        await validateInstitution(data.institution_id, data.institution_name);
        await ensureUniqueCouponCode(data.coupon_code);

        const actorId = getActorId(user);
        return await repository.create(data, actorId);
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function updateCoupon(id, input, user) {
    try {
        const validId = validateId(id);
        const current = await repository.findById(validId);

        if (!current) {
            throw createError("Coupon not found.", 404);
        }

        const changes = normalizeCoupon(input, { partial: true });

        const institutionChanged =
            hasOwn(changes, "institution_id") ||
            hasOwn(changes, "institution_name");

        if (
            institutionChanged &&
            (!hasOwn(changes, "institution_id") ||
                !hasOwn(changes, "institution_name"))
        ) {
            throw createError(
                "When changing the institution, submit both institution_id and institution_name."
            );
        }

        const merged = mergeCoupon(current, changes);
        validateCompleteCoupon(merged);

        await validateInstitution(
            merged.institution_id,
            merged.institution_name
        );

        if (
            merged.coupon_code.toLowerCase() !==
            current.coupon_code.toLowerCase()
        ) {
            await ensureUniqueCouponCode(merged.coupon_code, validId);
        }

        const actorId = getActorId(user);
        const updated = await repository.update(validId, merged, actorId);

        if (!updated) {
            throw createError("Coupon not found.", 404);
        }

        return updated;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function deleteCoupon(id, user) {
    try {
        const validId = validateId(id);
        const actorId = getActorId(user);

        const deleted = await repository.softDelete(validId, actorId);

        if (!deleted) {
            throw createError("Coupon not found.", 404);
        }

        return deleted;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getInstitutionDropdown() {
    try {
        return await repository.getInstitutionDropdown();
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

module.exports = {
    getCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    getInstitutionDropdown
};