
const roleService = require("../services/role.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

function sendError(res, error) {
    console.error("Role API error:", error.message);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode === 500
                ? "Internal server error"
                : error.message
    });
}

// GET /api/roles
async function getAllRoles(req, res) {
    try {
        const roles = await roleService.getAllRoles();

        return res.status(200).json({
            success: true,
            message: "Roles retrieved successfully",
            data: roles
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// GET /api/roles/:id
async function getRoleById(req, res) {
    try {
        const role = await roleService.getRoleById(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Role retrieved successfully",
            data: role
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// POST /api/roles
async function createRole(req, res) {
    try {
        const { createdBy } = getCreateAudit(req);
        const role = await roleService.createRole(req.body, createdBy);

        return res.status(201).json({
            success: true,
            message: "Role created successfully",
            data: role
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// PUT /api/roles/:id
async function updateRole(req, res) {
    try {
        const { updatedBy } = getUpdateAudit(req);
        const role = await roleService.updateRole(
            req.params.id,
            req.body,
            updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Role updated successfully",
            data: role
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// DELETE /api/roles/:id
async function deleteRole(req, res) {
    try {
        const { updatedBy } = getDeleteAudit(req);
        const role = await roleService.deleteRole(req.params.id, updatedBy);

        return res.status(200).json({
            success: true,
            message: "Role soft-deleted successfully",
            data: role
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
};
