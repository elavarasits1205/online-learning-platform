const service = require("../services/couponRedemption.service");

function sendError(res, error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error("Coupon Redemption API error:", error);
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
        const result = await service.getCouponRedemptions(req.query);

        return res.status(200).json({
            success: true,
            message: "Coupon redemptions retrieved successfully",
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
        const redemption = await service.getCouponRedemptionById(
            req.params.id
        );

        return res.status(200).json({
            success: true,
            message: "Coupon redemption retrieved successfully",
            data: redemption
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
            message: "Coupon redemption dropdowns retrieved successfully",
            data: dropdowns
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    getAll,
    getById,
    getDropdowns
};
