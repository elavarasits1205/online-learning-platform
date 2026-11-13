require("dotenv").config();

const pool = require("../src/config/database");

const permissionService = require("../src/services/permission.service");
const menuService = require("../src/services/menu.service");
const menuRepository = require("../src/repositories/menu.repository");
const rolePermissionRepository = require("../src/repositories/rolePermission.repository");

const ADMIN_PAYMENT_PERMISSIONS = [
    {
        code: "PAYMENT_VIEW",
        moduleCode: "PAYMENT",
        resourceCode: "PAYMENT",
        actionCode: "VIEW",
        name: "View Payments",
        description: "Access payment management menus"
    },
    {
        code: "ALL_PAYMENTS_VIEW",
        moduleCode: "PAYMENT",
        resourceCode: "ALL_PAYMENTS",
        actionCode: "VIEW",
        name: "View All Payments",
        description: "View all student payments"
    },
    {
        code: "ALL_PAYMENTS_DELETE",
        moduleCode: "PAYMENT",
        resourceCode: "ALL_PAYMENTS",
        actionCode: "DELETE",
        name: "Delete Unsettled Payments",
        description: "Soft delete unsettled student payment records"
    },
    {
        code: "TRANSACTION_VIEW",
        moduleCode: "PAYMENT",
        resourceCode: "TRANSACTION",
        actionCode: "VIEW",
        name: "View Payment Transactions",
        description: "View payment transactions"
    },
    {
        code: "PAYMENT_REPORT_VIEW",
        moduleCode: "PAYMENT",
        resourceCode: "PAYMENT_REPORT",
        actionCode: "VIEW",
        name: "View Payment Reports",
        description: "View payment reports"
    },
    {
        code: "REFUND_VIEW",
        moduleCode: "PAYMENT",
        resourceCode: "REFUND",
        actionCode: "VIEW",
        name: "View Refunds",
        description: "View payment refunds"
    },
    {
        code: "REFUND_CREATE",
        moduleCode: "PAYMENT",
        resourceCode: "REFUND",
        actionCode: "CREATE",
        name: "Create Refunds",
        description: "Create payment refunds"
    },
    {
        code: "REFUND_APPROVE",
        moduleCode: "PAYMENT",
        resourceCode: "REFUND",
        actionCode: "APPROVE",
        name: "Approve Refunds",
        description: "Approve payment refunds"
    },
    {
        code: "PAYMENT_WEBHOOK_VIEW",
        moduleCode: "PAYMENT",
        resourceCode: "PAYMENT_WEBHOOK",
        actionCode: "VIEW",
        name: "View Payment Webhooks",
        description: "View payment webhook events"
    }
];

const STUDENT_PAYMENT_PERMISSIONS = [
    {
        code: "PAYMENT_HISTORY_VIEW",
        moduleCode: "PAYMENT",
        resourceCode: "PAYMENT_HISTORY",
        actionCode: "VIEW",
        name: "View My Payment History",
        description: "View personal payment history"
    }
];

const MENUS = [
    {
        code: "PAYMENT",
        name: "Payments",
        menuType: "MENU",
        routePath: null,
        icon: "credit-card",
        sortOrder: 7,
        isParent: true,
        permissionCode: "PAYMENT_VIEW",
        parentCode: null
    },
    {
        code: "ALL_PAYMENTS",
        name: "All Payments",
        menuType: "SUBMENU",
        routePath: "/admin/payments",
        icon: "credit-card",
        sortOrder: 1,
        isParent: false,
        permissionCode: "ALL_PAYMENTS_VIEW",
        parentCode: "PAYMENT"
    },
    {
        code: "TRANSACTIONS",
        name: "Transactions",
        menuType: "SUBMENU",
        routePath: "/admin/payments/transactions",
        icon: "receipt",
        sortOrder: 2,
        isParent: false,
        permissionCode: "TRANSACTION_VIEW",
        parentCode: "PAYMENT"
    },
    {
        code: "REFUNDS",
        name: "Refunds",
        menuType: "SUBMENU",
        routePath: "/admin/payments/refunds",
        icon: "wallet",
        sortOrder: 3,
        isParent: false,
        permissionCode: "REFUND_VIEW",
        parentCode: "PAYMENT"
    },
    {
        code: "PAYMENT_WEBHOOKS",
        name: "Webhooks",
        menuType: "SUBMENU",
        routePath: "/admin/payments/webhooks",
        icon: "receipt",
        sortOrder: 4,
        isParent: false,
        permissionCode: "PAYMENT_WEBHOOK_VIEW",
        parentCode: "PAYMENT"
    },
    {
        code: "PAYMENT_REPORTS",
        name: "Payment Reports",
        menuType: "SUBMENU",
        routePath: "/admin/reports/payments",
        icon: "chart-column",
        sortOrder: 5,
        isParent: false,
        permissionCode: "PAYMENT_REPORT_VIEW",
        parentCode: "PAYMENT"
    },
    {
        code: "STUDENT_PAYMENTS",
        name: "My Payments",
        menuType: "SUBMENU",
        routePath: "/student/payments",
        icon: "credit-card",
        sortOrder: 6,
        isParent: false,
        permissionCode: "PAYMENT_HISTORY_VIEW",
        parentCode: "PAYMENT"
    }
];

async function findRoles() {
    const result = await pool.query(`
        SELECT id::text AS id, code
        FROM olp_auth."role"
        WHERE soft_delete = false
          AND is_active = true
          AND UPPER(BTRIM(code)) IN ('ADMIN', 'INSTRUCTOR', 'STUDENT')
    `);

    return new Map(
        result.rows.map((role) => [
            String(role.code).toUpperCase(),
            role.id
        ])
    );
}

async function findAuditUserId(adminRoleId) {
    const result = await pool.query(`
        SELECT ur.user_id::text AS id
        FROM olp_auth.user_role ur
        INNER JOIN olp_auth."role" r
            ON r.id = ur.role_id
        WHERE ur.role_id = $1::bigint
          AND ur.is_active = true
          AND ur.soft_delete = false
          AND r.is_active = true
          AND r.soft_delete = false
        ORDER BY ur.user_id
        LIMIT 1
    `, [adminRoleId]);

    return result.rows[0]?.id ?? null;
}

async function upsertPermissions(specs) {
    const existing = await permissionService.getAllPermissions();
    const byCode = new Map(
        existing.map((permission) => [
            String(permission.code).toUpperCase(),
            permission
        ])
    );

    const idsByCode = new Map();
    let created = 0;
    let updated = 0;

    for (const spec of specs) {
        const key = spec.code.toUpperCase();
        const current = byCode.get(key);
        const payload = { ...spec, isActive: true };

        if (current) {
            const result = await permissionService.updatePermission(
                current.id,
                payload
            );
            idsByCode.set(key, result.id);
            updated += 1;
        } else {
            const result = await permissionService.createPermission(
                payload
            );
            idsByCode.set(key, result.id);
            created += 1;
        }
    }

    return { idsByCode, created, updated };
}

async function upsertMenus(specs, permissionIdsByCode) {
    const existing = await menuRepository.findAllMenus();
    const byCode = new Map(
        existing.map((menu) => [
            String(menu.code).toUpperCase(),
            menu
        ])
    );

    const idsByCode = new Map(
        existing.map((menu) => [
            String(menu.code).toUpperCase(),
            menu.id
        ])
    );

    let created = 0;
    let updated = 0;

    for (const spec of specs) {
        const key = spec.code.toUpperCase();
        const permissionId = permissionIdsByCode.get(
            spec.permissionCode.toUpperCase()
        );
        const parentId =
            spec.parentCode === null
                ? null
                : idsByCode.get(spec.parentCode.toUpperCase());

        if (!permissionId) {
            throw new Error(
                `Missing permission ${spec.permissionCode} for menu ${spec.code}`
            );
        }

        if (spec.parentCode !== null && !parentId) {
            throw new Error(
                `Missing parent menu ${spec.parentCode} for ${spec.code}`
            );
        }

        const payload = {
            parentId,
            code: spec.code,
            name: spec.name,
            menuType: spec.menuType,
            routePath: spec.routePath,
            icon: spec.icon,
            sortOrder: spec.sortOrder,
            isParent: spec.isParent,
            isActive: true,
            permissionId
        };

        const current = byCode.get(key);

        if (current) {
            const result = await menuService.updateMenu(
                current.id,
                payload
            );
            idsByCode.set(key, result.id);
            updated += 1;
        } else {
            const result = await menuService.createMenu(payload);
            idsByCode.set(key, result.id);
            created += 1;
        }
    }

    return { idsByCode, created, updated };
}

async function assignPermissions(roleId, permissionIds, auditUserId) {
    let saved = 0;

    for (const permissionId of permissionIds) {
        await rolePermissionRepository.createRolePermission({
            roleId,
            permissionId,
            isActive: true,
            auditUserId
        });
        saved += 1;
    }

    return saved;
}

async function revokePermissions(roleId, permissionIds, auditUserId) {
    const ids = Array.from(permissionIds).filter(Boolean);

    if (!ids.length) {
        return 0;
    }

    const result = await pool.query(`
        UPDATE olp_auth.role_permission
        SET
            is_active = false,
            updated_by = $3::bigint,
            updated_at = NOW()
        WHERE role_id = $1::bigint
          AND permission_id = ANY($2::bigint[])
          AND is_active = true
    `, [roleId, ids, auditUserId]);

    return result.rowCount;
}

async function main() {
    const roles = await findRoles();
    const adminRoleId = roles.get("ADMIN");
    const instructorRoleId = roles.get("INSTRUCTOR");
    const studentRoleId = roles.get("STUDENT");

    if (!adminRoleId || !instructorRoleId || !studentRoleId) {
        throw new Error(
            "ADMIN, INSTRUCTOR and STUDENT roles must exist and be active"
        );
    }

    const auditUserId = await findAuditUserId(adminRoleId);

    const adminPermissions = await upsertPermissions(
        ADMIN_PAYMENT_PERMISSIONS
    );
    const studentPermissions = await upsertPermissions(
        STUDENT_PAYMENT_PERMISSIONS
    );

    const allPermissionIdsByCode = new Map([
        ...adminPermissions.idsByCode,
        ...studentPermissions.idsByCode
    ]);

    const menus = await upsertMenus(MENUS, allPermissionIdsByCode);

    const adminAssignments = await assignPermissions(
        adminRoleId,
        adminPermissions.idsByCode.values(),
        auditUserId
    );

    const studentAssignments = await assignPermissions(
        studentRoleId,
        [
            allPermissionIdsByCode.get("PAYMENT_VIEW"),
            allPermissionIdsByCode.get("PAYMENT_HISTORY_VIEW")
        ],
        auditUserId
    );

    const adminOnlyCodes = [
        "ALL_PAYMENTS_VIEW",
        "ALL_PAYMENTS_DELETE",
        "TRANSACTION_VIEW",
        "PAYMENT_REPORT_VIEW",
        "REFUND_VIEW",
        "REFUND_CREATE",
        "REFUND_APPROVE",
        "PAYMENT_WEBHOOK_VIEW"
    ];

    const adminRevoked = await revokePermissions(
        adminRoleId,
        [allPermissionIdsByCode.get("PAYMENT_HISTORY_VIEW")],
        auditUserId
    );

    const instructorRevoked = await revokePermissions(
        instructorRoleId,
        [
            allPermissionIdsByCode.get("PAYMENT_VIEW"),
            allPermissionIdsByCode.get("PAYMENT_HISTORY_VIEW"),
            ...adminOnlyCodes.map((code) =>
                allPermissionIdsByCode.get(code)
            )
        ],
        auditUserId
    );

    const studentRevoked = await revokePermissions(
        studentRoleId,
        adminOnlyCodes.map((code) =>
            allPermissionIdsByCode.get(code)
        ),
        auditUserId
    );

    console.log(
        JSON.stringify(
            {
                roles: {
                    admin: adminRoleId,
                    instructor: instructorRoleId,
                    student: studentRoleId
                },
                permissions: {
                    admin: {
                        created: adminPermissions.created,
                        updated: adminPermissions.updated
                    },
                    student: {
                        created: studentPermissions.created,
                        updated: studentPermissions.updated
                    }
                },
                menus: {
                    created: menus.created,
                    updated: menus.updated
                },
                assignments: {
                    admin: adminAssignments,
                    student: studentAssignments
                },
                revocations: {
                    admin: adminRevoked,
                    instructor: instructorRevoked,
                    student: studentRevoked
                }
            },
            null,
            2
        )
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
