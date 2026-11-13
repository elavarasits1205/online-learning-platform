const express = require("express");

const {
    authenticate,
    requireRole
} = require("../middleware/auth.middleware");

const controller = require("../controller/adminDashboard.controller");

const router = express.Router();

router.use(authenticate, requireRole("ADMIN"));

/**
 * @swagger
 * tags:
 *   name: Admin Dashboard
 *   description: Summary metrics and widgets for the administrator dashboard
 */

/**
 * @swagger
 * /api/admin/dashboard/summary:
 *   get:
 *     summary: Get administrator dashboard summary cards
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary retrieved successfully.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Admin role required.
 */
router.get("/summary", controller.getSummary);

/**
 * @swagger
 * /api/admin/dashboard/widgets:
 *   get:
 *     summary: Get administrator dashboard charts and action lists
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard widgets retrieved successfully.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Admin role required.
 */
router.get("/widgets", controller.getWidgets);

module.exports = router;
