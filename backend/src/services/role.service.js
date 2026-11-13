
const roleRepository = require("../repositories/role.repository");

class RoleError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = "RoleError";
        this.statusCode = statusCode;
    }
}

function normalizeRoleInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new RoleError(
            "Request body must be a JSON object",
            400
        );
    }

    const { code, name, description, isActive } = body;

    if (typeof code !== "string" || !code.trim()) {
        throw new RoleError("code is required", 400);
    }

    if (code.trim().length > 50) {
        throw new RoleError(
            "code must not exceed 50 characters",
            400
        );
    }

    if (typeof name !== "string" || !name.trim()) {
        throw new RoleError("name is required", 400);
    }

    if (name.trim().length > 100) {
        throw new RoleError(
            "name must not exceed 100 characters",
            400
        );
    }

    if (
        description !== undefined &&
        description !== null &&
        typeof description !== "string"
    ) {
        throw new RoleError(
            "description must be a string or null",
            400
        );
    }

    if (
        typeof description === "string" &&
        description.length > 10000
    ) {
        throw new RoleError(
            "description must not exceed 10000 characters",
            400
        );
    }

    if (typeof isActive !== "boolean") {
        throw new RoleError(
            "isActive must be true or false",
            400
        );
    }

    return {
        code: code.trim(),
        name: name.trim(),
        description:
            description === undefined ? null : description,
        isActive
    };
}

function validateId(id) {
    if (!/^[1-9]\d*$/.test(String(id))) {
        throw new RoleError("Invalid role ID", 400);
    }

    const maxBigInt = 9223372036854775807n;

    if (BigInt(id) > maxBigInt) {
        throw new RoleError("Role ID is out of range", 400);
    }
}

function handleDatabaseError(error) {
    if (error.code === "23505") {
        throw new RoleError(
            "Role code or name already exists",
            409
        );
    }

    throw error;
}

async function getAllRoles() {
    return roleRepository.findAllRoles();
}

async function getRoleById(id) {
    validateId(id);

    const role = await roleRepository.findRoleById(id);

    if (!role) {
        throw new RoleError("Role not found", 404);
    }

    return role;
}

async function createRole(body, createdBy) {
    const role = normalizeRoleInput(body);

    const duplicate = await roleRepository.findDuplicateRole(
        role.code,
        role.name
    );

    if (duplicate) {
        throw new RoleError(
            "A role with this code or name already exists",
            409
        );
    }

    try {
        return await roleRepository.createRole(role, createdBy);
    } catch (error) {
        handleDatabaseError(error);
    }
}

async function updateRole(id, body, updatedBy) {
    validateId(id);

    const role = normalizeRoleInput(body);

    const existingRole = await roleRepository.findRoleById(id);

    if (!existingRole) {
        throw new RoleError("Role not found", 404);
    }

    const duplicate = await roleRepository.findDuplicateRole(
        role.code,
        role.name,
        id
    );

    if (duplicate) {
        throw new RoleError(
            "Another role already uses this code or name",
            409
        );
    }

    try {
        const updatedRole = await roleRepository.updateRole(
            id,
            role,
            updatedBy
        );

        if (!updatedRole) {
            throw new RoleError("Role not found", 404);
        }

        return updatedRole;
    } catch (error) {
        handleDatabaseError(error);
    }
}

async function deleteRole(id, updatedBy) {
    validateId(id);

    const deletedRole = await roleRepository.softDeleteRole(id, updatedBy);

    if (!deletedRole) {
        throw new RoleError("Role not found", 404);
    }

    return deletedRole;
}

module.exports = {
    RoleError,
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
};
