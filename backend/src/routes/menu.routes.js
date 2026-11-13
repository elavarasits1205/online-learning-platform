
const express = require("express");

const menuController = require("../controller/menu.controller");

const { authenticate } =
    require("../middleware/auth.middleware");

const { requireRole } =
    require("../middleware/rbac.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Menus
 *   description: Menu master management APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Menu:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "1"
 *         parentId:
 *           type: string
 *           nullable: true
 *           example: "2"
 *         parentName:
 *           type: string
 *           nullable: true
 *           example: "Course Management"
 *         code:
 *           type: string
 *           example: COURSE_LIST
 *         name:
 *           type: string
 *           example: Course List
 *         menuType:
 *           type: string
 *           enum: [MENU, SUBMENU, ACTION]
 *           example: SUBMENU
 *         routePath:
 *           type: string
 *           nullable: true
 *           example: /admin/courses
 *         icon:
 *           type: string
 *           nullable: true
 *           example: BookOpen
 *         sortOrder:
 *           type: integer
 *           example: 1
 *         isParent:
 *           type: boolean
 *           example: false
 *         isActive:
 *           type: boolean
 *           example: true
 *         softDelete:
 *           type: boolean
 *           example: false
 *         permissionId:
 *           type: string
 *           example: "5"
 *         permissionName:
 *           type: string
 *           example: View Courses
 *
 *     MenuRequest:
 *       type: object
 *       required:
 *         - code
 *         - name
 *         - permissionId
 *       properties:
 *         parentId:
 *           type: string
 *           nullable: true
 *           example: "1"
 *         code:
 *           type: string
 *           maxLength: 100
 *           example: COURSE_LIST
 *         name:
 *           type: string
 *           maxLength: 150
 *           example: Course List
 *         menuType:
 *           type: string
 *           enum: [MENU, SUBMENU, ACTION]
 *           default: MENU
 *         routePath:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: /admin/courses
 *         icon:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: BookOpen
 *         sortOrder:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         isParent:
 *           type: boolean
 *           default: false
 *         isActive:
 *           type: boolean
 *           default: true
 *         permissionId:
 *           type: string
 *           example: "5"
 */

/**
 * @swagger
 * /api/menus:
 *   get:
 *     summary: Get all non-deleted menus with parent and permission names
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Menus retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 */
router.get(
    "/",
    authenticate,
    requireRole("ADMIN"),
    menuController.getAllMenus
);

/**
 * @swagger
 * /api/menus/{id}:
 *   get:
 *     summary: Get a menu by ID with parent and permission names
 *     tags: [Menus]
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
 *         description: Menu retrieved successfully
 *       400:
 *         description: Invalid menu ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       404:
 *         description: Menu not found
 */
router.get(
    "/:id",
    authenticate,
    requireRole("ADMIN"),
    menuController.getMenuById
);

/**
 * @swagger
 * /api/menus:
 *   post:
 *     summary: Create a menu
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MenuRequest'
 *     responses:
 *       201:
 *         description: Menu created successfully, including FK names
 *       400:
 *         description: Invalid menu data or foreign key
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       409:
 *         description: Duplicate menu code
 */
router.post(
    "/",
    authenticate,
    requireRole("ADMIN"),
    menuController.createMenu
);

/**
 * @swagger
 * /api/menus/{id}:
 *   put:
 *     summary: Update a menu
 *     tags: [Menus]
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
 *             $ref: '#/components/schemas/MenuRequest'
 *     responses:
 *       200:
 *         description: Menu updated successfully, including FK names
 *       400:
 *         description: Invalid menu data or foreign key
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       404:
 *         description: Menu not found
 *       409:
 *         description: Duplicate menu code
 */
router.put(
    "/:id",
    authenticate,
    requireRole("ADMIN"),
    menuController.updateMenu
);

/**
 * @swagger
 * /api/menus/{id}:
 *   delete:
 *     summary: Soft-delete a menu
 *     tags: [Menus]
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
 *         description: Menu soft-deleted successfully, including FK names
 *       400:
 *         description: Invalid menu ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       404:
 *         description: Menu not found
 */
router.delete(
    "/:id",
    authenticate,
    requireRole("ADMIN"),
    menuController.deleteMenu
);

module.exports = router;
