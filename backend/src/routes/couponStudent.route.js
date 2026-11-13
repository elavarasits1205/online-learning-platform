const express = require("express");
const controller = require("../controller/couponStudent.controller");
const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Coupon Students
 *   description: Coupon to student mapping CRUD APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CouponStudentInput:
 *       type: object
 *       required:
 *         - coupon_id
 *         - student_id
 *       properties:
 *         coupon_id:
 *           type: string
 *           example: "1"
 *         student_id:
 *           type: string
 *           example: "2"
 *
 *     CouponStudent:
 *       allOf:
 *         - $ref: '#/components/schemas/CouponStudentInput'
 *         - type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "10"
 *             coupon_code:
 *               type: string
 *               example: WELCOME10
 *             student_name:
 *               type: string
 *               example: Jane Doe
 *             register_number:
 *               type: string
 *               example: REG-2026-001
 *             register_number_snapshot:
 *               type: string
 *               example: REG-2026-001
 *             institution_name:
 *               type: string
 *               example: Learnova Institute
 */

/**
 * @swagger
 * /api/coupon-students/dropdowns:
 *   get:
 *     summary: Get coupons and students for the coupon student form dropdowns
 *     tags: [Coupon Students]
 *     responses:
 *       200:
 *         description: Dropdown data
 *
 * /api/coupon-students:
 *   get:
 *     summary: Get coupon student mappings
 *     tags: [Coupon Students]
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
 *         name: include_deleted
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Coupon students retrieved successfully
 *   post:
 *     summary: Create a coupon student mapping
 *     tags: [Coupon Students]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponStudentInput'
 *     responses:
 *       201:
 *         description: Coupon student created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate mapping
 *
 * /api/coupon-students/{id}:
 *   get:
 *     summary: Get a coupon student mapping by ID
 *     tags: [Coupon Students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon student retrieved successfully
 *       404:
 *         description: Mapping not found
 *   put:
 *     summary: Update a coupon student mapping
 *     tags: [Coupon Students]
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
 *             $ref: '#/components/schemas/CouponStudentInput'
 *     responses:
 *       200:
 *         description: Coupon student updated successfully
 *       404:
 *         description: Mapping not found
 *       409:
 *         description: Duplicate mapping
 *   delete:
 *     summary: Soft-delete a coupon student mapping
 *     tags: [Coupon Students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon student soft-deleted successfully
 *       404:
 *         description: Mapping not found
 */

router.get(
    "/dropdowns",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COUPON_VIEW", "COUPON_CREATE"),
    controller.getDropdowns
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
