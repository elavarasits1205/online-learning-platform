const repository = require("../repositories/couponRedemption.repository");

const {
    createError,
    validateId,
    parseBoolean,
    normalizeDatabaseError
} = require("../utils/coupon-child.helpers");

const ALLOWED_STATUSES = ["RESERVED", "REDEEMED", "CANCELLED"];

async function getCouponRedemptions(query = {}) {
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

        const paymentId = query.payment_id !== undefined
            ? validateId(query.payment_id, "payment_id")
            : null;

        let status = null;
        if (query.status !== undefined && query.status !== "") {
            status = String(query.status).trim().toUpperCase();

            if (!ALLOWED_STATUSES.includes(status)) {
                throw createError(
                    "status must be RESERVED, REDEEMED, or CANCELLED."
                );
            }
        }

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
            paymentId,
            status,
            isActive,
            includeDeleted
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getCouponRedemptionById(id) {
    try {
        const validId = validateId(id);
        const redemption = await repository.findById(validId);

        if (!redemption) {
            throw createError("Coupon redemption not found.", 404);
        }

        return redemption;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getDropdowns() {
    try {
        const [coupons, students] = await Promise.all([
            repository.getCouponDropdown(),
            repository.getStudentDropdown()
        ]);

        return { coupons, students };
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

module.exports = {
    getCouponRedemptions,
    getCouponRedemptionById,
    getDropdowns
};
