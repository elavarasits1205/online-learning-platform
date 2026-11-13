
const pool = require("../config/database");

const ROLE_COLUMNS = `
    r.id::text AS id,
    r.code,
    r.name,
    r.description,
    r.is_active AS "isActive",
    r.soft_delete AS "softDelete",
    r.created_by::text AS "createdBy",
    r.created_at AS "createdAt",
    r.updated_by::text AS "updatedBy",
    r.updated_at AS "updatedAt"
`;

// GET all active, non-deleted roles
async function findAllRoles() {
    const result = await pool.query(`
        SELECT ${ROLE_COLUMNS}
        FROM olp_auth."role" r
        WHERE r.soft_delete = false
        ORDER BY r.id DESC
    `);

    return result.rows;
}

// GET role by ID
async function findRoleById(id) {
    const result = await pool.query(`
        SELECT ${ROLE_COLUMNS}
        FROM olp_auth."role" r
        WHERE r.id = $1
          AND r.soft_delete = false
    `, [id]);

    return result.rows[0] || null;
}

// Check duplicate role code or name
async function findDuplicateRole(code, name, excludeId = null) {
    const result = await pool.query(`
        SELECT
            r.id::text AS id,
            r.code,
            r.name
        FROM olp_auth."role" r
        WHERE r.soft_delete = false
          AND (
              LOWER(r.code) = LOWER($1)
              OR LOWER(r.name) = LOWER($2)
          )
          AND ($3::bigint IS NULL OR r.id <> $3)
        LIMIT 1
    `, [code, name, excludeId]);

    return result.rows[0] || null;
}

// POST create role
async function createRole(role, createdBy) {
    const result = await pool.query(`
        INSERT INTO olp_auth."role" AS r (
            code,
            name,
            description,
            is_active,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${ROLE_COLUMNS}
    `, [
        role.code,
        role.name,
        role.description,
        role.isActive,
        createdBy
    ]);

    return result.rows[0];
}

// PUT update role
async function updateRole(id, role, updatedBy) {
    const result = await pool.query(`
        UPDATE olp_auth."role" AS r
        SET
            code = $2,
            name = $3,
            description = $4,
            is_active = $5,
            updated_at = NOW(),
            updated_by = $6
        WHERE r.id = $1
          AND r.soft_delete = false
        RETURNING ${ROLE_COLUMNS}
    `, [
        id,
        role.code,
        role.name,
        role.description,
        role.isActive,
        updatedBy
    ]);

    return result.rows[0] || null;
}

// DELETE role: soft delete
async function softDeleteRole(id, updatedBy) {
    const result = await pool.query(`
        UPDATE olp_auth."role" AS r
        SET
            soft_delete = true,
            updated_at = NOW(),
            updated_by = $2
        WHERE r.id = $1
          AND r.soft_delete = false
        RETURNING ${ROLE_COLUMNS}
    `, [id, updatedBy]);

    return result.rows[0] || null;
}

module.exports = {
    findAllRoles,
    findRoleById,
    findDuplicateRole,
    createRole,
    updateRole,
    softDeleteRole
};
