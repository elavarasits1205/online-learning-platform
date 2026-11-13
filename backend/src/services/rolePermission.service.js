
const repository = require("../repositories/rolePermission.repository");

// ============================================================
// ERROR HELPER
// ============================================================

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// ============================================================
// VALIDATE BIGINT ID
// ============================================================

function validateId(value, fieldName = "id") {
    const id = String(value ?? "").trim();

    // PostgreSQL BIGINT IDs must remain strings.
    if (!/^[1-9]\d*$/.test(id)) {
        throw createError(`Invalid ${fieldName}`, 400);
    }

    return id;
}

// ============================================================
// VALIDATE BOOLEAN
// ============================================================

function validateBoolean(value, fieldName) {
    if (typeof value !== "boolean") {
        throw createError(`${fieldName} must be a boolean`, 400);
    }

    return value;
}

// ============================================================
// VALIDATE REQUEST BODY
// ============================================================

function validateBody(body) {
    if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
    ) {
        throw createError("Request body must be an object", 400);
    }
}

// ============================================================
// VALIDATE AUDIT USER ID
// ============================================================

function validateAuditUserId(auditUserId) {
    if (
        auditUserId === null ||
        auditUserId === undefined ||
        auditUserId === ""
    ) {
        return null;
    }

    return validateId(auditUserId, "auditUserId");
}

// ============================================================
// GET ALL ROLE PERMISSIONS
// ============================================================

async function getAllRolePermissions(query = {}) {
    const roleId =
        query.roleId === undefined ||
        query.roleId === null ||
        query.roleId === ""
            ? null
            : validateId(query.roleId, "roleId");

    const includeInactive =
        query.includeInactive === true ||
        String(query.includeInactive).toLowerCase() === "true";

    return repository.getAllRolePermissions({
        roleId,
        includeInactive
    });
}

// ============================================================
// GET ROLE PERMISSION BY ID
// ============================================================

async function getRolePermissionById(id) {
    const validId = validateId(id);

    const assignment =
        await repository.getRolePermissionById(validId);

    if (!assignment) {
        throw createError("Role permission not found", 404);
    }

    return assignment;
}

// ============================================================
// CREATE ROLE PERMISSION
// ============================================================

async function createRolePermission(body, auditUserId = null) {
    validateBody(body);

    const roleId = validateId(body.roleId, "roleId");

    const permissionId = validateId(
        body.permissionId,
        "permissionId"
    );

    const isActive =
        body.isActive === undefined
            ? true
            : validateBoolean(body.isActive, "isActive");

    return repository.createRolePermission({
        roleId,
        permissionId,
        isActive,
        auditUserId: validateAuditUserId(auditUserId)
    });
}

// ============================================================
// UPDATE ROLE PERMISSION
// ============================================================

async function updateRolePermission(
    id,
    body,
    auditUserId = null
) {
    const validId = validateId(id);

    validateBody(body);

    const payload = {
        auditUserId: validateAuditUserId(auditUserId)
    };

    if (body.roleId !== undefined) {
        payload.roleId = validateId(body.roleId, "roleId");
    }

    if (body.permissionId !== undefined) {
        payload.permissionId = validateId(
            body.permissionId,
            "permissionId"
        );
    }

    if (body.isActive !== undefined) {
        payload.isActive = validateBoolean(
            body.isActive,
            "isActive"
        );
    }

    if (
        payload.roleId === undefined &&
        payload.permissionId === undefined &&
        payload.isActive === undefined
    ) {
        throw createError(
            "At least one field must be provided",
            400
        );
    }

    return repository.updateRolePermission(validId, payload);
}

// ============================================================
// UPDATE ROLE PERMISSION STATUS
// ============================================================

async function updateRolePermissionStatus(
    id,
    body,
    auditUserId = null
) {
    validateBody(body);

    const rawStatus =
        body.isActive !== undefined
            ? body.isActive
            : body.is_active;

    const isActive = validateBoolean(
        rawStatus,
        body.isActive !== undefined ? "isActive" : "is_active"
    );

    return repository.updateRolePermissionStatus(
        validateId(id),
        isActive,
        validateAuditUserId(auditUserId)
    );
}

// ============================================================
// DELETE ROLE PERMISSION
// ============================================================

async function deleteRolePermission(id, auditUserId = null) {
    return repository.deleteRolePermission(
        validateId(id),
        validateAuditUserId(auditUserId)
    );
}

// ============================================================
// GET ROLE MENU PERMISSIONS
// ============================================================

async function getRoleMenuPermissions(roleId) {
    const validRoleId = validateId(roleId, "roleId");

    const role = await repository.findActiveRole(validRoleId);

    if (!role) {
        throw createError("Active role not found", 404);
    }

    return repository.getRoleMenuPermissions(validRoleId);
}

// ============================================================
// GET EFFECTIVE PERMISSIONS
// ============================================================

async function getEffectivePermissions(roleId) {
    const validRoleId = validateId(roleId, "roleId");

    const role = await repository.findActiveRole(validRoleId);

    if (!role) {
        throw createError("Active role not found", 404);
    }

    return repository.getEffectivePermissions(validRoleId);
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    getAllRolePermissions,
    getRolePermissionById,
    createRolePermission,
    updateRolePermission,
    updateRolePermissionStatus,
    deleteRolePermission,
    getRoleMenuPermissions,
    getEffectivePermissions
};
