
const express = require("express");
const router = express.Router();

const {
    authenticate,
    requireRole,
    requirePermission
} = require("../middleware/auth.middleware");

const moduleController = require("../controller/module.controller");

/**
 * @swagger
 * tags:
 *   name: Module
 *   description: Course module management APIs
 */

router.use(authenticate);
router.use(requireRole("INSTRUCTOR"));

/**
 * @swagger
 * /api/modules:
 *   post:
 *     summary: Create a module under my course
 *     tags: [Module]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - course_id
 *               - title
 *             properties:
 *               course_id:
 *                 type: integer
 *                 example: 1
 *               title:
 *                 type: string
 *                 example: Introduction to JavaScript
 *               description:
 *                 type: string
 *                 example: JavaScript fundamentals
 *               sequence_number:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Module created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 *       404:
 *         description: Course not found or not owned by instructor
 */
router.post(
    "/",
    requirePermission("MODULE_CREATE"),
    moduleController.create
);

/**
 * @swagger
 * /api/modules/course/{courseId}:
 *   get:
 *     summary: Get modules for my course
 *     tags: [Module]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Modules retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 */
router.get(
    "/course/:courseId",
    requirePermission("MODULE_VIEW"),
    moduleController.listByCourse
);

/**
 * @swagger
 * /api/modules/{id}:
 *   put:
 *     summary: Update my module
 *     tags: [Module]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Module ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               sequence_number:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Module updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 *       404:
 *         description: Module not found or not owned by instructor
 */
router.put(
    "/:id",
    requirePermission("MODULE_UPDATE"),
    moduleController.update
);

module.exports = router;
