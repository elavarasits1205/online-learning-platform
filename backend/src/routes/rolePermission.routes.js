const express = require("express");

const router = express.Router();
const controller = require("../controller/rolePermission.controller");

const {
    authenticate,
    requireRole,
} = require("../middleware/auth.middleware");

// ---------------------------------------------------------
// Validate required middleware and controller exports
// ---------------------------------------------------------

if (typeof authenticate !== "function") {
    throw new TypeError(
        "auth.middleware.js must export authenticate()"
    );
}

if (typeof requireRole !== "function") {
    throw new TypeError(
        "auth.middleware.js must export requireRole()"
    );
}

const requiredHandlers = [
    "getAllRolePermissions",
    "getRolePermissionById",
    "createRolePermission",
    "updateRolePermission",
    "updateRolePermissionStatus",
    "deleteRolePermission",
    "getRoleMenuPermissions",
    "getEffectivePermissions",
];

for (const name of requiredHandlers) {
    if (typeof controller[name] !== "function") {
        throw new TypeError(
            `rolePermission.controller.js must export ${name}()`
        );
    }
}

// ---------------------------------------------------------
// Swagger schemas
//
// BIGINT IDs are strings to avoid JavaScript precision loss.
// Request property names match rolePermission.service.js.
// ---------------------------------------------------------

/**
 * @swagger
 * tags:
 *   - name: Role Permissions
 *     description: Administrator role-permission assignment APIs
 *
 * components:
 *   schemas:
 *     RolePermission:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "10"
 *         roleId:
 *           type: string
 *           example: "2"
 *         roleCode:
 *           type: string
 *           example: "INSTRUCTOR"
 *         roleName:
 *           type: string
 *           example: "Instructor"
 *         permissionId:
 *           type: string
 *           example: "5"
 *         permissionCode:
 *           type: string
 *           example: "COURSE_VIEW"
 *         moduleCode:
 *           type: string
 *           example: "COURSE"
 *         resourceCode:
 *           type: string
 *           example: "COURSE"
 *         actionCode:
 *           type: string
 *           example: "VIEW"
 *         permissionName:
 *           type: string
 *           example: "View Courses"
 *         isActive:
 *           type: boolean
 *           example: true
 *         softDelete:
 *           type: boolean
 *           example: false
 *
 *     CreateRolePermission:
 *       type: object
 *       required:
 *         - roleId
 *         - permissionId
 *       properties:
 *         roleId:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *           example: "2"
 *         permissionId:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *           example: "5"
 *         isActive:
 *           type: boolean
 *           default: true
 *
 *     UpdateRolePermission:
 *       type: object
 *       properties:
 *         roleId:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *           example: "2"
 *         permissionId:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *           example: "5"
 *         isActive:
 *           type: boolean
 *           example: true
 *
 *     UpdateRolePermissionStatus:
 *       type: object
 *       required:
 *         - isActive
 *       properties:
 *         isActive:
 *           type: boolean
 *           example: false
 *
 *     EffectivePermission:
 *       type: object
 *       properties:
 *         permissionId:
 *           type: string
 *           example: "5"
 *         code:
 *           type: string
 *           example: "COURSE_VIEW"
 *         moduleCode:
 *           type: string
 *           example: "COURSE"
 *         resourceCode:
 *           type: string
 *           example: "COURSE"
 *         actionCode:
 *           type: string
 *           example: "VIEW"
 *         name:
 *           type: string
 *           example: "View Courses"
 *
 *     RoleMenuPermission:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "1"
 *         parentId:
 *           type: string
 *           nullable: true
 *           example: null
 *         code:
 *           type: string
 *           example: "COURSES"
 *         name:
 *           type: string
 *           example: "Courses"
 *         menuType:
 *           type: string
 *           enum: [MENU, SUBMENU, ACTION]
 *         routePath:
 *           type: string
 *           nullable: true
 *           example: "/instructor/courses"
 *         icon:
 *           type: string
 *           nullable: true
 *         sortOrder:
 *           type: integer
 *         isParent:
 *           type: boolean
 *         permissionId:
 *           type: string
 *         moduleCode:
 *           type: string
 *         resourceCode:
 *           type: string
 *         canView:
 *           type: boolean
 *         canCreate:
 *           type: boolean
 *         canUpdate:
 *           type: boolean
 *         canDelete:
 *           type: boolean
 *         actions:
 *           type: array
 *           items:
 *             type: string
 *         isContainer:
 *           type: boolean
 *
 *     ApiSuccess:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         count:
 *           type: integer
 *         data:
 *           type: array
 *           items: {}
 *
 *     ApiError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Invalid roleId
 *
 *   parameters:
 *     RolePermissionId:
 *       in: path
 *       name: id
 *       required: true
 *       description: Role-permission assignment ID
 *       schema:
 *         type: string
 *         pattern: '^[1-9][0-9]*$'
 *       example: "10"
 *
 *     RoleId:
 *       in: path
 *       name: roleId
 *       required: true
 *       description: Role ID
 *       schema:
 *         type: string
 *         pattern: '^[1-9][0-9]*$'
 *       example: "2"
 */

// ---------------------------------------------------------
// Authentication and authorization
// All endpoints below require an authenticated ADMIN.
// ---------------------------------------------------------

router.use(authenticate);
router.use(requireRole("ADMIN"));

// ---------------------------------------------------------
// GET /api/role-permissions
// List assignment records, optionally filtered by role.
// ---------------------------------------------------------

/**
 * @swagger
 * /api/role-permissions:
 *   get:
 *     summary: Get role-permission assignments
 *     description: Returns assignment records. Set includeInactive=true to include inactive assignments that have not been soft-deleted.
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roleId
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         required: false
 *         example: "2"
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         required: false
 *         example: true
 *     responses:
 *       200:
 *         description: Assignments retrieved successfully
 *       400:
 *         description: Invalid role ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 */
router.get("/", controller.getAllRolePermissions);

// ---------------------------------------------------------
// GET /api/role-permissions/role/:roleId/menus
// Returns effective menu visibility and CRUD flags.
// This is NOT the complete permission catalogue.
// ---------------------------------------------------------

/**
 * @swagger
 * /api/role-permissions/role/{roleId}/menus:
 *   get:
 *     summary: Get accessible menus for a role
 *     description: Returns menus granted by active permissions, including ancestor navigation containers. Use GET /api/permissions for the complete permission catalogue.
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/RoleId'
 *     responses:
 *       200:
 *         description: Menu permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RoleMenuPermission'
 *       400:
 *         description: Invalid role ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 *       404:
 *         description: Active role not found
 */
router.get(
    "/role/:roleId/menus",
    controller.getRoleMenuPermissions
);

// ---------------------------------------------------------
// GET /api/role-permissions/role/:roleId/effective
// Returns the active permission catalogue assigned to a role.
// ---------------------------------------------------------

/**
 * @swagger
 * /api/role-permissions/role/{roleId}/effective:
 *   get:
 *     summary: Get effective permissions for a role
 *     description: Returns active permissions assigned to the specified role.
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/RoleId'
 *     responses:
 *       200:
 *         description: Effective permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EffectivePermission'
 *       400:
 *         description: Invalid role ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 *       404:
 *         description: Active role not found
 */
router.get(
    "/role/:roleId/effective",
    controller.getEffectivePermissions
);

// ---------------------------------------------------------
// GET /api/role-permissions/:id
// ---------------------------------------------------------

/**
 * @swagger
 * /api/role-permissions/{id}:
 *   get:
 *     summary: Get an assignment by ID
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/RolePermissionId'
 *     responses:
 *       200:
 *         description: Assignment retrieved successfully
 *       400:
 *         description: Invalid assignment ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 *       404:
 *         description: Assignment not found
 */
router.get("/:id", controller.getRolePermissionById);

// ---------------------------------------------------------
// POST /api/role-permissions
// Create or reactivate an assignment.
// ---------------------------------------------------------

/**
 * @swagger
 * /api/role-permissions:
 *   post:
 *     summary: Create or reactivate a role-permission assignment
 *     description: Creates the assignment, or reactivates the existing role/permission pair when the unique constraint already exists.
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRolePermission'
 *           example:
 *             roleId: "2"
 *             permissionId: "5"
 *             isActive: true
 *     responses:
 *       201:
 *         description: Assignment saved successfully
 *       400:
 *         description: Invalid request body or ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 *       404:
 *         description: Active role or permission not found
 *       409:
 *         description: Duplicate assignment conflict
 */
router.post("/", controller.createRolePermission);

// ---------------------------------------------------------
// PUT /api/role-permissions/:id
// ---------------------------------------------------------

/**
 * @swagger
 * /api/role-permissions/{id}:
 *   put:
 *     summary: Update a role-permission assignment
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/RolePermissionId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRolePermission'
 *           example:
 *             isActive: false
 *     responses:
 *       200:
 *         description: Assignment updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 *       404:
 *         description: Assignment, role, or permission not found
 *       409:
 *         description: Duplicate assignment conflict
 */
router.put("/:id", controller.updateRolePermission);

// ---------------------------------------------------------
// PATCH /api/role-permissions/:id/status
// ---------------------------------------------------------

/**
 * @swagger
 * /api/role-permissions/{id}/status:
 *   patch:
 *     summary: Change assignment active status
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/RolePermissionId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRolePermissionStatus'
 *           example:
 *             isActive: false
 *     responses:
 *       200:
 *         description: Assignment status updated successfully
 *       400:
 *         description: Invalid ID or status
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 *       404:
 *         description: Assignment not found
 */
router.patch(
    "/:id/status",
    controller.updateRolePermissionStatus
);

// ---------------------------------------------------------
// DELETE /api/role-permissions/:id
// Soft-delete an assignment.
// ---------------------------------------------------------

/**
 * @swagger
 * /api/role-permissions/{id}:
 *   delete:
 *     summary: Soft-delete an assignment
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/RolePermissionId'
 *     responses:
 *       200:
 *         description: Assignment soft-deleted successfully
 *       400:
 *         description: Invalid assignment ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator role required
 *       404:
 *         description: Assignment not found
 */
router.delete("/:id", controller.deleteRolePermission);

module.exports = router;
