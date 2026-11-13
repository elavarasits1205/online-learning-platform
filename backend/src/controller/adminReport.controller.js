const service = require("../services/adminReport.service");

function sendReport(res, result, message) {
    return res.status(200).json({
        success: true,
        message,
        data: result.rows,
        pagination: result.pagination,
        summary: result.summary
    });
}

async function getPayrollReport(req, res, next) {
    try {
        const result = await service.getPayrollReport(req.query);

        return sendReport(
            res,
            result,
            "Payroll report retrieved successfully."
        );
    } catch (error) {
        return next(error);
    }
}

async function getEnrollmentReport(req, res, next) {
    try {
        const result = await service.getEnrollmentReport(req.query);

        return sendReport(
            res,
            result,
            "Enrollment report retrieved successfully."
        );
    } catch (error) {
        return next(error);
    }
}

async function getUserReport(req, res, next) {
    try {
        const result = await service.getUserReport(req.query);

        return sendReport(
            res,
            result,
            "User report retrieved successfully."
        );
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getPayrollReport,
    getEnrollmentReport,
    getUserReport
};
