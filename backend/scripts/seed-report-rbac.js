require("dotenv").config();

const pool = require("../src/config/database");

const REPORT_MENUS = [
    {
        code: "USER_REPORTS",
        name: "User Reports",
        routePath: "/admin/reports/users",
        icon: "users",
        sortOrder: 1,
        permissionCode: "USER_REPORT_VIEW",
        legacyCodes: []
    },
    {
        code: "PAYROLL_REPORT",
        name: "Payroll Reports",
        routePath: "/admin/reports/payroll",
        icon: "wallet",
        sortOrder: 2,
        permissionCode: "PAYROLL_REPORT_VIEW",
        legacyCodes: ["COURSE_REPORTS"],
        legacyPaths: ["/admin/reports/courses"]
    },
    {
        code: "ENROLLMENT_REPORTS",
        name: "Enrollment Reports",
        routePath: "/admin/reports/enrollments",
        icon: "graduation-cap",
        sortOrder: 3,
        permissionCode: "ENROLLMENT_REPORT_VIEW",
        legacyCodes: []
    }
];

async function getAdminRoleId() {
    const result = await pool.query(`
        SELECT id::text AS id
        FROM olp_auth."role"
        WHERE UPPER(BTRIM(code)) = 'ADMIN'
          AND is_active = TRUE
          AND soft_delete = FALSE
        LIMIT 1
    `);

    return result.rows[0]?.id ?? null;
}

async function getAuditUserId(roleId) {
    const result = await pool.query(
        `SELECT ur.user_id::text AS id
         FROM olp_auth.user_role ur
         INNER JOIN olp_auth."role" r ON r.id = ur.role_id
         WHERE ur.role_id = $1::bigint
           AND ur.is_active = TRUE
           AND ur.soft_delete = FALSE
           AND r.is_active = TRUE
           AND r.soft_delete = FALSE
         ORDER BY ur.user_id
         LIMIT 1`,
        [roleId]
    );

    return result.rows[0]?.id ?? null;
}

async function getPermissionId(code) {
    const result = await pool.query(
        `SELECT id::text AS id
         FROM olp_auth.permission
         WHERE UPPER(BTRIM(code)) = UPPER($1)
           AND is_active = TRUE
           AND soft_delete = FALSE
         LIMIT 1`,
        [code]
    );

    return result.rows[0]?.id ?? null;
}

async function getReportsParentId() {
    const result = await pool.query(`
        SELECT id::text AS id
        FROM olp_auth.menu
        WHERE UPPER(BTRIM(code)) = 'REPORTS'
          AND soft_delete = FALSE
        LIMIT 1
    `);

    return result.rows[0]?.id ?? null;
}

async function findExistingMenu(spec) {
    const candidates = [spec.code, ...(spec.legacyCodes ?? [])];
    const paths = spec.legacyPaths ?? [];

    const result = await pool.query(
        `SELECT id::text AS id, code
         FROM olp_auth.menu
         WHERE soft_delete = FALSE
           AND (
                UPPER(BTRIM(code)) = ANY($1::text[])
                OR route_path = ANY($2::text[])
           )
         ORDER BY
            CASE WHEN UPPER(BTRIM(code)) = UPPER($3) THEN 0 ELSE 1 END,
            id
         LIMIT 1`,
        [
            candidates.map((code) => String(code).toUpperCase()),
            paths,
            spec.code
        ]
    );

    return result.rows[0] ?? null;
}

async function upsertMenu(spec, parentId, permissionId, auditUserId) {
    const existing = await findExistingMenu(spec);

    if (existing) {
        await pool.query(
            `UPDATE olp_auth.menu
             SET code = $2,
                 name = $3,
                 menu_type = 'SUBMENU',
                 route_path = $4,
                 icon = $5,
                 sort_order = $6,
                 is_parent = FALSE,
                 is_active = TRUE,
                 parent_id = $7::bigint,
                 permission_id = $8::bigint,
                 updated_by = $9::bigint,
                 updated_at = NOW(),
                 soft_delete = FALSE
             WHERE id = $1::bigint`,
            [
                existing.id,
                spec.code,
                spec.name,
                spec.routePath,
                spec.icon,
                spec.sortOrder,
                parentId,
                permissionId,
                auditUserId
            ]
        );

        return { code: spec.code, action: "updated" };
    }

    await pool.query(
        `INSERT INTO olp_auth.menu (
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
            created_by,
            updated_by
         )
         VALUES (
            $1::bigint,
            $2,
            $3,
            'SUBMENU',
            $4,
            $5,
            $6,
            FALSE,
            TRUE,
            $7::bigint,
            $8::bigint,
            $8::bigint
         )`,
        [
            parentId,
            spec.code,
            spec.name,
            spec.routePath,
            spec.icon,
            spec.sortOrder,
            permissionId,
            auditUserId
        ]
    );

    return { code: spec.code, action: "created" };
}

async function assignPermission(roleId, permissionId, auditUserId) {
    await pool.query(
        `INSERT INTO olp_auth.role_permission (
            role_id,
            permission_id,
            is_active,
            created_by,
            updated_by
         )
         VALUES (
            $1::bigint,
            $2::bigint,
            TRUE,
            $3::bigint,
            $3::bigint
         )
         ON CONFLICT (role_id, permission_id)
         DO UPDATE SET
            is_active = TRUE,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()`,
        [roleId, permissionId, auditUserId]
    );
}

async function main() {
    const adminRoleId = await getAdminRoleId();

    if (!adminRoleId) {
        throw new Error("Active ADMIN role was not found.");
    }

    const auditUserId = await getAuditUserId(adminRoleId);
    const parentId = await getReportsParentId();

    if (!parentId) {
        throw new Error("REPORTS parent menu was not found.");
    }

    const results = [];

    for (const spec of REPORT_MENUS) {
        const permissionId = await getPermissionId(spec.permissionCode);

        if (!permissionId) {
            throw new Error(
                `Permission ${spec.permissionCode} was not found.`
            );
        }

        const menu = await upsertMenu(
            spec,
            parentId,
            permissionId,
            auditUserId
        );

        await assignPermission(
            adminRoleId,
            permissionId,
            auditUserId
        );

        results.push(menu);
    }

    console.log(JSON.stringify({ adminRoleId, parentId, results }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
