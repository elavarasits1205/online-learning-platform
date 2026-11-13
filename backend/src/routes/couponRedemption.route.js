const express = require("express");
const controller = require("../controller/couponRedemption.controller");
const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Coupon Redemptions
 *   description: Read-only coupon redemption history APIs
 */

/**
 * @swagger
 * /api/coupon-redemptions/dropdowns:
 *   get:
 *     summary: Get coupons and students for redemption filters
 *     tags: [Coupon Redemptions]
 *     responses:
 *       200:
 *         description: Dropdown data
 *
 * /api/coupon-redemptions:
 *   get:
 *     summary: Get coupon redemption history
 *     tags: [Coupon Redemptions]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: coupon_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: student_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: payment_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [RESERVED, REDEEMED, CANCELLED]
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: include_deleted
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Coupon redemptions retrieved successfully
 *
 * /api/coupon-redemptions/{id}:
 *   get:
 *     summary: Get a coupon redemption by ID
 *     tags: [Coupon Redemptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon redemption retrieved successfully
 *       404:
 *         description: Redemption not found
 */

router.get(
    "/dropdowns",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_VIEW"),
    controller.getDropdowns
);

router.get(
    "/",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_VIEW"),
    controller.getAll
);
router.get(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_VIEW"),
    controller.getById
);

module.exports = router;
