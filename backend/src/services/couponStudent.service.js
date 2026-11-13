const repository = require("../repositories/couponStudent.repository");

const {
    createError,
    hasOwn,
    validateId,
    parseBoolean,
    getActorId,
    normalizeDatabaseError
} = require("../utils/coupon-child.helpers");

function normalizeCouponStudent(input, { partial = false } = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw createError("Request body must be a JSON object.");
    }

    const allowedFields = new Set([
        "coupon_id",
        "student_id",
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

    if (hasOwn(input, "student_id")) {
        result.student_id = validateId(input.student_id, "student_id");
    }

    if (hasOwn(input, "is_active")) {
        result.is_active = parseBoolean(input.is_active, "is_active");
    }

    return result;
}

function mergeCouponStudent(current, changes) {
    return {
        coupon_id: changes.coupon_id ?? current.coupon_id,
        student_id: changes.student_id ?? current.student_id,
        is_active: changes.is_active ?? current.is_active
    };
}

function validateCompleteCouponStudent(data) {
    const required = ["coupon_id", "student_id"];

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

function getRegisterSnapshot(student) {
    const snapshot = String(
        student?.register_number ?? student?.student_code ?? ""
    ).trim();

    if (!snapshot) {
        throw createError(
            "The selected student does not have a register number.",
            400
        );
    }

    return snapshot;
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

async function validateStudent(studentId) {
    const student = await repository.findStudentById(studentId);

    if (!student) {
        throw createError(
            "The selected student does not exist or has been deleted.",
            400
        );
    }

    return student;
}

function ensureSameInstitution(coupon, student) {
    if (
        String(coupon.institution_id) !== String(student.institution_id)
    ) {
        throw createError(
            "The selected student does not belong to the coupon's institution.",
            400
        );
    }
}

async function ensureUniquePair(couponId, studentId, excludeId = null) {
    const duplicate = await repository.findDuplicate(
        couponId,
        studentId,
        excludeId
    );

    if (duplicate) {
        throw createError(
            "This student is already mapped to the selected coupon.",
            409
        );
    }
}

async function createOrRevive(data, actorId) {
    const duplicate = await repository.findDuplicate(
        data.coupon_id,
        data.student_id
    );

    if (!duplicate) {
        return repository.create(data, actorId);
    }

    if (!parseBoolean(duplicate.soft_delete, "soft_delete")) {
        throw createError(
            "This student is already mapped to the selected coupon.",
            409
        );
    }

    const revived = await repository.revive(
        duplicate.id,
        data,
        actorId
    );

    if (!revived) {
        throw createError("Unable to restore the coupon student mapping.", 409);
    }

    return revived;
}

async function getCouponStudents(query = {}) {
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

        const studentId = query.student_id !== undefined
            ? validateId(query.student_id, "student_id")
            : null;

        const isActive = query.is_active !== undefined
            ? parseBoolean(query.is_active, "is_active")
            : null;

        const includeDeleted = query.include_deleted !== undefined
            ? parseBoolean(query.include_deleted, "include_deleted")
            : false;

        return await repository.findAll({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            couponId,
            studentId,
            isActive,
            includeDeleted
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getCouponStudentById(id) {
    try {
        const validId = validateId(id);
        const couponStudent = await repository.findById(validId);

        if (!couponStudent) {
            throw createError("Coupon student mapping not found.", 404);
        }

        return couponStudent;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function createCouponStudent(input, user) {
    try {
        const data = normalizeCouponStudent(input);
        data.is_active ??= true;

        validateCompleteCouponStudent(data);

        const coupon = await validateCoupon(data.coupon_id);
        const student = await validateStudent(data.student_id);

        ensureSameInstitution(coupon, student);

        data.register_number_snapshot = getRegisterSnapshot(student);

        return await createOrRevive(data, getActorId(user));
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function updateCouponStudent(id, input, user) {
    try {
        const validId = validateId(id);
        const current = await repository.findById(validId);

        if (!current) {
            throw createError("Coupon student mapping not found.", 404);
        }

        const changes = normalizeCouponStudent(input, { partial: true });
        const merged = mergeCouponStudent(current, changes);

        validateCompleteCouponStudent(merged);

        const coupon = await validateCoupon(merged.coupon_id);
        const student = await validateStudent(merged.student_id);

        ensureSameInstitution(coupon, student);

        merged.register_number_snapshot = getRegisterSnapshot(student);

        if (
            String(merged.coupon_id) !== String(current.coupon_id) ||
            String(merged.student_id) !== String(current.student_id)
        ) {
            await ensureUniquePair(
                merged.coupon_id,
                merged.student_id,
                validId
            );
        }

        const updated = await repository.update(
            validId,
            merged,
            getActorId(user)
        );

        if (!updated) {
            throw createError("Coupon student mapping not found.", 404);
        }

        return updated;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function deleteCouponStudent(id, user) {
    try {
        const validId = validateId(id);
        const deleted = await repository.softDelete(validId, getActorId(user));

        if (!deleted) {
            throw createError("Coupon student mapping not found.", 404);
        }

        return deleted;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getDropdowns(query = {}) {
    try {
        const couponId = query.coupon_id !== undefined
            ? validateId(query.coupon_id, "coupon_id")
            : null;

        const [coupons, students] = await Promise.all([
            repository.getCouponDropdown(),
            repository.getStudentDropdown(couponId)
        ]);

        return { coupons, students };
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

module.exports = {
    getCouponStudents,
    getCouponStudentById,
    createCouponStudent,
    updateCouponStudent,
    deleteCouponStudent,
    getDropdowns
};
