const service = require("../services/coursecategory.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

function sendError(res, error) {
    console.error("Course category API error:", error.message);

    let statusCode = error.statusCode || 500;
    let message = error.message || "Internal server error.";

    if (error.code === "23505") {
        statusCode = 409;
        message = "Category code or name already exists.";
    } else if (error.code === "23503") {
        statusCode = 409;
        message =
            "Cannot complete this operation because the category is referenced by another record.";
    } else if (error.code === "23514") {
        statusCode = 400;
        message = "Category data violates a database constraint.";
    } else if (error.code === "22P02") {
        statusCode = 400;
        message = "Invalid value supplied for a database field.";
    } else if (statusCode >= 500) {
        statusCode = 500;
        message = "Internal server error.";
    }

    return res.status(statusCode).json({
        success: false,
        message,
    });
}

async function getAll(req, res) {
    try {
        const categories = await service.getAll();

        return res.status(200).json({
            success: true,
            message: "Course categories retrieved successfully.",
            count: categories.length,
            data: categories,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function getById(req, res) {
    try {
        const category = await service.getById(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Course category retrieved successfully.",
            data: category,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function create(req, res) {
    try {
        const { createdBy } = getCreateAudit(req);
        const category = await service.create(req.body, createdBy);

        return res.status(201).json({
            success: true,
            message: "Course category created successfully.",
            data: category,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function update(req, res) {
    try {
        const { updatedBy } = getUpdateAudit(req);
        const category = await service.update(
            req.params.id,
            req.body,
            updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Course category updated successfully.",
            data: category,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function remove(req, res) {
    try {
        const { updatedBy } = getDeleteAudit(req);
        const category = await service.remove(req.params.id, updatedBy);

        return res.status(200).json({
            success: true,
            message: "Course category soft-deleted successfully.",
            data: category,
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
};
