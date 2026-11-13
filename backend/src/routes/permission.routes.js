
const express = require("express");

const permissionController =
    require("../controller/permission.controller");

const { authenticate } =
    require("../middleware/auth.middleware");

const { requireRole } =
    require("../middleware/rbac.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Permission master management APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "1"
 *         code:
 *           type: string
 *           example: COURSE_CREATE
 *         moduleCode:
 *           type: string
 *           example: COURSE
 *         resourceCode:
 *           type: string
 *           example: COURSE
 *         actionCode:
 *           type: string
 *           example: CREATE
 *         name:
 *           type: string
 *           example: Create Course
 *         description:
 *           type: string
 *           nullable: true
 *           example: Allows creating a course
 *         isActive:
 *           type: boolean
 *           example: true
 *         softDelete:
 *           type: boolean
 *           example: false
 *
 *     PermissionRequest:
 *       type: object
 *       required:
 *         - code
 *         - moduleCode
 *         - resourceCode
 *         - actionCode
 *         - name
 *         - isActive
 *       properties:
 *         code:
 *           type: string
 *           maxLength: 150
 *           example: COURSE_CREATE
 *         moduleCode:
 *           type: string
 *           maxLength: 50
 *           example: COURSE
 *         resourceCode:
 *           type: string
 *           maxLength: 100
 *           example: COURSE
 *         actionCode:
 *           type: string
 *           maxLength: 50
 *           example: CREATE
 *         name:
 *           type: string
 *           maxLength: 150
 *           example: Create Course
 *         description:
 *           type: string
 *           nullable: true
 *           example: Allows creating a course
 *         isActive:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/permissions:
 *   get:
 *     summary: Get all permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 */
router.get(
    "/",
    authenticate,
    requireRole("ADMIN"),
    permissionController.getAllPermissions
);

/**
 * @swagger
 * /api/permissions/{id}:
 *   get:
 *     summary: Get permission by ID
 *     tags: [Permissions]
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
 *         description: Permission retrieved successfully
 *       400:
 *         description: Invalid permission ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       404:
 *         description: Permission not found
 */
router.get(
    "/:id",
    authenticate,
    requireRole("ADMIN"),
    permissionController.getPermissionById
);

/**
 * @swagger
 * /api/permissions:
 *   post:
 *     summary: Create a permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermissionRequest'
 *     responses:
 *       201:
 *         description: Permission created successfully
 *       400:
 *         description: Invalid permission data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       409:
 *         description: Duplicate permission
 */
router.post(
    "/",
    authenticate,
    requireRole("ADMIN"),
    permissionController.createPermission
);

/**
 * @swagger
 * /api/permissions/{id}:
 *   put:
 *     summary: Update a permission
 *     tags: [Permissions]
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
 *             $ref: '#/components/schemas/PermissionRequest'
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *       400:
 *         description: Invalid permission data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       404:
 *         description: Permission not found
 *       409:
 *         description: Duplicate permission
 */
router.put(
    "/:id",
    authenticate,
    requireRole("ADMIN"),
    permissionController.updatePermission
);

/**
 * @swagger
 * /api/permissions/{id}:
 *   delete:
 *     summary: Soft-delete a permission
 *     tags: [Permissions]
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
 *         description: Permission soft-deleted successfully
 *       400:
 *         description: Invalid permission ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       404:
 *         description: Permission not found
 */
router.delete(
    "/:id",
    authenticate,
    requireRole("ADMIN"),
    permissionController.deletePermission
);

module.exports = router;
