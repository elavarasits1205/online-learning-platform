const service = require("../services/couponCourse.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

function sendError(res, error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error("Coupon Course API error:", error);
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
        const result = await service.getCouponCourses(req.query);

        return res.status(200).json({
            success: true,
            message: "Coupon courses retrieved successfully",
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
        const couponCourse = await service.getCouponCourseById(
            req.params.id
        );

        return res.status(200).json({
            success: true,
            message: "Coupon course retrieved successfully",
            data: couponCourse
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function create(req, res) {
    try {
        const { createdBy } = getCreateAudit(req);
        const couponCourse = await service.createCouponCourse(
            req.body,
            { ...req.user, id: createdBy }
        );

        return res.status(201).json({
            success: true,
            message: "Coupon course created successfully",
            data: couponCourse
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function update(req, res) {
    try {
        const { updatedBy } = getUpdateAudit(req);
        const couponCourse = await service.updateCouponCourse(
            req.params.id,
            req.body,
            { ...req.user, id: updatedBy }
        );

        return res.status(200).json({
            success: true,
            message: "Coupon course updated successfully",
            data: couponCourse
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function remove(req, res) {
    try {
        const { updatedBy } = getDeleteAudit(req);
        const couponCourse = await service.deleteCouponCourse(
            req.params.id,
            { ...req.user, id: updatedBy }
        );

        return res.status(200).json({
            success: true,
            message: "Coupon course mapping deactivated successfully",
            data: couponCourse
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function getDropdowns(req, res) {
    try {
        const dropdowns = await service.getDropdowns();

        return res.status(200).json({
            success: true,
            message: "Coupon course dropdowns retrieved successfully",
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
