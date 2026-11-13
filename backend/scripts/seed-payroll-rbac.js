require("dotenv").config();

const pool = require("../src/config/database");

const permissionService = require("../src/services/permission.service");
const menuService = require("../src/services/menu.service");
const menuRepository = require("../src/repositories/menu.repository");
const rolePermissionRepository = require("../src/repositories/rolePermission.repository");

const ADMIN_PERMISSIONS = [
    {
        code: "PAYROLL_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL",
        actionCode: "VIEW",
        name: "View Payroll",
        description: "Access payroll management menus"
    },
    {
        code: "PAYROLL_COMPENSATION_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_COMPENSATION",
        actionCode: "VIEW",
        name: "View Payroll Compensation",
        description: "View instructor compensation setup"
    },
    {
        code: "PAYROLL_COMPENSATION_CREATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_COMPENSATION",
        actionCode: "CREATE",
        name: "Create Payroll Compensation",
        description: "Create instructor compensation setup"
    },
    {
        code: "PAYROLL_COMPENSATION_UPDATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_COMPENSATION",
        actionCode: "UPDATE",
        name: "Update Payroll Compensation",
        description: "Update instructor compensation setup"
    },
    {
        code: "PAYROLL_COMPENSATION_DELETE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_COMPENSATION",
        actionCode: "DELETE",
        name: "Delete Payroll Compensation",
        description: "Delete instructor compensation setup"
    },
    {
        code: "PAYROLL_PERIOD_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_PERIOD",
        actionCode: "VIEW",
        name: "View Payroll Periods",
        description: "View payroll periods"
    },
    {
        code: "PAYROLL_PERIOD_CREATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_PERIOD",
        actionCode: "CREATE",
        name: "Create Payroll Periods",
        description: "Create payroll periods"
    },
    {
        code: "PAYROLL_PERIOD_UPDATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_PERIOD",
        actionCode: "UPDATE",
        name: "Update Payroll Periods",
        description: "Update payroll periods"
    },
    {
        code: "PAYROLL_PERIOD_DELETE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_PERIOD",
        actionCode: "DELETE",
        name: "Delete Payroll Periods",
        description: "Delete payroll periods"
    },
    {
        code: "PAYROLL_INSTRUCTOR_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_INSTRUCTOR",
        actionCode: "VIEW",
        name: "View Instructor Payrolls",
        description: "View instructor payroll records"
    },
    {
        code: "PAYROLL_INSTRUCTOR_CREATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_INSTRUCTOR",
        actionCode: "CREATE",
        name: "Create Instructor Payrolls",
        description: "Create instructor payroll records"
    },
    {
        code: "PAYROLL_INSTRUCTOR_UPDATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_INSTRUCTOR",
        actionCode: "UPDATE",
        name: "Update Instructor Payrolls",
        description: "Update instructor payroll records"
    },
    {
        code: "PAYROLL_INSTRUCTOR_DELETE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_INSTRUCTOR",
        actionCode: "DELETE",
        name: "Delete Instructor Payrolls",
        description: "Delete instructor payroll records"
    },
    {
        code: "PAYROLL_EARNING_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_EARNING",
        actionCode: "VIEW",
        name: "View Course Earnings",
        description: "View course earnings"
    },
    {
        code: "PAYROLL_EARNING_CREATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_EARNING",
        actionCode: "CREATE",
        name: "Create Course Earnings",
        description: "Create course earnings"
    },
    {
        code: "PAYROLL_EARNING_UPDATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_EARNING",
        actionCode: "UPDATE",
        name: "Update Course Earnings",
        description: "Update course earnings"
    },
    {
        code: "PAYROLL_EARNING_DELETE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_EARNING",
        actionCode: "DELETE",
        name: "Delete Course Earnings",
        description: "Delete course earnings"
    },
    {
        code: "PAYROLL_PAYMENT_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_PAYMENT",
        actionCode: "VIEW",
        name: "View Payroll Payments",
        description: "View payroll payments"
    },
    {
        code: "PAYROLL_PAYMENT_CREATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_PAYMENT",
        actionCode: "CREATE",
        name: "Create Payroll Payments",
        description: "Create payroll payments"
    },
    {
        code: "PAYROLL_PAYMENT_UPDATE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_PAYMENT",
        actionCode: "UPDATE",
        name: "Update Payroll Payments",
        description: "Update payroll payments"
    },
    {
        code: "PAYROLL_PAYMENT_DELETE",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_PAYMENT",
        actionCode: "DELETE",
        name: "Delete Payroll Payments",
        description: "Delete payroll payments"
    },
    {
        code: "PAYROLL_REPORT_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "PAYROLL_REPORT",
        actionCode: "VIEW",
        name: "View Payroll Reports",
        description: "View payroll reports"
    }
];

const INSTRUCTOR_PERMISSIONS = [
    {
        code: "INSTRUCTOR_SELF_PAYROLL_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "INSTRUCTOR_SELF_PAYROLL",
        actionCode: "VIEW",
        name: "View My Payroll",
        description: "Access instructor payroll menus"
    },
    {
        code: "INSTRUCTOR_SELF_OVERVIEW_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "INSTRUCTOR_SELF_OVERVIEW",
        actionCode: "VIEW",
        name: "View Earnings Overview",
        description: "View personal earnings overview"
    },
    {
        code: "INSTRUCTOR_SELF_EARNING_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "INSTRUCTOR_SELF_EARNING",
        actionCode: "VIEW",
        name: "View My Course Earnings",
        description: "View personal course earnings"
    },
    {
        code: "INSTRUCTOR_SELF_HISTORY_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "INSTRUCTOR_SELF_HISTORY",
        actionCode: "VIEW",
        name: "View My Payroll History",
        description: "View personal payroll history"
    },
    {
        code: "INSTRUCTOR_SELF_PAYMENT_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "INSTRUCTOR_SELF_PAYMENT",
        actionCode: "VIEW",
        name: "View My Payment History",
        description: "View personal payment history"
    },
    {
        code: "INSTRUCTOR_SELF_PAYSLIP_VIEW",
        moduleCode: "PAYROLL",
        resourceCode: "INSTRUCTOR_SELF_PAYSLIP",
        actionCode: "VIEW",
        name: "View My Payslip",
        description: "Download personal payslips"
    }
];

const MENUS = [
    {
        code: "PAYROLL_MANAGEMENT",
        legacyCodes: ["PAYROLL"],
        name: "Payroll",
        menuType: "MENU",
        routePath: null,
        icon: "wallet",
        sortOrder: 7,
        isParent: true,
        permissionCode: "PAYROLL_VIEW",
        parentCode: null
    },
    {
        code: "COMPENSATION",
        name: "Compensation",
        menuType: "SUBMENU",
        routePath: "/admin/payroll/compensation",
        icon: "wallet",
        sortOrder: 1,
        isParent: false,
        permissionCode: "PAYROLL_COMPENSATION_VIEW",
        parentCode: "PAYROLL_MANAGEMENT"
    },
    {
        code: "REFERRAL_MASTER",
        name: "Referral Master",
        menuType: "SUBMENU",
        routePath: "/admin/payroll/referral-master",
        icon: "ticket-percent",
        sortOrder: 7,
        isParent: false,
        permissionCode: "PAYROLL_COMPENSATION_VIEW",
        parentCode: "PAYROLL_MANAGEMENT"
    },
    {
        code: "PAYROLL_PERIODS",
        name: "Payroll Periods",
        menuType: "SUBMENU",
        routePath: "/admin/payroll/periods",
        icon: "clock",
        sortOrder: 2,
        isParent: false,
        permissionCode: "PAYROLL_PERIOD_VIEW",
        parentCode: "PAYROLL_MANAGEMENT"
    },
    {
        code: "INSTRUCTOR_PAYROLLS",
        name: "Instructor Payrolls",
        menuType: "SUBMENU",
        routePath: "/admin/payroll/instructor-payrolls",
        icon: "users",
        sortOrder: 3,
        isParent: false,
        permissionCode: "PAYROLL_INSTRUCTOR_VIEW",
        parentCode: "PAYROLL_MANAGEMENT"
    },
    {
        code: "COURSE_EARNINGS",
        name: "Course Earnings",
        menuType: "SUBMENU",
        routePath: "/admin/payroll/course-earnings",
        icon: "reports",
        sortOrder: 4,
        isParent: false,
        permissionCode: "PAYROLL_EARNING_VIEW",
        parentCode: "PAYROLL_MANAGEMENT"
    },
    {
        code: "PAYROLL_PAYMENTS",
        name: "Payroll Payments",
        menuType: "SUBMENU",
        routePath: "/admin/payroll/payments",
        icon: "receipt",
        sortOrder: 5,
        isParent: false,
        permissionCode: "PAYROLL_PAYMENT_VIEW",
        parentCode: "PAYROLL_MANAGEMENT"
    },
    {
        code: "PAYROLL_REPORTS",
        name: "Payroll Reports",
        menuType: "SUBMENU",
        routePath: "/admin/payroll/reports",
        icon: "reports",
        sortOrder: 6,
        isParent: false,
        permissionCode: "PAYROLL_REPORT_VIEW",
        parentCode: "PAYROLL_MANAGEMENT"
    },
    {
        code: "INSTRUCTOR_PAYROLL",
        name: "Payroll",
        menuType: "MENU",
        routePath: null,
        icon: "wallet",
        sortOrder: 8,
        isParent: true,
        permissionCode: "INSTRUCTOR_SELF_PAYROLL_VIEW",
        parentCode: null
    },
    {
        code: "EARNINGS_OVERVIEW",
        name: "Earnings Overview",
        menuType: "SUBMENU",
        routePath: "/instructor/payroll",
        icon: "wallet",
        sortOrder: 1,
        isParent: false,
        permissionCode: "INSTRUCTOR_SELF_OVERVIEW_VIEW",
        parentCode: "INSTRUCTOR_PAYROLL"
    },
    {
        code: "INSTRUCTOR_COURSE_EARNINGS",
        name: "Course Earnings",
        menuType: "SUBMENU",
        routePath: "/instructor/payroll/course-earnings",
        icon: "reports",
        sortOrder: 2,
        isParent: false,
        permissionCode: "INSTRUCTOR_SELF_EARNING_VIEW",
        parentCode: "INSTRUCTOR_PAYROLL"
    },
    {
        code: "PAYROLL_HISTORY",
        name: "Payroll History",
        menuType: "SUBMENU",
        routePath: "/instructor/payroll/history",
        icon: "clock",
        sortOrder: 3,
        isParent: false,
        permissionCode: "INSTRUCTOR_SELF_HISTORY_VIEW",
        parentCode: "INSTRUCTOR_PAYROLL"
    },
    {
        code: "INSTRUCTOR_PAYMENT_HISTORY",
        legacyCodes: ["PAYMENT_HISTORY"],
        name: "Payment History",
        menuType: "SUBMENU",
        routePath: "/instructor/payroll/payments",
        icon: "receipt",
        sortOrder: 4,
        isParent: false,
        permissionCode: "INSTRUCTOR_SELF_PAYMENT_VIEW",
        parentCode: "INSTRUCTOR_PAYROLL"
    },
    {
        code: "PAYSLIP",
        name: "Download Payslip",
        menuType: "SUBMENU",
        routePath: "/instructor/payroll/payslip",
        icon: "file-text",
        sortOrder: 5,
        isParent: false,
        permissionCode: "INSTRUCTOR_SELF_PAYSLIP_VIEW",
        parentCode: "INSTRUCTOR_PAYROLL"
    }
];

async function findRoles() {
    const result = await pool.query(`
        SELECT id::text AS id, code
        FROM olp_auth."role"
        WHERE soft_delete = false
          AND is_active = true
          AND UPPER(BTRIM(code)) IN ('ADMIN', 'INSTRUCTOR')
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
        const permissionKey = spec.permissionCode.toUpperCase();
        const permissionId = permissionIdsByCode.get(permissionKey);
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

        const legacyMatch = (spec.legacyCodes ?? [])
            .map((code) => byCode.get(code.toUpperCase()))
            .find(Boolean);

        const current = byCode.get(key) ?? legacyMatch;

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

async function main() {
    const roles = await findRoles();
    const adminRoleId = roles.get("ADMIN");
    const instructorRoleId = roles.get("INSTRUCTOR");

    if (!adminRoleId || !instructorRoleId) {
        throw new Error(
            "ADMIN and INSTRUCTOR roles must exist and be active"
        );
    }

    const auditUserId = await findAuditUserId(adminRoleId);

    const adminPermissions = await upsertPermissions(
        ADMIN_PERMISSIONS
    );
    const instructorPermissions = await upsertPermissions(
        INSTRUCTOR_PERMISSIONS
    );

    const allPermissionIdsByCode = new Map([
        ...adminPermissions.idsByCode,
        ...instructorPermissions.idsByCode
    ]);

    const menus = await upsertMenus(MENUS, allPermissionIdsByCode);

    const adminAssignments = await assignPermissions(
        adminRoleId,
        adminPermissions.idsByCode.values(),
        auditUserId
    );

    const instructorAssignments = await assignPermissions(
        instructorRoleId,
        instructorPermissions.idsByCode.values(),
        auditUserId
    );

    console.log(
        JSON.stringify(
            {
                roles: {
                    admin: adminRoleId,
                    instructor: instructorRoleId
                },
                permissions: {
                    admin: {
                        created: adminPermissions.created,
                        updated: adminPermissions.updated
                    },
                    instructor: {
                        created: instructorPermissions.created,
                        updated: instructorPermissions.updated
                    }
                },
                menus: {
                    created: menus.created,
                    updated: menus.updated
                },
                assignments: {
                    admin: adminAssignments,
                    instructor: instructorAssignments
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
