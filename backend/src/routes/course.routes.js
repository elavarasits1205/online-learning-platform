
const express = require("express");
const router = express.Router();


const {
    authenticate,
    requireRole,
    requirePermission
} = require("../middleware/auth.middleware");

const {
    uploadThumbnail
} = require("../middleware/upload.middleware");

const courseController = require("../controller/course.controller");

/**
 * @swagger
 * tags:
 *   name: Course
 *   description: Instructor course management APIs
 */

router.use(authenticate);
router.use(requireRole("INSTRUCTOR"));

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Create a course
 *     tags: [Course]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - course_code
 *               - title
 *             properties:
 *               category_id:
 *                 type: integer
 *                 example: 1
 *                 description: Existing course category ID
 *               course_code:
 *                 type: string
 *                 example: JS101
 *               title:
 *                 type: string
 *                 example: JavaScript Fundamentals
 *               short_description:
 *                 type: string
 *                 example: Learn JavaScript basics
 *               description:
 *                 type: string
 *                 example: Learn JavaScript from the basics
 *               thumbnail_url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/course.jpg
 *               level:
 *                 type: string
 *                 example: BEGINNER
 *                 description: Must match the values allowed by your database
 *               language_code:
 *                 type: string
 *                 example: en
 *               currency_code:
 *                 type: string
 *                 example: INR
 *               course_type:
 *                 type: string
 *                 enum: [FREE, PAID]
 *                 example: PAID
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 999
 *               duration_minutes:
 *                 type: integer
 *                 minimum: 0
 *                 example: 600
 *           example:
 *             category_id: 1
 *             course_code: JS101
 *             title: JavaScript Fundamentals
 *             short_description: Learn JavaScript basics
 *             description: Learn JavaScript from the basics
 *             thumbnail_url: https://example.com/course.jpg
 *             level: BEGINNER
 *             language_code: en
 *             currency_code: INR
 *             course_type: PAID
 *             price: 999
 *             duration_minutes: 600
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Invalid input or missing required fields
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 */
router.post(
    "/",
    requirePermission("COURSE_CREATE"),
    courseController.create
);

/**
 * @swagger
 * /api/courses/my:
 *   get:
 *     summary: Get my courses
 *     tags: [Course]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Instructor courses retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 */
router.get(
    "/my",
    requirePermission("COURSE_VIEW"),
    courseController.listMy
);

/**
 * @swagger
 * /api/courses/{id}:
 *   put:
 *     summary: Update my course
 *     tags: [Course]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               category_id:
 *                 type: integer
 *                 example: 1
 *               course_code:
 *                 type: string
 *                 example: JS101
 *               title:
 *                 type: string
 *                 example: JavaScript Fundamentals
 *               short_description:
 *                 type: string
 *                 example: Learn JavaScript basics
 *               description:
 *                 type: string
 *                 example: Updated course description
 *               thumbnail_url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/course.jpg
 *               level:
 *                 type: string
 *                 example: BEGINNER
 *               language_code:
 *                 type: string
 *                 example: en
 *               currency_code:
 *                 type: string
 *                 example: INR
 *               course_type:
 *                 type: string
 *                 enum: [FREE, PAID]
 *                 example: PAID
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 999
 *               duration_minutes:
 *                 type: integer
 *                 minimum: 0
 *                 example: 600
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 *       404:
 *         description: Course not found or not owned by instructor
 */
router.put(
    "/:id",
    requirePermission("COURSE_UPDATE"),
    courseController.update
);

/**
 * @swagger
 * /api/courses/{id}/submit:
 *   post:
 *     summary: Submit my course for admin approval
 *     tags: [Course]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course submitted successfully
 *       400:
 *         description: Invalid course state
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 *       404:
 *         description: Course not found or not owned by instructor
 *       409:
 *         description: Course approval workflow is not configured
 */
router.post(
    "/:id/submit",
    requirePermission("COURSE_UPDATE"),
    courseController.submit
);
/**
 * @swagger
 * /api/courses/{id}/thumbnail:
 *   post:
 *     summary: Upload a course thumbnail
 *     tags: [Course]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - thumbnail
 *             properties:
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Thumbnail uploaded successfully
 *       400:
 *         description: Invalid image or request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Course not found or not editable
 *       502:
 *         description: Storage upload failed
 */


router.post(
    "/:id/thumbnail",
    requirePermission("COURSE_UPDATE"),
    uploadThumbnail,
    courseController.uploadThumbnail
);


/**
 * GET /api/courses/categories
 * Static route MUST come before /:id
 */
router.get(
    "/categories",
    requirePermission("COURSE_VIEW"),
    courseController.getCategories
);

/**
 * GET /api/courses/:id
 * Keep this dynamic route AFTER static routes
 */
router.get(
    "/:id",
    requirePermission("COURSE_VIEW"),
    courseController.getCourse
);

module.exports = router;
