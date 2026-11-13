
import api from "./Api";

function unwrap(response) {
    let value = response?.data ?? response;

    // Backend response: { success: true, data: [...] }
    if (value && !Array.isArray(value) && value.data !== undefined) {
        value = value.data;
    }

    return value;
}

async function request(callback) {
    try {
        return unwrap(await callback());
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            error?.message ||
            "Request failed";

        const normalizedError = new Error(message);
        normalizedError.statusCode = error?.response?.status;
        normalizedError.response = error?.response;
        throw normalizedError;
    }
}

function normalizeId(value, fieldName = "id") {
    const id = String(value ?? "").trim();

    if (!/^[1-9]\d*$/.test(id)) {
        throw new Error(`Invalid ${fieldName}`);
    }

    return id;
}

function normalizeAssignment(row) {
    return {
        ...row,
        id: String(row.id),
        roleId: String(row.roleId ?? row.role_id ?? ""),
        permissionId: String(row.permissionId ?? row.permission_id ?? ""),
        isActive:
            row.isActive === true ||
            row.is_active === true,
        softDelete:
            row.softDelete === true ||
            row.soft_delete === true,
    };
}

export async function getRoles() {
    return request(() => api.get("/roles"));
}

export async function getPermissions() {
    return request(() => api.get("/permissions"));
}

export async function getRolePermissions(
    roleId,
    options = {}
) {
    const validRoleId = normalizeId(roleId, "roleId");

    return request(() =>
        api.get("/role-permissions", {
            params: {
                roleId: validRoleId,
                includeInactive: Boolean(options.includeInactive),
            },
        })
    );
}

export async function getRoleMenuPermissions(roleId) {
    const validRoleId = normalizeId(roleId, "roleId");

    return request(() =>
        api.get(`/role-permissions/role/${validRoleId}/menus`)
    );
}

export async function getEffectivePermissions(roleId) {
    const validRoleId = normalizeId(roleId, "roleId");

    return request(() =>
        api.get(`/role-permissions/role/${validRoleId}/effective`)
    );
}

export async function createRolePermission(payload) {
    return request(() =>
        api.post("/role-permissions", {
            roleId: normalizeId(payload.roleId, "roleId"),
            permissionId: normalizeId(
                payload.permissionId,
                "permissionId"
            ),
            isActive: payload.isActive ?? true,
        })
    );
}

export async function updateRolePermission(id, payload) {
    const validId = normalizeId(id);

    const body = {};

    if (payload.roleId !== undefined) {
        body.roleId = normalizeId(payload.roleId, "roleId");
    }

    if (payload.permissionId !== undefined) {
        body.permissionId = normalizeId(
            payload.permissionId,
            "permissionId"
        );
    }

    if (payload.isActive !== undefined) {
        body.isActive = payload.isActive;
    }

    return request(() =>
        api.put(`/role-permissions/${validId}`, body)
    );
}

export async function updateRolePermissionStatus(id, isActive) {
    const validId = normalizeId(id);

    return request(() =>
        api.patch(`/role-permissions/${validId}/status`, {
            isActive: Boolean(isActive),
        })
    );
}

export async function deleteRolePermission(id) {
    const validId = normalizeId(id);

    return request(() =>
        api.delete(`/role-permissions/${validId}`)
    );
}

/**
 * Save a role's selected permission IDs.
 *
 * Existing assignments are reconciled with the selected IDs:
 * - selected but not assigned -> create
 * - selected but inactive -> reactivate
 * - assigned but not selected -> soft delete
 *
 * The backend create endpoint supports ON CONFLICT and reactivates
 * soft-deleted assignments, so a deleted assignment can be recreated
 * by POSTing the same role/permission pair.
 */
export async function saveRolePrivileges({
    roleId,
    selectedPermissionIds,
    currentAssignments,
}) {
    const validRoleId = normalizeId(roleId, "roleId");

    const selectedIds = new Set(
        (selectedPermissionIds ?? []).map((id) =>
            normalizeId(id, "permissionId")
        )
    );

    const assignments = (currentAssignments ?? []).map(
        normalizeAssignment
    );

    const activeByPermissionId = new Map();
    const inactiveByPermissionId = new Map();

    assignments.forEach((assignment) => {
        if (assignment.softDelete) {
            // Soft-deleted rows are handled by the backend's
            // POST ON CONFLICT path if the permission is selected.
            return;
        }

        if (assignment.isActive) {
            activeByPermissionId.set(
                assignment.permissionId,
                assignment
            );
        } else {
            inactiveByPermissionId.set(
                assignment.permissionId,
                assignment
            );
        }
    });

    const operations = [];

    for (const permissionId of selectedIds) {
        const active = activeByPermissionId.get(permissionId);

        if (active) {
            continue;
        }

        const inactive = inactiveByPermissionId.get(permissionId);

        if (inactive) {
            operations.push(() =>
                updateRolePermission(inactive.id, {
                    isActive: true,
                })
            );
        } else {
            operations.push(() =>
                createRolePermission({
                    roleId: validRoleId,
                    permissionId,
                    isActive: true,
                })
            );
        }
    }

    for (const [permissionId, assignment] of activeByPermissionId) {
        if (!selectedIds.has(permissionId)) {
            operations.push(() => deleteRolePermission(assignment.id));
        }
    }

    // Sequential requests reduce concurrent writes to the same role.
    for (const operation of operations) {
        await operation();
    }

    return getRolePermissions(validRoleId, {
        includeInactive: true,
    });
}

export default {
    getRoles,
    getPermissions,
    getRolePermissions,
    getRoleMenuPermissions,
    getEffectivePermissions,
    createRolePermission,
    updateRolePermission,
    updateRolePermissionStatus,
    deleteRolePermission,
    saveRolePrivileges,
};
