const repository = require("../repositories/couponCourse.repository");

const {
    createError,
    hasOwn,
    validateId,
    parseBoolean,
    getActorId,
    normalizeDatabaseError
} = require("../utils/coupon-child.helpers");

function normalizeCouponCourse(input, { partial = false } = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw createError("Request body must be a JSON object.");
    }

    const allowedFields = new Set([
        "coupon_id",
        "course_id",
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

    if (hasOwn(input, "coupon_id")) {
        result.coupon_id = validateId(input.coupon_id, "coupon_id");
    }

    if (hasOwn(input, "course_id")) {
        result.course_id = validateId(input.course_id, "course_id");
    }

    if (hasOwn(input, "is_active")) {
        result.is_active = parseBoolean(input.is_active, "is_active");
    }

    return result;
}

function mergeCouponCourse(current, changes) {
    return {
        coupon_id: changes.coupon_id ?? current.coupon_id,
        course_id: changes.course_id ?? current.course_id,
        is_active: hasOwn(changes, "is_active")
            ? changes.is_active
            : current.is_active
    };
}

function validateCompleteCouponCourse(data) {
    const required = ["coupon_id", "course_id"];

    for (const field of required) {
        if (
            data[field] === undefined ||
            data[field] === null ||
            data[field] === ""
        ) {
            throw createError(`${field} is required.`);
        }
    }
}

async function validateCoupon(couponId) {
    const coupon = await repository.findCouponById(couponId);

    if (!coupon) {
        throw createError(
            "The selected coupon does not exist or has been deleted.",
            400
        );
    }

    return coupon;
}

async function validateCourse(courseId) {
    const course = await repository.findCourseById(courseId);

    if (!course) {
        throw createError(
            "The selected course does not exist or has been deleted.",
            400
        );
    }

    return course;
}

async function ensureUniquePair(couponId, courseId, excludeId = null) {
    const duplicate = await repository.findDuplicate(
        couponId,
        courseId,
        excludeId
    );

    if (duplicate) {
        throw createError(
            "This course is already mapped to the selected coupon.",
            409
        );
    }
}

async function getCouponCourses(query = {}) {
    try {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 20);

        if (!Number.isInteger(page) || page < 1) {
            throw createError("page must be a positive integer.");
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            throw createError("limit must be between 1 and 100.");
        }

        const couponId = query.coupon_id !== undefined
            ? validateId(query.coupon_id, "coupon_id")
            : null;

        const courseId = query.course_id !== undefined
            ? validateId(query.course_id, "course_id")
            : null;

        const isActive = query.is_active !== undefined
            ? parseBoolean(query.is_active, "is_active")
            : null;

        return await repository.findAll({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            couponId,
            courseId,
            isActive
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getCouponCourseById(id) {
    try {
        const validId = validateId(id);
        const couponCourse = await repository.findById(validId);

        if (!couponCourse) {
            throw createError("Coupon course mapping not found.", 404);
        }

        return couponCourse;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function createCouponCourse(input, user) {
    try {
        const data = normalizeCouponCourse(input);

        data.is_active ??= true;

        validateCompleteCouponCourse(data);
        await validateCoupon(data.coupon_id);
        await validateCourse(data.course_id);
        await ensureUniquePair(data.coupon_id, data.course_id);

        return await repository.create(data, getActorId(user));
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function updateCouponCourse(id, input, user) {
    try {
        const validId = validateId(id);
        const current = await repository.findById(validId);

        if (!current) {
            throw createError("Coupon course mapping not found.", 404);
        }

        const changes = normalizeCouponCourse(input, { partial: true });
        const merged = mergeCouponCourse(current, changes);

        validateCompleteCouponCourse(merged);
        await validateCoupon(merged.coupon_id);
        await validateCourse(merged.course_id);

        if (
            String(merged.coupon_id) !== String(current.coupon_id) ||
            String(merged.course_id) !== String(current.course_id)
        ) {
            await ensureUniquePair(
                merged.coupon_id,
                merged.course_id,
                validId
            );
        }

        const updated = await repository.update(
            validId,
            merged,
            getActorId(user)
        );

        if (!updated) {
            throw createError("Coupon course mapping not found.", 404);
        }

        return updated;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function deleteCouponCourse(id, user) {
    try {
        const validId = validateId(id);
        const current = await repository.findById(validId);

        if (!current) {
            throw createError("Coupon course mapping not found.", 404);
        }

        const deactivated = await repository.remove(
            validId,
            getActorId(user)
        );

        if (!deactivated) {
            throw createError("Coupon course mapping is already inactive.", 404);
        }

        return deactivated;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getDropdowns() {
    try {
        const [coupons, courses] = await Promise.all([
            repository.getCouponDropdown(),
            repository.getCourseDropdown()
        ]);

        return { coupons, courses };
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

module.exports = {
    getCouponCourses,
    getCouponCourseById,
    createCouponCourse,
    updateCouponCourse,
    deleteCouponCourse,
    getDropdowns
};
