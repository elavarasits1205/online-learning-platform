const express = require("express");

const authController =
    require("../controller/auth.controller");

const authMiddleware =
    require("../middleware/auth.middleware");

const passwordResetController =
    require("../controller/passwordReset.controller");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Authentication, registration, password reset and JWT APIs
 */


/* =========================================================
   STUDENT REGISTRATION
========================================================= */

/**
 * @swagger
 * /api/auth/register/student:
 *   post:
 *     summary: Register a student
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - email
 *               - username
 *               - password
 *               - confirmPassword
 *               - institutionId
 *               - registerNumber
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               phoneNumber:
 *                 type: string
 *                 example: "9876543210"
 *               institutionId:
 *                 type: string
 *                 description: ID of the selected active institution
 *                 example: "1"
 *               registerNumber:
 *                 type: string
 *                 description: Student's institution register number
 *                 example: "21CS001"
 *               username:
 *                 type: string
 *                 example: john123
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password@123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: Password@123
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "2002-05-15"
 *               gender:
 *                 type: string
 *                 enum:
 *                   - MALE
 *                   - FEMALE
 *                   - OTHER
 *                   - PREFER_NOT_TO_SAY
 *                 example: MALE
 *     responses:
 *       201:
 *         description: Student registered successfully
 *       400:
 *         description: Validation error or invalid instructor referral code
 *       409:
 *         description: Username, email or register number already exists
 *       500:
 *         description: Internal server error
 */
router.post(
    "/register/student",
    authController.registerStudent
);


/* =========================================================
   INSTRUCTOR REGISTRATION
========================================================= */

/**
 * @swagger
 * /api/auth/register/instructor:
 *   post:
 *     summary: Register an instructor
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - email
 *               - username
 *               - password
 *               - confirmPassword
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               phoneNumber:
 *                 type: string
 *                 example: "9876543210"
 *               username:
 *                 type: string
 *                 example: john_instructor
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password@123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: Password@123
 *               qualification:
 *                 type: string
 *                 example: M.Tech Computer Science
 *               specialization:
 *                 type: string
 *                 example: Full Stack Development
 *               experienceYears:
 *                 type: number
 *                 example: 5
 *               designation:
 *                 type: string
 *                 example: Senior Developer
 *               bio:
 *                 type: string
 *                 example: Full stack developer and instructor
 *     responses:
 *       201:
 *         description: Instructor registered and waiting for admin approval
 *       400:
 *         description: Validation error
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Internal server error
 */
router.post(
    "/register/instructor",
    authController.registerInstructor
);


/* =========================================================
   LOGIN
========================================================= */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login using username/email and password
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: john123
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password@123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Authentication failed
 *       403:
 *         description: Account pending, rejected or disabled
 *       500:
 *         description: Internal server error
 */
router.post(
    "/login",
    authController.login
);


/* =========================================================
   FORGOT PASSWORD
========================================================= */

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset
 *     description: >
 *       Sends a password reset link and a 6-digit OTP to the registered
 *       email address. For security, the same generic response is returned
 *       whether or not the email exists.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@example.com
 *     responses:
 *       202:
 *         description: Password reset request accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: If an account exists for that email, a password reset link and code have been sent.
 *                 deliveryMode:
 *                   type: string
 *                   enum:
 *                     - email
 *                     - development
 *                   example: email
 *       400:
 *         description: Invalid email address
 *       503:
 *         description: Password reset email service is unavailable
 */
router.post(
    "/forgot-password",
    passwordResetController.requestPasswordReset
);


/* =========================================================
   VERIFY RESET OTP
========================================================= */

/**
 * @swagger
 * /api/auth/reset-password/verify-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     description: >
 *       Verifies the 6-digit OTP together with the reset link token.
 *       If valid, a temporary reset ticket is returned and can be used
 *       to set the new password.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@example.com
 *               token:
 *                 type: string
 *                 description: 64-character reset link token
 *                 example: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
 *               otp:
 *                 type: string
 *                 description: 6-digit one-time verification code
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reset_ticket:
 *                       type: string
 *                       description: Temporary ticket required to reset the password
 *       400:
 *         description: Invalid or expired reset link or OTP
 */
router.post(
    "/reset-password/verify-otp",
    passwordResetController.verifyResetOtp
);


/* =========================================================
   RESET PASSWORD
========================================================= */

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using a verified reset ticket
 *     description: >
 *       Sets a new password after successful OTP verification.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - resetTicket
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@example.com
 *               resetTicket:
 *                 type: string
 *                 description: Temporary ticket returned after OTP verification
 *                 example: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: New password must be at least 8 characters and no more than 72 bytes
 *                 example: NewPassword@123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Your password has been reset. Sign in with your new password.
 *       400:
 *         description: Invalid reset ticket, expired session or invalid password
 */
router.post(
    "/reset-password",
    passwordResetController.resetPassword
);


/* =========================================================
   REFRESH TOKEN
========================================================= */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Generate a new access token using the refresh-token cookie
 *     description: >
 *       Reads the HttpOnly refresh-token cookie and rotates both the
 *       access-token and refresh-token cookies. No request body is required.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Access token refreshed
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post(
    "/refresh",
    authController.refresh
);


/* =========================================================
   LOGOUT
========================================================= */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout, revoke the refresh token and clear auth cookies
 *     description: >
 *       Reads the HttpOnly refresh-token cookie, revokes it in the database
 *       and clears both auth cookies. No request body is required.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Logout successful
 *       400:
 *         description: Refresh token is required
 */
router.post(
    "/logout",
    authController.logout
);

router.post(
    "/change-password",
    authMiddleware.authenticate,
    authController.changePassword
);

router.post(
    "/logout-all",
    authMiddleware.authenticate,
    authController.logoutAll
);


/* =========================================================
   CURRENT USER
========================================================= */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get currently authenticated user
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current authenticated user
 *       401:
 *         description: Missing or invalid JWT
 */
router.get(
    "/me",
    authMiddleware.authenticate,
    authController.me
);

/**
 * @swagger
 * /api/auth/me:
 *   patch:
 *     summary: Update the authenticated user's name and username
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid profile fields
 *       401:
 *         description: Missing or invalid JWT
 *       409:
 *         description: Username already registered
 */
router.patch(
    "/me",
    authMiddleware.authenticate,
    authController.updateMe
);

module.exports = router;
