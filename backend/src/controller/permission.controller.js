
const permissionService = require("../services/permission.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

function sendError(res, error) {
    console.error("Permission API error:", error.message);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode === 500
                ? "Internal server error"
                : error.message
    });
}

// GET /api/permissions
async function getAllPermissions(req, res) {
    try {
        const permissions =
            await permissionService.getAllPermissions();

        return res.status(200).json({
            success: true,
            message: "Permissions retrieved successfully",
            data: permissions
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// GET /api/permissions/:id
async function getPermissionById(req, res) {
    try {
        const permission =
            await permissionService.getPermissionById(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Permission retrieved successfully",
            data: permission
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// POST /api/permissions
async function createPermission(req, res) {
    try {
        const { createdBy } = getCreateAudit(req);
        const permission = await permissionService.createPermission(
            req.body,
            createdBy
        );

        return res.status(201).json({
            success: true,
            message: "Permission created successfully",
            data: permission
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// PUT /api/permissions/:id
async function updatePermission(req, res) {
    try {
        const { updatedBy } = getUpdateAudit(req);
        const permission = await permissionService.updatePermission(
            req.params.id,
            req.body,
            updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Permission updated successfully",
            data: permission
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// DELETE /api/permissions/:id
async function deletePermission(req, res) {
    try {
        const { updatedBy } = getDeleteAudit(req);
        const permission = await permissionService.deletePermission(
            req.params.id,
            updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Permission soft-deleted successfully",
            data: permission
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    getAllPermissions,
    getPermissionById,
    createPermission,
    updatePermission,
    deletePermission
};
