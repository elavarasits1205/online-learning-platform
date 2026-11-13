
const express = require("express");

const adminController = require("../controller/admin.controller");

const { authenticate } = require("../middleware/auth.middleware");
const {
    requireRole,
    requireRoleOrPermission
} = require("../middleware/rbac.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin user management and instructor approval APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminRole:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "2"
 *         code:
 *           type: string
 *           example: INSTRUCTOR
 *         name:
 *           type: string
 *           example: Instructor
 *         description:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *           example: true
 *
 *     AdminUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "12"
 *         username:
 *           type: string
 *           example: john_doe
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         firstName:
 *           type: string
 *           example: John
 *         lastName:
 *           type: string
 *           nullable: true
 *           example: Doe
 *         phoneNumber:
 *           type: string
 *           nullable: true
 *           example: "9876543210"
 *         isActive:
 *           type: boolean
 *           example: true
 *         isLocked:
 *           type: boolean
 *           example: false
 *         emailVerifiedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         phoneVerifiedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         passwordChangedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         failedLoginAttempts:
 *           type: integer
 *           example: 0
 *         lockedUntil:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         softDelete:
 *           type: boolean
 *           example: false
 *         approvalStatus:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *           example: APPROVED
 *         approvedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         rejectionReason:
 *           type: string
 *           nullable: true
 *         roles:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AdminRole'
 *
 *     AdminUserUpdate:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - firstName
 *         - isActive
 *         - isLocked
 *       properties:
 *         username:
 *           type: string
 *           maxLength: 100
 *           example: john_doe
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           example: john@example.com
 *         firstName:
 *           type: string
 *           maxLength: 100
 *           example: John
 *         lastName:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: Doe
 *         phoneNumber:
 *           type: string
 *           nullable: true
 *           maxLength: 30
 *           example: "9876543210"
 *         isActive:
 *           type: boolean
 *           example: true
 *         isLocked:
 *           type: boolean
 *           example: false
 *         emailVerifiedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-10-15T10:00:00.000Z"
 *         phoneVerifiedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *
 *     RejectInstructorRequest:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           maxLength: 5000
 *           example: Required qualifications could not be verified
 *
 *     AdminSuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     description: Returns paginated users with user details and assigned roles.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search username, email, first name, last name or phone number.
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, STUDENT, INSTRUCTOR]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Users retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminUser'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Invalid pagination or filter values.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Admin role or USER_VIEW permission required.
 */
router.get(
    "/users",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_VIEW"),
    adminController.getUsers
);

/**
 * @swagger
 * /api/admin/users/pending:
 *   get:
 *     summary: Get pending instructor registrations
 *     description: Returns instructor accounts awaiting admin approval.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending instructors retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Admin role or USER_VIEW permission required.
 */
router.get(
    "/users/pending",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_VIEW"),
    adminController.getPendingUsers
);

/**
 * @swagger
 * /api/admin/users/{id}/approve:
 *   post:
 *     summary: Approve a pending instructor
 *     description: Approves a pending instructor and activates the account.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID as a positive integer string.
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "12"
 *     responses:
 *       200:
 *         description: Instructor approved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminSuccessResponse'
 *       400:
 *         description: Invalid user ID.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Admin role or USER_UPDATE permission required.
 *       404:
 *         description: Pending instructor not found or already processed.
 */
router.post(
    "/users/:id/approve",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_UPDATE"),
    adminController.approveUser
);

/**
 * @swagger
 * /api/admin/users/{id}/reject:
 *   post:
 *     summary: Reject a pending instructor
 *     description: Rejects a pending instructor and optionally records a reason.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "12"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RejectInstructorRequest'
 *     responses:
 *       200:
 *         description: Instructor rejected successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminSuccessResponse'
 *       400:
 *         description: Invalid user ID or rejection reason.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Admin role or USER_UPDATE permission required.
 *       404:
 *         description: Pending instructor not found or already processed.
 */
router.post(
    "/users/:id/reject",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_UPDATE"),
    adminController.rejectUser
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     description: Returns all exposed user fields and assigned roles.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "12"
 *     responses:
 *       200:
 *         description: User retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AdminUser'
 *       400:
 *         description: Invalid user ID.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Admin role or USER_VIEW permission required.
 *       404:
 *         description: User not found.
 */
router.get(
    "/users/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_VIEW"),
    adminController.getUserById
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update a user's profile and account flags
 *     description: Updates profile fields, activation and lock flags, and verification timestamps.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "12"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUserUpdate'
 *     responses:
 *       200:
 *         description: User updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminSuccessResponse'
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Admin role or USER_UPDATE permission required.
 *       404:
 *         description: User not found.
 *       409:
 *         description: Username or email already exists.
 */
router.put(
    "/users/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_UPDATE"),
    adminController.updateUser
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Soft-delete a user
 *     description: Marks the user as deleted and inactive without physically removing the database row. An administrator cannot delete their own account.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         example: "12"
 *     responses:
 *       200:
 *         description: User deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminSuccessResponse'
 *       400:
 *         description: Invalid user ID or attempt to delete own account.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Admin role or USER_DELETE permission required.
 *       404:
 *         description: User not found or already deleted.
 */
router.delete(
    "/users/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_DELETE"),
    adminController.deleteUser
);

module.exports = router;
