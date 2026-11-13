const express = require("express");
const controller = require("../controller/coursecategory.controller");
const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Course Categories
 *   description: Course category CRUD APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CourseCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "1"
 *         code:
 *           type: string
 *           maxLength: 50
 *           example: PROGRAMMING
 *         name:
 *           type: string
 *           maxLength: 150
 *           example: Programming
 *         description:
 *           type: string
 *           nullable: true
 *           example: Programming courses
 *         parent_category_id:
 *           type: string
 *           nullable: true
 *           example: "2"
 *         display_order:
 *           type: integer
 *           example: 1
 *         is_active:
 *           type: boolean
 *           example: true
 *         soft_delete:
 *           type: boolean
 *           example: false
 *
 *     CourseCategoryInput:
 *       type: object
 *       required:
 *         - code
 *         - name
 *       properties:
 *         code:
 *           type: string
 *           maxLength: 50
 *           example: PROGRAMMING
 *         name:
 *           type: string
 *           maxLength: 150
 *           example: Programming
 *         description:
 *           type: string
 *           nullable: true
 *           example: Programming courses
 *         parent_category_id:
 *           type: string
 *           nullable: true
 *           example: "2"
 *         display_order:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *           example: 1
 *         is_active:
 *           type: boolean
 *           default: true
 *           example: true
 *
 *     CourseCategoryResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Course category retrieved successfully.
 *         data:
 *           $ref: '#/components/schemas/CourseCategory'
 *
 *     CourseCategoryListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Course categories retrieved successfully.
 *         count:
 *           type: integer
 *           example: 2
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CourseCategory'
 *
 *     CourseCategoryError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Course category not found.
 */

/**
 * @swagger
 * /api/course-categories:
 *   get:
 *     summary: Get all course categories
 *     tags: [Course Categories]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseCategoryListResponse'
 *       500:
 *         description: Internal server error
 */
router.get("/", controller.getAll);

/**
 * @swagger
 * /api/course-categories/{id}:
 *   get:
 *     summary: Get a course category by ID
 *     tags: [Course Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "1"
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseCategoryResponse'
 *       400:
 *         description: Invalid category ID
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", controller.getById);

/**
 * @swagger
 * /api/course-categories:
 *   post:
 *     summary: Create a course category
 *     tags: [Course Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseCategoryInput'
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseCategoryResponse'
 *       400:
 *         description: Invalid category data
 *       409:
 *         description: Category code or name already exists
 *       500:
 *         description: Internal server error
 */
router.post(
    "/",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COURSE_CATEGORY_CREATE"),
    controller.create
);

/**
 * @swagger
 * /api/course-categories/{id}:
 *   put:
 *     summary: Update a course category
 *     tags: [Course Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseCategoryInput'
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseCategoryResponse'
 *       400:
 *         description: Invalid category data or ID
 *       404:
 *         description: Category not found
 *       409:
 *         description: Category code or name already exists
 *       500:
 *         description: Internal server error
 */
router.put(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COURSE_CATEGORY_UPDATE"),
    controller.update
);

/**
 * @swagger
 * /api/course-categories/{id}:
 *   delete:
 *     summary: Soft-delete a course category
 *     description: Sets soft_delete to true without physically deleting the row.
 *     tags: [Course Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "1"
 *     responses:
 *       200:
 *         description: Category soft-deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseCategoryResponse'
 *       400:
 *         description: Invalid category ID
 *       404:
 *         description: Category not found
 *       409:
 *         description: Category has active child categories or is referenced
 *       500:
 *         description: Internal server error
 */
router.delete(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "COURSE_CATEGORY_DELETE"),
    controller.remove
);

module.exports = router;
