const pool = require("../config/database");

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function validateId(value, fieldName = "id") {
    const id = String(value ?? "").trim();

    if (!/^[1-9]\d*$/.test(id)) {
        throw createError(`Invalid ${fieldName}`, 400);
    }

    // Keep PostgreSQL BIGINT identifiers as strings.
    return id;
}

const ACTIVE_ROLE_FILTER = `
    r.is_active = TRUE
    AND r.soft_delete = FALSE
`;

const ACTIVE_ROLE_PERMISSION_FILTER = `
    rp.is_active = TRUE
    AND r.is_active = TRUE
    AND r.soft_delete = FALSE
    AND p.is_active = TRUE
    AND p.soft_delete = FALSE
    AND ${ACTIVE_ROLE_FILTER}
`;

const ROLE_PERMISSION_SELECT = `
    SELECT
        rp.id::text AS id,
        rp.role_id::text AS "roleId",
        r.code AS "roleCode",
        r.name AS "roleName",
        rp.permission_id::text AS "permissionId",
        p.code AS "permissionCode",
        p.module_code AS "moduleCode",
        p.resource_code AS "resourceCode",
        UPPER(BTRIM(p.action_code)) AS "actionCode",
        p.name AS "permissionName",
        rp.is_active AS "isActive",
        FALSE AS "softDelete",
        rp.created_at AS "createdAt",
        rp.created_by::text AS "createdBy",
        rp.updated_at AS "updatedAt",
        rp.updated_by::text AS "updatedBy"
    FROM olp_auth.role_permission rp
    INNER JOIN olp_auth."role" r
        ON r.id = rp.role_id
    INNER JOIN olp_auth."permission" p
        ON p.id = rp.permission_id
`;

async function getAllRolePermissions({
    roleId = null,
    includeInactive = false,
} = {}) {
    const values = [];
    const conditions = [
        ACTIVE_ROLE_FILTER,
    ];

    if (roleId !== null && roleId !== undefined && roleId !== "") {
        const validRoleId = validateId(roleId, "roleId");
        values.push(validRoleId);
        conditions.push(`rp.role_id = $${values.length}::bigint`);
    }

    if (includeInactive) {
        conditions.push("r.soft_delete = FALSE");
        conditions.push("p.soft_delete = FALSE");
    } else {
        conditions.push(ACTIVE_ROLE_PERMISSION_FILTER);
    }

    const result = await pool.query(
        `${ROLE_PERMISSION_SELECT}
         WHERE ${conditions.join(" AND ")}
         ORDER BY
            r.name,
            p.module_code,
            p.resource_code,
            p.action_code`,
        values
    );

    return result.rows;
}

async function getRolePermissionById(id) {
    const validId = validateId(id);

    const result = await pool.query(
        `${ROLE_PERMISSION_SELECT}
         WHERE rp.id = $1::bigint
           AND r.soft_delete = FALSE
           AND p.soft_delete = FALSE
           AND ${ACTIVE_ROLE_FILTER}
         LIMIT 1`,
        [validId]
    );

    return result.rows[0] || null;
}

/*
 * Finds any active role.
 * Retained as a generic helper for compatibility with existing callers.
 */
async function findActiveRole(roleId, client = pool) {
    const validRoleId = validateId(roleId, "roleId");

    const result = await client.query(
        `
        SELECT
            id::text AS id,
            code,
            name
        FROM olp_auth."role"
        WHERE id = $1::bigint
          AND is_active = TRUE
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [validRoleId]
    );

    return result.rows[0] || null;
}

/*
 * Any active, non-deleted role can be managed in Role Menu Privileges.
 */
async function findManageableRole(roleId, client = pool) {
    const validRoleId = validateId(roleId, "roleId");

    const result = await client.query(
        `
        SELECT
            id::text AS id,
            code,
            name
        FROM olp_auth."role" r
        WHERE id = $1::bigint
          AND is_active = TRUE
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [validRoleId]
    );

    return result.rows[0] || null;
}

async function findActivePermission(permissionId, client = pool) {
    const validPermissionId = validateId(
        permissionId,
        "permissionId"
    );

    const result = await client.query(
        `
        SELECT
            id::text AS id,
            code,
            module_code AS "moduleCode",
            resource_code AS "resourceCode",
            UPPER(BTRIM(action_code)) AS "actionCode",
            name
        FROM olp_auth."permission"
        WHERE id = $1::bigint
          AND is_active = TRUE
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [validPermissionId]
    );

    return result.rows[0] || null;
}

async function createRolePermission(data) {
    const roleId = validateId(data.roleId, "roleId");
    const permissionId = validateId(
        data.permissionId,
        "permissionId"
    );

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const role = await findManageableRole(roleId, client);

        if (!role) {
            throw createError(
                "Only active roles can be assigned permissions",
                403
            );
        }

        const permission = await findActivePermission(
            permissionId,
            client
        );

        if (!permission) {
            throw createError("Active permission not found", 404);
        }

        const auditUserId =
            data.auditUserId == null
                ? null
                : validateId(data.auditUserId, "auditUserId");

        const isActive =
            data.isActive === undefined ? true : data.isActive;

        if (typeof isActive !== "boolean") {
            throw createError("isActive must be a boolean", 400);
        }

        const result = await client.query(
            `
            INSERT INTO olp_auth.role_permission (
                role_id,
                permission_id,
                is_active,
                created_by
            )
            VALUES (
                $1::bigint,
                $2::bigint,
                $3,
                $4::bigint
            )
            ON CONFLICT (role_id, permission_id)
            DO UPDATE SET
                is_active = EXCLUDED.is_active,
                updated_by = $4::bigint,
                updated_at = NOW()
            RETURNING
                id::text AS id,
                role_id::text AS "roleId",
                permission_id::text AS "permissionId",
                is_active AS "isActive",
                FALSE AS "softDelete",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                created_by::text AS "createdBy",
                updated_by::text AS "updatedBy"
            `,
            [roleId, permissionId, isActive, auditUserId]
        );

        await client.query("COMMIT");

        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            throw createError(
                "This permission is already assigned to the role",
                409
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

async function updateRolePermission(id, data) {
    const validId = validateId(id);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const existingResult = await client.query(
            `
            SELECT
                rp.id::text AS id,
                rp.role_id::text AS "roleId",
                rp.permission_id::text AS "permissionId",
                rp.is_active AS "isActive",
                r.code AS "roleCode"
            FROM olp_auth.role_permission rp
            INNER JOIN olp_auth."role" r
                ON r.id = rp.role_id
            WHERE rp.id = $1::bigint
              AND r.soft_delete = FALSE
            FOR UPDATE OF rp
            `,
            [validId]
        );

        const current = existingResult.rows[0];

        if (!current) {
            throw createError("Role permission not found", 404);
        }

        const roleId = validateId(
            data.roleId ?? current.roleId,
            "roleId"
        );

        const permissionId = validateId(
            data.permissionId ?? current.permissionId,
            "permissionId"
        );

        const role = await findManageableRole(roleId, client);

        if (!role) {
            throw createError(
                "Only active roles can be assigned permissions",
                403
            );
        }

        const permission = await findActivePermission(
            permissionId,
            client
        );

        if (!permission) {
            throw createError("Active permission not found", 404);
        }

        const isActive =
            data.isActive === undefined
                ? current.isActive
                : data.isActive;

        if (typeof isActive !== "boolean") {
            throw createError("isActive must be a boolean", 400);
        }

        const auditUserId =
            data.auditUserId == null
                ? null
                : validateId(data.auditUserId, "auditUserId");

        const result = await client.query(
            `
            UPDATE olp_auth.role_permission
            SET
                role_id = $2::bigint,
                permission_id = $3::bigint,
                is_active = $4,
                updated_by = $5::bigint,
                updated_at = NOW()
            WHERE id = $1::bigint
            RETURNING
                id::text AS id,
                role_id::text AS "roleId",
                permission_id::text AS "permissionId",
                is_active AS "isActive",
                FALSE AS "softDelete",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                created_by::text AS "createdBy",
                updated_by::text AS "updatedBy"
            `,
            [validId, roleId, permissionId, isActive, auditUserId]
        );

        await client.query("COMMIT");

        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            throw createError(
                "This permission is already assigned to the role",
                409
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

async function updateRolePermissionStatus(
    id,
    isActive,
    auditUserId = null
) {
    const validId = validateId(id);

    if (typeof isActive !== "boolean") {
        throw createError("isActive must be a boolean", 400);
    }

    const validAuditUserId =
        auditUserId == null
            ? null
            : validateId(auditUserId, "auditUserId");

    const result = await pool.query(
        `
        UPDATE olp_auth.role_permission rp
        SET
            is_active = $2,
            updated_by = $3::bigint,
            updated_at = NOW()
        WHERE rp.id = $1::bigint
          AND EXISTS (
              SELECT 1
              FROM olp_auth."role" r
              WHERE r.id = rp.role_id
                AND r.soft_delete = FALSE
          )
        RETURNING
            rp.id::text AS id,
            rp.role_id::text AS "roleId",
            rp.permission_id::text AS "permissionId",
            rp.is_active AS "isActive",
            FALSE AS "softDelete",
            rp.updated_at AS "updatedAt",
            rp.updated_by::text AS "updatedBy"
        `,
        [validId, isActive, validAuditUserId]
    );

    if (!result.rows[0]) {
        throw createError("Role permission not found", 404);
    }

    return result.rows[0];
}

async function deleteRolePermission(id, auditUserId = null) {
    const validId = validateId(id);

    const validAuditUserId =
        auditUserId == null
            ? null
            : validateId(auditUserId, "auditUserId");

    const result = await pool.query(
        `
        UPDATE olp_auth.role_permission rp
        SET
            is_active = FALSE,
            updated_by = $2::bigint,
            updated_at = NOW()
        WHERE rp.id = $1::bigint
          AND EXISTS (
              SELECT 1
              FROM olp_auth."role" r
              WHERE r.id = rp.role_id
                AND r.soft_delete = FALSE
          )
        RETURNING
            rp.id::text AS id,
            rp.role_id::text AS "roleId",
            rp.permission_id::text AS "permissionId",
            rp.is_active AS "isActive",
            FALSE AS "softDelete"
        `,
        [validId, validAuditUserId]
    );

    if (!result.rows[0]) {
        throw createError("Role permission not found", 404);
    }

    return result.rows[0];
}

async function getEffectivePermissions(roleId) {
    const validRoleId = validateId(roleId, "roleId");

    const result = await pool.query(
        `
        SELECT DISTINCT
            p.id::text AS "permissionId",
            p.code,
            p.module_code AS "moduleCode",
            p.resource_code AS "resourceCode",
            UPPER(BTRIM(p.action_code)) AS "actionCode",
            p.name
        FROM olp_auth.role_permission rp
        INNER JOIN olp_auth."role" r
            ON r.id = rp.role_id
        INNER JOIN olp_auth."permission" p
            ON p.id = rp.permission_id
        WHERE rp.role_id = $1::bigint
          AND ${ACTIVE_ROLE_PERMISSION_FILTER}
        ORDER BY
            p.module_code,
            p.resource_code,
            UPPER(BTRIM(p.action_code))
        `,
        [validRoleId]
    );

    return result.rows;
}

/*
 * Role-based menu access.
 *
 * Active roles and their active assignments/permissions are included.
 *
 * VIEW/READ/LIST/GET -> canView
 * CREATE/ADD         -> canCreate
 * UPDATE/EDIT        -> canUpdate
 * DELETE             -> canDelete
 *
 * Menu actions are matched through the menu's base permission module/resource,
 * so any assigned action for that resource makes the menu visible.
 * A parent is visible when it has its own assignment or a visible child.
 * Parent visibility does not grant CRUD permissions.
 */
async function getRoleMenuPermissions(roleId) {
    const validRoleId = validateId(roleId, "roleId");

    const result = await pool.query(
        `
        SELECT
            m.id::text AS id,
            m.parent_id::text AS "parentId",
            m.code,
            m.name,
            m.menu_type AS "menuType",
            m.route_path AS "routePath",
            m.icon,
            m.sort_order AS "sortOrder",
            m.is_parent AS "isParent",
            m.permission_id::text AS "permissionId",

            COALESCE(access.can_view, FALSE) AS "canView",
            COALESCE(access.can_create, FALSE) AS "canCreate",
            COALESCE(access.can_update, FALSE) AS "canUpdate",
            COALESCE(access.can_delete, FALSE) AS "canDelete",
            COALESCE(access.can_approve, FALSE) AS "canApprove",
            COALESCE(access.can_publish, FALSE) AS "canPublish",
            COALESCE(access.has_any_permission, FALSE)
                AS "hasAnyPermission"

        FROM olp_auth.menu m

        LEFT JOIN olp_auth."permission" base_p
            ON base_p.id = m.permission_id
           AND base_p.is_active = TRUE
           AND base_p.soft_delete = FALSE

        LEFT JOIN LATERAL (
            SELECT
                BOOL_OR(
                    UPPER(BTRIM(p.action_code)) IN (
                        'VIEW', 'READ', 'LIST', 'GET'
                    )
                ) AS can_view,

                BOOL_OR(
                    UPPER(BTRIM(p.action_code)) IN (
                        'CREATE', 'ADD'
                    )
                ) AS can_create,

                BOOL_OR(
                    UPPER(BTRIM(p.action_code)) IN (
                        'UPDATE', 'EDIT'
                    )
                ) AS can_update,

                BOOL_OR(
                    UPPER(BTRIM(p.action_code)) = 'DELETE'
                ) AS can_delete,

                BOOL_OR(
                    UPPER(BTRIM(p.action_code)) = 'APPROVE'
                ) AS can_approve,

                BOOL_OR(
                    UPPER(BTRIM(p.action_code)) = 'PUBLISH'
                ) AS can_publish,

                COUNT(*) > 0 AS has_any_permission

            FROM olp_auth.role_permission rp
            INNER JOIN olp_auth."role" r
                ON r.id = rp.role_id
            INNER JOIN olp_auth."permission" p
                ON p.id = rp.permission_id

            WHERE rp.role_id = $1::bigint
              AND ${ACTIVE_ROLE_PERMISSION_FILTER}
              AND (
                    (
                        UPPER(BTRIM(p.module_code)) =
                            UPPER(BTRIM(base_p.module_code))
                        AND UPPER(BTRIM(p.resource_code)) =
                            UPPER(BTRIM(base_p.resource_code))
                    )
                    OR UPPER(BTRIM(m.code)) =
                       UPPER(BTRIM(p.module_code))
                    OR UPPER(BTRIM(m.code)) =
                       UPPER(BTRIM(p.resource_code))
              )
        ) access ON TRUE

        WHERE m.is_active = TRUE
          AND m.soft_delete = FALSE

        ORDER BY
            m.sort_order NULLS LAST,
            m.name,
            m.id
        `,
        [validRoleId]
    );

    const menus = result.rows.map((row) => ({
        ...row,
        id: String(row.id),
        parentId:
            row.parentId == null ? null : String(row.parentId),
        permissionId:
            row.permissionId == null
                ? null
                : String(row.permissionId),
        isParent: row.isParent === true,
        canView: row.canView === true,
        canCreate: row.canCreate === true,
        canUpdate: row.canUpdate === true,
        canDelete: row.canDelete === true,
        canApprove: row.canApprove === true,
        canPublish: row.canPublish === true,
        hasAnyPermission: row.hasAnyPermission === true,
        isContainer: false,
        isVisible: false,
        children: [],
    }));

    const byId = new Map(menus.map((menu) => [menu.id, menu]));
    const roots = [];

    for (const menu of menus) {
        const parent = menu.parentId
            ? byId.get(menu.parentId)
            : null;

        if (parent && parent.id !== menu.id) {
            parent.children.push(menu);
        } else {
            roots.push(menu);
        }
    }

    function filterVisibleMenus(menu) {
        menu.children = menu.children
            .map(filterVisibleMenus)
            .filter(Boolean);

        const hasVisibleChildren = menu.children.length > 0;
        const hasOwnAccess = menu.hasAnyPermission;

        menu.isVisible = hasOwnAccess || hasVisibleChildren;
        menu.isContainer = !hasOwnAccess && hasVisibleChildren;

        return menu.isVisible ? menu : null;
    }

    return roots.map(filterVisibleMenus).filter(Boolean);
}

module.exports = {
    getAllRolePermissions,
    getRolePermissionById,
    createRolePermission,
    updateRolePermission,
    updateRolePermissionStatus,
    deleteRolePermission,
    getEffectivePermissions,
    getRoleMenuPermissions,
    findActiveRole,
    findManageableRole,
    findActivePermission,
};
