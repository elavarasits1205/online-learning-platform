
const express = require("express");
const controller = require("../controller/admin-course.controller");

const {
    authenticate,
    requireRole,
    requirePermission,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Admin Courses
 *     description: Course listing and approval workflow
 */

/**
 * @swagger
 * /api/admin/courses:
 *   get:
 *     summary: List all non-deleted courses
 *     tags: [Admin Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Courses retrieved successfully
 */
router.get(
    "/",
    requireRoleOrPermission(["ADMIN"], "COURSE_VIEW"),
    controller.listCourses
);

/**
 * @swagger
 * /api/admin/courses/pending:
 *   get:
 *     summary: List courses awaiting admin approval
 *     tags: [Admin Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending courses retrieved successfully
 */
router.get(
    "/pending",
    requireRoleOrPermission(["ADMIN"], "PENDING_COURSE_VIEW"),
    controller.listPending
);

/**
 * @swagger
 * /api/admin/courses/{id}/submit:
 *   post:
 *     summary: Submit an instructor's draft course for approval
 *     tags: [Admin Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course submitted and marked PENDING
 *       409:
 *         description: Course is not eligible for submission
 */
router.post(
    "/:id/submit",
    requireRole("INSTRUCTOR"),
    requirePermission("COURSE_UPDATE"),
    controller.submitForApproval
);

/**
 * @swagger
 * /api/admin/courses/{id}/review:
 *   get:
 *     summary: Get pending course details, modules and lessons
 *     tags: [Admin Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course review details retrieved
 *       404:
 *         description: Course not found
 *       409:
 *         description: Course is not pending approval
 */
router.get(
    "/:id/review",
    requireRoleOrPermission(["ADMIN"], "COURSE_APPROVE"),
    controller.getReviewBundle
);

/**
 * @swagger
 * /api/admin/courses/{id}/approve:
 *   post:
 *     summary: Approve and automatically publish a pending course
 *     tags: [Admin Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course published with APPROVED status
 *       404:
 *         description: Course not found
 *       409:
 *         description: Course is not pending approval
 */
router.post(
    "/:id/approve",
    requireRoleOrPermission(["ADMIN"], "COURSE_APPROVE"),
    controller.approve
);

/**
 * @swagger
 * /api/admin/courses/{id}/reject:
 *   post:
 *     summary: Reject a pending course
 *     tags: [Admin Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 5000
 *     responses:
 *       200:
 *         description: Course rejected successfully
 *       400:
 *         description: Rejection reason is required
 *       409:
 *         description: Course is not pending approval
 */
router.post(
    "/:id/reject",
    requireRoleOrPermission(["ADMIN"], "COURSE_APPROVE"),
    controller.reject
);

module.exports = router;
