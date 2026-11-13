const service = require("../services/couponStudent.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

function sendError(res, error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error("Coupon Student API error:", error);
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
        const result = await service.getCouponStudents(req.query);

        return res.status(200).json({
            success: true,
            message: "Coupon students retrieved successfully",
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
        const couponStudent = await service.getCouponStudentById(
            req.params.id
        );

        return res.status(200).json({
            success: true,
            message: "Coupon student retrieved successfully",
            data: couponStudent
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function create(req, res) {
    try {
        const { createdBy } = getCreateAudit(req);
        const couponStudent = await service.createCouponStudent(
            req.body,
            { ...req.user, id: createdBy }
        );

        return res.status(201).json({
            success: true,
            message: "Coupon student created successfully",
            data: couponStudent
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function update(req, res) {
    try {
        const { updatedBy } = getUpdateAudit(req);
        const couponStudent = await service.updateCouponStudent(
            req.params.id,
            req.body,
            { ...req.user, id: updatedBy }
        );

        return res.status(200).json({
            success: true,
            message: "Coupon student updated successfully",
            data: couponStudent
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function remove(req, res) {
    try {
        const { updatedBy } = getDeleteAudit(req);
        const couponStudent = await service.deleteCouponStudent(
            req.params.id,
            { ...req.user, id: updatedBy }
        );

        return res.status(200).json({
            success: true,
            message: "Coupon student soft-deleted successfully",
            data: couponStudent
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function getDropdowns(req, res) {
    try {
        const dropdowns = await service.getDropdowns(req.query);

        return res.status(200).json({
            success: true,
            message: "Coupon student dropdowns retrieved successfully",
            data: dropdowns
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
    getDropdowns
};
