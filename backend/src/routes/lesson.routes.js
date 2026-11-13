
const express = require("express");
const router = express.Router();

const {
    authenticate,
    requireRole,
    requirePermission
} = require("../middleware/auth.middleware");
const { uploadVideo } = require("../middleware/uploadVideo.middleware");

const lessonController = require("../controller/lesson.controller");

/**
 * @swagger
 * tags:
 *   name: Lesson
 *   description: Course lesson management APIs
 */

router.use(authenticate);
router.use(requireRole("INSTRUCTOR"));

/**
 * @swagger
 * /api/lessons:
 *   post:
 *     summary: Create a lesson under my module
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - module_id
 *               - title
 *             properties:
 *               module_id:
 *                 type: integer
 *                 example: 1
 *               title:
 *                 type: string
 *                 example: JavaScript Variables
 *               description:
 *                 type: string
 *                 example: Learn let, const, and var
 *               content_type:
 *                 type: string
 *                 example: VIDEO
 *               content_url:
 *                 type: string
 *                 example: https://example.com/lesson.mp4
 *               duration_minutes:
 *                 type: integer
 *                 example: 15
 *               sequence_number:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Lesson created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 *       404:
 *         description: Module not found or not owned by instructor
 */
router.post(
    "/",
    requirePermission("LESSON_CREATE"),
    lessonController.create
);

/**
 * @swagger
 * /api/lessons/module/{moduleId}:
 *   get:
 *     summary: Get lessons for my module
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Module ID
 *     responses:
 *       200:
 *         description: Lessons retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 */
router.get(
    "/module/:moduleId",
    requirePermission("LESSON_VIEW"),
    lessonController.listByModule
);

/**
 * @swagger
 * /api/lessons/{id}:
 *   put:
 *     summary: Update my lesson
 *     tags: [Lesson]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lesson ID
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
 *               content_type:
 *                 type: string
 *               content_url:
 *                 type: string
 *               duration_minutes:
 *                 type: integer
 *               sequence_number:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Lesson updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 *       404:
 *         description: Lesson not found or not owned by instructor
 */
router.put(
    "/:id",
    requirePermission("LESSON_UPDATE"),
    lessonController.update
);

router.post(
    "/module/:moduleId/video",
    requirePermission("LESSON_CREATE"),
    uploadVideo,
    lessonController.uploadVideo
);


module.exports = router;
