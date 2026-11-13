const express = require("express");

const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const controller = require("../controller/adminReport.controller");

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Admin Reports
 *   description: Admin payroll, enrollment and user reports
 */

/**
 * @swagger
 * /api/admin/reports/payroll:
 *   get:
 *     summary: Get the payroll report
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: periodId
 *         schema: { type: string }
 *       - in: query
 *         name: instructorId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payroll report retrieved successfully.
 *       400:
 *         description: Invalid filters or pagination.
 *       403:
 *         description: Admin role required.
 */

/**
 * @swagger
 * /api/admin/reports/enrollments:
 *   get:
 *     summary: Get the enrollment report
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: courseId
 *         schema: { type: string }
 *       - in: query
 *         name: institutionId
 *         schema: { type: string }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Enrollment report retrieved successfully.
 *       400:
 *         description: Invalid filters or date range.
 *       403:
 *         description: Admin role required.
 */

/**
 * @swagger
 * /api/admin/reports/users:
 *   get:
 *     summary: Get the user report
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [ADMIN, INSTRUCTOR, STUDENT] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: isLocked
 *         schema: { type: boolean }
 *       - in: query
 *         name: approvalStatus
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *     responses:
 *       200:
 *         description: User report retrieved successfully.
 *       400:
 *         description: Invalid filters or pagination.
 *       403:
 *         description: Admin role required.
 */

router.get(
    "/payroll",
    requireRoleOrPermission(["ADMIN"], "PAYROLL_REPORT_VIEW"),
    controller.getPayrollReport
);
router.get(
    "/enrollments",
    requireRoleOrPermission(["ADMIN"], "ENROLLMENT_REPORT_VIEW"),
    controller.getEnrollmentReport
);
router.get(
    "/users",
    requireRoleOrPermission(["ADMIN"], "USER_REPORT_VIEW"),
    controller.getUserReport
);

module.exports = router;
