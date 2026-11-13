const service = require("../services/adminDashboard.service");

async function getSummary(req, res, next) {
    try {
        const summary = await service.getSummary();

        return res.status(200).json({
            success: true,
            message: "Admin dashboard summary retrieved successfully.",
            data: summary
        });
    } catch (error) {
        return next(error);
    }
}

async function getWidgets(req, res, next) {
    try {
        const widgets = await service.getWidgets();

        return res.status(200).json({
            success: true,
            message: "Admin dashboard widgets retrieved successfully.",
            data: widgets
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getSummary,
    getWidgets
};
