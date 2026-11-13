
const service = require("../services/rolePermission.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

async function getAllRolePermissions(req, res, next) {
    try {
        const data = await service.getAllRolePermissions(req.query);

        return res.status(200).json({
            success: true,
            count: data.length,
            data,
        });
    } catch (error) {
        return next(error);
    }
}

async function getRolePermissionById(req, res, next) {
    try {
        const data = await service.getRolePermissionById(req.params.id);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
}

async function createRolePermission(req, res, next) {
    try {
        const data = await service.createRolePermission(
            req.body,
            getCreateAudit(req).createdBy
        );

        return res.status(201).json({
            success: true,
            message: "Role permission saved successfully",
            data,
        });
    } catch (error) {
        return next(error);
    }
}

async function updateRolePermission(req, res, next) {
    try {
        const data = await service.updateRolePermission(
            req.params.id,
            req.body,
            getUpdateAudit(req).updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Role permission updated successfully",
            data,
        });
    } catch (error) {
        return next(error);
    }
}

async function updateRolePermissionStatus(req, res, next) {
    try {
        const data = await service.updateRolePermissionStatus(
            req.params.id,
            req.body,
            getUpdateAudit(req).updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Role permission status updated successfully",
            data,
        });
    } catch (error) {
        return next(error);
    }
}

async function deleteRolePermission(req, res, next) {
    try {
        const data = await service.deleteRolePermission(
            req.params.id,
            getDeleteAudit(req).updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Role permission deleted successfully",
            data,
        });
    } catch (error) {
        return next(error);
    }
}

async function getRoleMenuPermissions(req, res, next) {
    try {
        const data = await service.getRoleMenuPermissions(
            req.params.roleId
        );

        return res.status(200).json({
            success: true,
            count: data.length,
            data,
        });
    } catch (error) {
        return next(error);
    }
}

async function getEffectivePermissions(req, res, next) {
    try {
        const data = await service.getEffectivePermissions(
            req.params.roleId
        );

        return res.status(200).json({
            success: true,
            count: data.length,
            data,
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getAllRolePermissions,
    getRolePermissionById,
    createRolePermission,
    updateRolePermission,
    updateRolePermissionStatus,
    deleteRolePermission,
    getRoleMenuPermissions,
    getEffectivePermissions,
};
