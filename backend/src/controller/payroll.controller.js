
const service = require("../services/payroll.service");

const CONSTRAINT_MESSAGES = {
    chk_icc_type: "Invalid compensation type.",
    chk_icc_type_values:
        "Provide the amount fields required by the selected compensation type.",
    chk_ice_earning_type: "Invalid earning type.",
    chk_instructor_payroll_status: "Invalid instructor payroll status.",
    chk_payroll_period_status: "Invalid payroll period status.",
    chk_payroll_payment_method: "Invalid payment method.",
    chk_payroll_payment_status: "Invalid payment status.",
    chk_payroll_payment_amount: "Payment amount must be greater than zero.",
    chk_instructor_payroll_net:
        "Net amount must equal course earnings plus incentives minus deductions.",
    chk_instructor_payroll_incentive:
        "Incentive amount cannot be negative.",
    uq_payroll_period_code: "A payroll period with this code already exists.",
    uq_instructor_payroll_number:
        "An instructor payroll with this number already exists.",
    uq_instructor_payroll_period_instructor:
        "This instructor already has a payroll for the selected period.",
    uq_payroll_payment_number:
        "A payment with this number already exists."
};

const sendError = (res, error) => {
    console.error("Payroll API Error:", error);

    let status = 500;
    let message = "Payroll operation failed. Please retry or contact an administrator.";

    if (error.code === "23505") {
        status = 409;
        message =
            CONSTRAINT_MESSAGES[error.constraint] ||
            "A record with the same unique value already exists.";
    } else if (error.code === "23503") {
        status = 400;
        message = "Invalid foreign-key reference. Check the related record.";
    } else if (error.code === "23502") {
        status = 400;
        message = "Complete all required payroll fields.";
    } else if (error.code === "23514") {
        status = 400;
        message =
            CONSTRAINT_MESSAGES[error.constraint] ||
            "One or more values violate payroll rules.";
    } else if (error.code === "22P02") {
        status = 400;
        message = /bigint|integer|numeric/i.test(error.message || "")
            ? "IDs and numeric fields must contain valid values."
            : "Invalid request data format.";
    } else if (error.code === "22007" || error.code === "22008") {
        status = 400;
        message = "Invalid date or time value.";
    } else if (error.code === "42703" || error.code === "42P01") {
        status = 503;
        message =
            "The payroll database is missing a required migration. Apply the latest payroll migrations and retry.";
    } else if (
        Number.isInteger(error.statusCode) &&
        error.statusCode >= 400 &&
        error.statusCode < 500
    ) {
        status = error.statusCode;
        message = error.message || "Payroll request could not be completed.";
    }

    return res.status(status).json({
        success: false,
        message
    });
};

const success = (res, data, message, status = 200) => {
    return res.status(status).json({
        success: true,
        message,
        data
    });
};

const getAll = (type) => async (req, res) => {
    try {
        const result = await service.getAll(type, req.query, req.user);
        return success(res, result, "Records retrieved successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const getById = (type) => async (req, res) => {
    try {
        const result = await service.getById(type, req.params.id, req.user);
        return success(res, result, "Record retrieved successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const create = (type) => async (req, res) => {
    try {
        const result = await service.create(type, req.body, req.user);
        return success(res, result, "Record created successfully.", 201);
    } catch (error) {
        return sendError(res, error);
    }
};

const update = (type) => async (req, res) => {
    try {
        const result = await service.update(
            type,
            req.params.id,
            req.body,
            req.user
        );
        return success(res, result, "Record updated successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const remove = (type) => async (req, res) => {
    try {
        const result = await service.remove(type, req.params.id, req.user);
        return success(res, result, "Record deleted successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const getInstructorOverview = async (req, res) => {
    try {
        const result = await service.getOverview(req.user);
        return success(res, result, "Instructor earnings overview retrieved.");
    } catch (error) {
        return sendError(res, error);
    }
};

const getReports = async (req, res) => {
    try {
        const result = await service.getReports(req.query, req.user);
        return success(res, result, "Payroll reports retrieved successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const getInstructorPayslip = async (req, res) => {
    try {
        const result = await service.getPayslip(
            req.params.payrollId,
            req.user
        );
        return success(res, result, "Payslip retrieved successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const getCompensationInstructorCourses = async (req, res) => {
    try {
        const result = await service.getCompensationInstructorCourses(req.user);
        return success(res, result, "Instructor courses retrieved successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const calculatePeriod = async (req, res) => {
    try {
        const result = await service.calculatePeriod(req.params.id, req.user);
        return success(res, result, "Course earnings and instructor payrolls calculated successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const getReferralSettings = async (req, res) => {
    try {
        const result = await service.getReferralSettings(req.user);
        return success(res, result, "Referral master settings retrieved successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

const saveReferralSettings = async (req, res) => {
    try {
        const result = await service.saveReferralSettings(req.body, req.user);
        return success(res, result, "Referral master settings saved successfully.");
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    getInstructorOverview,
    getReports,
    getInstructorPayslip,
    getCompensationInstructorCourses,
    calculatePeriod,
    getReferralSettings,
    saveReferralSettings
};
