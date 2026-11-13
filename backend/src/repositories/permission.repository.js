
const pool = require("../config/database");

const PERMISSION_COLUMNS = `
    p.id::text AS id,
    p.code,
    p.module_code AS "moduleCode",
    p.resource_code AS "resourceCode",
    p.action_code AS "actionCode",
    p.name,
    p.description,
    p.is_active AS "isActive",
    p.soft_delete AS "softDelete",
    p.created_by::text AS "createdBy",
    p.created_at AS "createdAt",
    p.updated_by::text AS "updatedBy",
    p.updated_at AS "updatedAt"
`;

// GET all non-deleted permissions
async function findAllPermissions() {
    const result = await pool.query(`
        SELECT ${PERMISSION_COLUMNS}
        FROM olp_auth."permission" p
        WHERE p.soft_delete = false
        ORDER BY p.id DESC
    `);

    return result.rows;
}

// GET permission by ID
async function findPermissionById(id) {
    const result = await pool.query(`
        SELECT ${PERMISSION_COLUMNS}
        FROM olp_auth."permission" p
        WHERE p.id = $1
          AND p.soft_delete = false
    `, [id]);

    return result.rows[0] || null;
}

// Check duplicate code or module/resource/action combination.
// Unique constraints also apply to soft-deleted records.
async function findDuplicatePermission(permission, excludeId = null) {
    const result = await pool.query(`
        SELECT p.id::text AS id
        FROM olp_auth."permission" p
        WHERE (
            LOWER(p.code) = LOWER($1)
            OR (
                LOWER(p.module_code) = LOWER($2)
                AND LOWER(p.resource_code) = LOWER($3)
                AND LOWER(p.action_code) = LOWER($4)
            )
        )
        AND ($5::bigint IS NULL OR p.id <> $5)
        LIMIT 1
    `, [
        permission.code,
        permission.moduleCode,
        permission.resourceCode,
        permission.actionCode,
        excludeId
    ]);

    return result.rows[0] || null;
}

// POST create permission
async function createPermission(permission, createdBy) {
    const result = await pool.query(`
        INSERT INTO olp_auth."permission" AS p (
            code,
            module_code,
            resource_code,
            action_code,
            name,
            description,
            is_active,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING ${PERMISSION_COLUMNS}
    `, [
        permission.code,
        permission.moduleCode,
        permission.resourceCode,
        permission.actionCode,
        permission.name,
        permission.description,
        permission.isActive,
        createdBy
    ]);

    return result.rows[0];
}

// PUT update permission
async function updatePermission(id, permission, updatedBy) {
    const result = await pool.query(`
        UPDATE olp_auth."permission" AS p
        SET
            code = $2,
            module_code = $3,
            resource_code = $4,
            action_code = $5,
            name = $6,
            description = $7,
            is_active = $8,
            updated_at = NOW(),
            updated_by = $9
        WHERE p.id = $1
          AND p.soft_delete = false
        RETURNING ${PERMISSION_COLUMNS}
    `, [
        id,
        permission.code,
        permission.moduleCode,
        permission.resourceCode,
        permission.actionCode,
        permission.name,
        permission.description,
        permission.isActive,
        updatedBy
    ]);

    return result.rows[0] || null;
}

// DELETE permission: soft delete
async function softDeletePermission(id, updatedBy) {
    const result = await pool.query(`
        UPDATE olp_auth."permission" AS p
        SET
            soft_delete = true,
            updated_at = NOW(),
            updated_by = $2
        WHERE p.id = $1
          AND p.soft_delete = false
        RETURNING ${PERMISSION_COLUMNS}
    `, [id, updatedBy]);

    return result.rows[0] || null;
}

module.exports = {
    findAllPermissions,
    findPermissionById,
    findDuplicatePermission,
    createPermission,
    updatePermission,
    softDeletePermission
};
