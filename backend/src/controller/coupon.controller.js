const service = require("../services/coupon.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

function sendError(res, error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error("Coupon API error:", error);
    }

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? "Internal server error"
                : error.message
    });
}

async function getAll(req, res) {
    try {
        const result = await service.getCoupons(req.query);

        return res.status(200).json({
            success: true,
            message: "Coupons retrieved successfully",
            count: result.rows.length,
            pagination: result.pagination,
            data: result.rows
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function getById(req, res) {
    try {
        const coupon = await service.getCouponById(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Coupon retrieved successfully",
            data: coupon
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function create(req, res) {
    try {
        const { createdBy } = getCreateAudit(req);
        const coupon = await service.createCoupon(req.body, {
            ...req.user,
            id: createdBy
        });

        return res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            data: coupon
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function update(req, res) {
    try {
        const { updatedBy } = getUpdateAudit(req);
        const coupon = await service.updateCoupon(
            req.params.id,
            req.body,
            { ...req.user, id: updatedBy }
        );

        return res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            data: coupon
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function remove(req, res) {
    try {
        const { updatedBy } = getDeleteAudit(req);
        const coupon = await service.deleteCoupon(
            req.params.id,
            { ...req.user, id: updatedBy }
        );

        return res.status(200).json({
            success: true,
            message: "Coupon soft-deleted successfully",
            data: coupon
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function getInstitutionDropdown(req, res) {
    try {
        const institutions = await service.getInstitutionDropdown();

        return res.status(200).json({
            success: true,
            message: "Institutions retrieved successfully",
            count: institutions.length,
            data: institutions
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    getInstitutionDropdown
};
