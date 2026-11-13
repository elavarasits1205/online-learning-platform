const pool = require("../config/database");


// ============================================================
// LIST ROLES
// ============================================================

async function listRoles() {
    const result = await pool.query(`
        SELECT id, code, name, description, is_active
        FROM olp_auth."role"
        WHERE soft_delete = FALSE
        ORDER BY name
    `);

    return result.rows;
}


// ============================================================
// LIST PERMISSIONS
// ============================================================

async function listPermissions() {
    const result = await pool.query(`
        SELECT
            id,
            code,
            module_code,
            resource_code,
            action_code,
            name,
            description
        FROM olp_auth."permission"
        WHERE is_active = TRUE
          AND soft_delete = FALSE
        ORDER BY module_code, resource_code, action_code
    `);

    return result.rows;
}


// ============================================================
// GET CURRENT USER ACCESS
// ============================================================

async function getUserAccess(userId) {
    const [roles, permissions, menus] = await Promise.all([
        require("./auth.repository").getUserRoles(userId),
        require("./auth.repository").getUserPermissions(userId),
        require("./auth.repository").getUserMenus(userId)
    ]);

    return {
        roles,
        permissions,
        menus
    };
}


module.exports = {
    listRoles,
    listPermissions,
    getUserAccess
};