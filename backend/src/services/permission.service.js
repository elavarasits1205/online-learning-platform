
const permissionRepository =
    require("../repositories/permission.repository");

class PermissionError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = "PermissionError";
        this.statusCode = statusCode;
    }
}

function normalizePermissionInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new PermissionError(
            "Request body must be a JSON object",
            400
        );
    }

    const {
        code,
        moduleCode,
        resourceCode,
        actionCode,
        name,
        description,
        isActive
    } = body;

    const fields = [
        { key: "code", value: code, max: 150 },
        { key: "moduleCode", value: moduleCode, max: 50 },
        { key: "resourceCode", value: resourceCode, max: 100 },
        { key: "actionCode", value: actionCode, max: 50 },
        { key: "name", value: name, max: 150 }
    ];

    for (const field of fields) {
        if (
            typeof field.value !== "string" ||
            !field.value.trim()
        ) {
            throw new PermissionError(
                `${field.key} is required`,
                400
            );
        }

        if (field.value.trim().length > field.max) {
            throw new PermissionError(
                `${field.key} must not exceed ${field.max} characters`,
                400
            );
        }
    }

    if (
        description !== undefined &&
        description !== null &&
        typeof description !== "string"
    ) {
        throw new PermissionError(
            "description must be a string or null",
            400
        );
    }

    if (typeof description === "string" && description.length > 10000) {
        throw new PermissionError(
            "description must not exceed 10000 characters",
            400
        );
    }

    if (typeof isActive !== "boolean") {
        throw new PermissionError(
            "isActive must be true or false",
            400
        );
    }

    return {
        code: code.trim(),
        moduleCode: moduleCode.trim(),
        resourceCode: resourceCode.trim(),
        actionCode: actionCode.trim(),
        name: name.trim(),
        description:
            description === undefined ? null : description,
        isActive
    };
}

function validateId(id) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        throw new PermissionError("Invalid permission ID", 400);
    }

    if (BigInt(id) > 9223372036854775807n) {
        throw new PermissionError(
            "Permission ID is out of range",
            400
        );
    }
}

function handleDatabaseError(error) {
    if (error.code === "23505") {
        throw new PermissionError(
            "Permission code or module/resource/action combination already exists",
            409
        );
    }

    if (error.code === "23514") {
        throw new PermissionError(
            "Permission data violates a database constraint",
            400
        );
    }

    throw error;
}

// GET all
async function getAllPermissions() {
    return permissionRepository.findAllPermissions();
}

// GET by ID
async function getPermissionById(id) {
    validateId(id);

    const permission =
        await permissionRepository.findPermissionById(id);

    if (!permission) {
        throw new PermissionError("Permission not found", 404);
    }

    return permission;
}

// POST
async function createPermission(body, createdBy) {
    const permission = normalizePermissionInput(body);

    const duplicate =
        await permissionRepository.findDuplicatePermission(permission);

    if (duplicate) {
        throw new PermissionError(
            "Permission code or module/resource/action combination already exists",
            409
        );
    }

    try {
        return await permissionRepository.createPermission(permission, createdBy);
    } catch (error) {
        handleDatabaseError(error);
    }
}

// PUT
async function updatePermission(id, body, updatedBy) {
    validateId(id);

    const permission = normalizePermissionInput(body);

    const existingPermission =
        await permissionRepository.findPermissionById(id);

    if (!existingPermission) {
        throw new PermissionError("Permission not found", 404);
    }

    const duplicate =
        await permissionRepository.findDuplicatePermission(
            permission,
            id
        );

    if (duplicate) {
        throw new PermissionError(
            "Another permission already uses this code or module/resource/action combination",
            409
        );
    }

    try {
        const updatedPermission =
            await permissionRepository.updatePermission(id, permission, updatedBy);

        if (!updatedPermission) {
            throw new PermissionError("Permission not found", 404);
        }

        return updatedPermission;
    } catch (error) {
        handleDatabaseError(error);
    }
}

// DELETE: soft delete
async function deletePermission(id, updatedBy) {
    validateId(id);

    const deletedPermission =
        await permissionRepository.softDeletePermission(id, updatedBy);

    if (!deletedPermission) {
        throw new PermissionError("Permission not found", 404);
    }

    return deletedPermission;
}

module.exports = {
    getAllPermissions,
    getPermissionById,
    createPermission,
    updatePermission,
    deletePermission
};
