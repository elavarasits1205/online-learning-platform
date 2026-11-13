
const service = require("../services/institution.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

function sendError(res, error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error("Institution API error:", error);
    }

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? "Internal server error"
                : error.message,
    });
}

function getInstitutionInput(req) {
    const input = { ...(req.body || {}) };

    if (input.is_active === "true") {
        input.is_active = true;
    } else if (input.is_active === "false") {
        input.is_active = false;
    }

    return input;
}

async function createInstitution(req, res) {
    try {
        const institution = await service.createInstitution(
            getInstitutionInput(req),
            { ...req.user, id: getCreateAudit(req).createdBy },
            req.file
        );

        return res.status(201).json({
            success: true,
            message: "Institution created successfully",
            data: institution,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function getInstitutions(req, res) {
    try {
        const result = await service.getInstitutions(req.query);

        return res.status(200).json({
            success: true,
            message: "Institutions retrieved successfully",
            data: result.rows,
            pagination: result.pagination,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function getInstitutionById(req, res) {
    try {
        const institution = await service.getInstitutionById(
            req.params.id
        );

        return res.status(200).json({
            success: true,
            message: "Institution retrieved successfully",
            data: institution,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function updateInstitution(req, res) {
    try {
        const institution = await service.updateInstitution(
            req.params.id,
            getInstitutionInput(req),
            { ...req.user, id: getUpdateAudit(req).updatedBy },
            req.file
        );

        return res.status(200).json({
            success: true,
            message: "Institution updated successfully",
            data: institution,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function deleteInstitution(req, res) {
    try {
        await service.deleteInstitution(
            req.params.id,
            { ...req.user, id: getDeleteAudit(req).updatedBy }
        );

        return res.status(200).json({
            success: true,
            message: "Institution deleted successfully",
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    createInstitution,
    getInstitutions,
    getInstitutionById,
    updateInstitution,
    deleteInstitution,
};
