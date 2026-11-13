const express = require("express");

const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const controller = require("../controller/enrollmentAdmin.controller");

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Admin Enrollments
 *   description: Read-only enrollment management APIs
 */

/**
 * @swagger
 * /api/admin/enrollments:
 *   get:
 *     summary: List enrollments
 *     tags: [Admin Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: student_id
 *         schema: { type: string }
 *       - in: query
 *         name: course_id
 *         schema: { type: string }
 *       - in: query
 *         name: include_deleted
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Enrollments retrieved successfully
 */

/**
 * @swagger
 * /api/admin/enrollments/statuses:
 *   get:
 *     summary: List enrollment statuses
 *     tags: [Admin Enrollments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enrollment statuses retrieved successfully
 */

/**
 * @swagger
 * /api/admin/enrollments/{id}:
 *   get:
 *     summary: Get an enrollment by ID
 *     tags: [Admin Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Enrollment retrieved successfully
 *       404:
 *         description: Enrollment not found
 */

router.get(
    "/statuses",
    requireRoleOrPermission(["ADMIN"], "ENROLLMENT_VIEW"),
    controller.getStatusOptions
);

router.get(
    "/",
    requireRoleOrPermission(["ADMIN"], "ENROLLMENT_VIEW"),
    controller.getAllEnrollments
);
router.get(
    "/:id",
    requireRoleOrPermission(["ADMIN"], "ENROLLMENT_VIEW"),
    controller.getEnrollmentById
);

module.exports = router;
