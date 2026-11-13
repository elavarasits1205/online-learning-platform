const express = require("express");
const controller = require("../controller/couponCourse.controller");
const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Coupon Courses
 *   description: Coupon to course mapping CRUD APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CouponCourseInput:
 *       type: object
 *       required:
 *         - coupon_id
 *         - course_id
 *       properties:
 *         coupon_id:
 *           type: string
 *           example: "1"
 *         course_id:
 *           type: string
 *           example: "3"
 *         is_active:
 *           type: boolean
 *           default: true
 *           example: true
 *
 *     CouponCourse:
 *       allOf:
 *         - $ref: '#/components/schemas/CouponCourseInput'
 *         - type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "10"
 *             coupon_code:
 *               type: string
 *               example: WELCOME10
 *             course_code:
 *               type: string
 *               example: WEB101
 *             course_title:
 *               type: string
 *               example: Web Development
 */

/**
 * @swagger
 * /api/coupon-courses/dropdowns:
 *   get:
 *     summary: Get coupons and courses for the coupon course form dropdowns
 *     tags: [Coupon Courses]
 *     responses:
 *       200:
 *         description: Dropdown data
 *
 * /api/coupon-courses:
 *   get:
 *     summary: Get coupon course mappings
 *     tags: [Coupon Courses]
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
 *         name: course_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Coupon courses retrieved successfully
 *   post:
 *     summary: Create a coupon course mapping
 *     tags: [Coupon Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponCourseInput'
 *     responses:
 *       201:
 *         description: Coupon course created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate mapping
 *
 * /api/coupon-courses/{id}:
 *   get:
 *     summary: Get a coupon course mapping by ID
 *     tags: [Coupon Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon course retrieved successfully
 *       404:
 *         description: Mapping not found
 *   put:
 *     summary: Update a coupon course mapping
 *     tags: [Coupon Courses]
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
 *             $ref: '#/components/schemas/CouponCourseInput'
 *     responses:
 *       200:
 *         description: Coupon course updated successfully
 *       404:
 *         description: Mapping not found
 *       409:
 *         description: Duplicate mapping
 *   delete:
 *     summary: Deactivate a coupon course mapping
 *     tags: [Coupon Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon course mapping deactivated; audit fields are retained
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
