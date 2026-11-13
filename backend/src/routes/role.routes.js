
const express = require("express");
const roleController = require("../controller/role.controller");

const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

const ROLE_PERMISSION_CODES = {
    view: [
        "ROLE_VIEW", "ROLE_READ", "ROLE_LIST", "ROLE_GET",
        "ROLE_MANAGEMENT_VIEW", "USER_MANAGEMENT_ROLE_VIEW",
        "SYSTEM_SETTINGS_ROLE_VIEW", "RBAC_ROLE_VIEW",
    ],
    create: [
        "ROLE_CREATE", "ROLE_ADD",
        "ROLE_MANAGEMENT_CREATE", "ROLE_MANAGEMENT_ADD",
        "USER_MANAGEMENT_ROLE_CREATE", "USER_MANAGEMENT_ROLE_ADD",
        "SYSTEM_SETTINGS_ROLE_CREATE", "SYSTEM_SETTINGS_ROLE_ADD",
        "RBAC_ROLE_CREATE", "RBAC_ROLE_ADD",
    ],
    update: [
        "ROLE_UPDATE", "ROLE_EDIT",
        "ROLE_MANAGEMENT_UPDATE", "ROLE_MANAGEMENT_EDIT",
        "USER_MANAGEMENT_ROLE_UPDATE", "USER_MANAGEMENT_ROLE_EDIT",
        "SYSTEM_SETTINGS_ROLE_UPDATE", "SYSTEM_SETTINGS_ROLE_EDIT",
        "RBAC_ROLE_UPDATE", "RBAC_ROLE_EDIT",
    ],
    delete: [
        "ROLE_DELETE",
        "ROLE_MANAGEMENT_DELETE", "USER_MANAGEMENT_ROLE_DELETE",
        "SYSTEM_SETTINGS_ROLE_DELETE", "RBAC_ROLE_DELETE",
    ],
};

function allowRoleAction(action) {
    const allowedCodes = new Set(ROLE_PERMISSION_CODES[action] ?? []);

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const roles = Array.isArray(req.user.roles)
            ? req.user.roles.map((role) =>
                String(role?.code ?? role?.name ?? role)
                    .trim()
                    .toUpperCase()
            )
            : [];

        if (roles.includes("ADMIN")) return next();

        const permissions = Array.isArray(req.user.permissions)
            ? req.user.permissions.map((permission) =>
                String(
                    permission?.code ??
                    permission?.permission_code ??
                    permission
                )
                    .trim()
                    .toUpperCase()
            )
            : [];

        const hasPermission = permissions.some((code) =>
            allowedCodes.has(code)
        );

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "Permission denied",
            });
        }

        return next();
    };
}

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role management APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "1"
 *         code:
 *           type: string
 *           example: STUDENT
 *         name:
 *           type: string
 *           example: Student
 *         description:
 *           type: string
 *           nullable: true
 *           example: Standard student role
 *         isActive:
 *           type: boolean
 *           example: true
 *         softDelete:
 *           type: boolean
 *           example: false
 *     RoleRequest:
 *       type: object
 *       required:
 *         - code
 *         - name
 *         - isActive
 *       properties:
 *         code:
 *           type: string
 *           maxLength: 50
 *           example: INSTRUCTOR
 *         name:
 *           type: string
 *           maxLength: 100
 *           example: Instructor
 *         description:
 *           type: string
 *           nullable: true
 *           example: Instructor role
 *         isActive:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role or matching ROLE_VIEW permission required
 */
router.get(
    "/",
    authenticate,
    allowRoleAction("view"),
    roleController.getAllRoles
);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get a role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "1"
 *     responses:
 *       200:
 *         description: Role retrieved successfully
 *       400:
 *         description: Invalid role ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role or matching ROLE_VIEW permission required
 *       404:
 *         description: Role not found
 */
router.get(
    "/:id",
    authenticate,
    allowRoleAction("view"),
    roleController.getRoleById
);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleRequest'
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Invalid role data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role or matching ROLE_CREATE permission required
 *       409:
 *         description: Duplicate role code or name
 */
router.post(
    "/",
    authenticate,
    allowRoleAction("create"),
    roleController.createRole
);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleRequest'
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Invalid role data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role or matching ROLE_UPDATE permission required
 *       404:
 *         description: Role not found
 *       409:
 *         description: Duplicate role code or name
 */
router.put(
    "/:id",
    authenticate,
    allowRoleAction("update"),
    roleController.updateRole
);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Soft-delete a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *     responses:
 *       200:
 *         description: Role soft-deleted successfully
 *       400:
 *         description: Invalid role ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role or matching ROLE_DELETE permission required
 *       404:
 *         description: Role not found
 */
router.delete(
    "/:id",
    authenticate,
    allowRoleAction("delete"),
    roleController.deleteRole
);

module.exports = router;
