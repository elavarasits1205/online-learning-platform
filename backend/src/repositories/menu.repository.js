
const pool = require("../config/database");

const MENU_COLUMNS = `
    m.id::text AS id,
    m.parent_id::text AS "parentId",
    parent.name AS "parentName",
    m.code,
    m.name,
    m.menu_type AS "menuType",
    m.route_path AS "routePath",
    m.icon,
    m.sort_order AS "sortOrder",
    m.is_parent AS "isParent",
    m.is_active AS "isActive",
    m.soft_delete AS "softDelete",
    m.permission_id::text AS "permissionId",
    permission.name AS "permissionName",
    m.created_by::text AS "createdBy",
    m.created_at AS "createdAt",
    m.updated_by::text AS "updatedBy",
    m.updated_at AS "updatedAt"
`;

const MENU_JOINS = `
    FROM olp_auth.menu m
    LEFT JOIN olp_auth.menu parent
        ON parent.id = m.parent_id
    INNER JOIN olp_auth."permission" permission
        ON permission.id = m.permission_id
`;

async function findAllMenus() {
    const result = await pool.query(`
        SELECT ${MENU_COLUMNS}
        ${MENU_JOINS}
        WHERE m.soft_delete = false
        ORDER BY
            m.parent_id NULLS FIRST,
            m.sort_order ASC,
            m.id ASC
    `);

    return result.rows;
}

async function findMenuById(id) {
    const result = await pool.query(`
        SELECT ${MENU_COLUMNS}
        ${MENU_JOINS}
        WHERE m.id = $1
          AND m.soft_delete = false
    `, [id]);

    return result.rows[0] || null;
}

async function findDuplicateMenuCode(code, excludeId = null) {
    const result = await pool.query(`
        SELECT m.id::text AS id
        FROM olp_auth.menu m
        WHERE LOWER(m.code) = LOWER($1)
          AND ($2::bigint IS NULL OR m.id <> $2)
        LIMIT 1
    `, [code, excludeId]);

    return result.rows[0] || null;
}

async function findActiveParentMenu(parentId) {
    if (parentId === null) {
        return null;
    }

    const result = await pool.query(`
        SELECT id::text AS id, name
        FROM olp_auth.menu
        WHERE id = $1
          AND soft_delete = false
    `, [parentId]);

    return result.rows[0] || null;
}

async function findActivePermission(permissionId) {
    const result = await pool.query(`
        SELECT id::text AS id, name
        FROM olp_auth."permission"
        WHERE id = $1
          AND soft_delete = false
    `, [permissionId]);

    return result.rows[0] || null;
}

// Prevent assigning the menu itself or one of its descendants
// as its parent, which would create a circular hierarchy.

async function wouldCreateParentCycle(menuId, parentId) {
    if (parentId === null) {
        return false;
    }

    const result = await pool.query(`
        WITH RECURSIVE descendants AS (
            SELECT id
            FROM olp_auth.menu
            WHERE parent_id = $1
              AND soft_delete = false

            UNION

            SELECT child.id
            FROM olp_auth.menu child
            INNER JOIN descendants d
                ON child.parent_id = d.id
            WHERE child.soft_delete = false
        )
        SELECT 1
        FROM descendants
        WHERE id = $2
        LIMIT 1
    `, [menuId, parentId]);

    return result.rowCount > 0;
}

async function createMenu(menu, createdBy) {
    const result = await pool.query(`
        INSERT INTO olp_auth.menu (
            parent_id,
            code,
            name,
            menu_type,
            route_path,
            icon,
            sort_order,
            is_parent,
            is_active,
            permission_id,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id::text AS id
    `, [
        menu.parentId,
        menu.code,
        menu.name,
        menu.menuType,
        menu.routePath,
        menu.icon,
        menu.sortOrder,
        menu.isParent,
        menu.isActive,
        menu.permissionId,
        createdBy
    ]);

    // Fetch the complete response, including FK names.
    return findMenuById(result.rows[0].id);
}

async function updateMenu(id, menu, updatedBy) {
    const result = await pool.query(`
        UPDATE olp_auth.menu
        SET
            parent_id = $2,
            code = $3,
            name = $4,
            menu_type = $5,
            route_path = $6,
            icon = $7,
            sort_order = $8,
            is_parent = $9,
            is_active = $10,
            permission_id = $11,
            updated_at = NOW(),
            updated_by = $12
        WHERE id = $1
          AND soft_delete = false
        RETURNING id::text AS id
    `, [
        id,
        menu.parentId,
        menu.code,
        menu.name,
        menu.menuType,
        menu.routePath,
        menu.icon,
        menu.sortOrder,
        menu.isParent,
        menu.isActive,
        menu.permissionId,
        updatedBy
    ]);

    if (!result.rows[0]) {
        return null;
    }

    return findMenuById(result.rows[0].id);
}

async function softDeleteMenu(id, updatedBy) {
    const result = await pool.query(`
        UPDATE olp_auth.menu
        SET
            soft_delete = true,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND soft_delete = false
        RETURNING id::text AS id
    `, [id, updatedBy]);

    if (!result.rows[0]) {
        return null;
    }

    // The normal GET query excludes deleted rows, so use a
    // dedicated query to return the deleted menu with FK names.
    const deletedResult = await pool.query(`
        SELECT ${MENU_COLUMNS}
        ${MENU_JOINS}
        WHERE m.id = $1
    `, [result.rows[0].id]);

    return deletedResult.rows[0] || null;
}

module.exports = {
    findAllMenus,
    findMenuById,
    findDuplicateMenuCode,
    findActiveParentMenu,
    findActivePermission,
    wouldCreateParentCycle,
    createMenu,
    updateMenu,
    softDeleteMenu
};
