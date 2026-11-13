const express = require("express");
const controller = require("../controller/coupon.controller");
const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     InstitutionDropdownItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "1"
 *         institution_name:
 *           type: string
 *           example: "Learnova Institute"
 *
 *     CouponInput:
 *       type: object
 *       required:
 *         - institution_id
 *         - institution_name
 *         - coupon_code
 *         - discount_type
 *         - discount_value
 *         - valid_from
 *         - valid_until
 *       properties:
 *         institution_id:
 *           type: string
 *           description: PostgreSQL BIGINT institution ID, represented as a string.
 *           example: "1"
 *         institution_name:
 *           type: string
 *           description: Must match the institution identified by institution_id.
 *           example: "Learnova Institute"
 *         coupon_code:
 *           type: string
 *           maxLength: 50
 *           example: "WELCOME10"
 *         description:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: "Welcome discount"
 *         discount_type:
 *           type: string
 *           enum: [PERCENTAGE, FIXED]
 *           example: PERCENTAGE
 *         discount_value:
 *           type: number
 *           minimum: 0
 *           example: 10
 *         minimum_amount:
 *           type: number
 *           minimum: 0
 *           default: 0
 *           example: 500
 *         maximum_discount_amount:
 *           type: number
 *           nullable: true
 *           minimum: 0
 *           example: 200
 *         valid_from:
 *           type: string
 *           format: date-time
 *           example: "2026-10-23T00:00:00.000Z"
 *         valid_until:
 *           type: string
 *           format: date-time
 *           example: "2026-12-31T23:59:59.000Z"
 *         usage_limit:
 *           type: integer
 *           nullable: true
 *           minimum: 1
 *           example: 100
 *         used_count:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *           example: 0
 *         is_active:
 *           type: boolean
 *           default: true
 *           example: true
 *
 *     CouponUpdate:
 *       type: object
 *       description: Partial update. When changing institution, send both institution_id and institution_name.
 *       properties:
 *         institution_id:
 *           type: string
 *           example: "1"
 *         institution_name:
 *           type: string
 *           example: "Learnova Institute"
 *         coupon_code:
 *           type: string
 *           maxLength: 50
 *         description:
 *           type: string
 *           nullable: true
 *         discount_type:
 *           type: string
 *           enum: [PERCENTAGE, FIXED]
 *         discount_value:
 *           type: number
 *           minimum: 0
 *         minimum_amount:
 *           type: number
 *           minimum: 0
 *         maximum_discount_amount:
 *           type: number
 *           nullable: true
 *         valid_from:
 *           type: string
 *           format: date-time
 *         valid_until:
 *           type: string
 *           format: date-time
 *         usage_limit:
 *           type: integer
 *           nullable: true
 *         used_count:
 *           type: integer
 *           minimum: 0
 *         is_active:
 *           type: boolean
 *
 *     Coupon:
 *       allOf:
 *         - $ref: '#/components/schemas/CouponInput'
 *         - type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "10"
 *             soft_delete:
 *               type: boolean
 *               example: false
 *
 * /api/coupons/institutions:
 *   get:
 *     summary: Get active institutions for the coupon form dropdown
 *     tags: [Coupons]
 *     responses:
 *       200:
 *         description: Institution dropdown data
 *
 * /api/coupons:
 *   get:
 *     summary: Get coupons
 *     tags: [Coupons]
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
 *         name: institution_id
 *         schema:
 *           type: string
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
 *         description: Coupons retrieved successfully
 *
 *   post:
 *     summary: Create a coupon
 *     tags: [Coupons]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponInput'
 *     responses:
 *       201:
 *         description: Coupon created successfully
 *       400:
 *         description: Validation error or institution mismatch
 *       409:
 *         description: Duplicate coupon code
 *
 * /api/coupons/{id}:
 *   get:
 *     summary: Get a coupon by ID
 *     tags: [Coupons]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon retrieved successfully
 *       404:
 *         description: Coupon not found
 *
 *   put:
 *     summary: Update a coupon
 *     tags: [Coupons]
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
 *             $ref: '#/components/schemas/CouponUpdate'
 *     responses:
 *       200:
 *         description: Coupon updated successfully
 *       400:
 *         description: Validation error or institution mismatch
 *       404:
 *         description: Coupon not found
 *       409:
 *         description: Duplicate coupon code
 *
 *   delete:
 *     summary: Soft-delete a coupon
 *     tags: [Coupons]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon soft-deleted successfully
 *       404:
 *         description: Coupon not found
 */

// Register this before "/:id".
router.get(
    "/institutions",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_VIEW", "COUPON_CREATE"),
    controller.getInstitutionDropdown
);

router.get(
    "/",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_VIEW"),
    controller.getAll
);
router.post(
    "/",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_CREATE"),
    controller.create
);

router.get(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_VIEW"),
    controller.getById
);
router.put(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_UPDATE"),
    controller.update
);
router.delete(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_DELETE"),
    controller.remove
);

module.exports = router;
