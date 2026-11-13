
const express = require("express");
const router = express.Router();

const {
    authenticate,
    requireRole,
    requirePermission
} = require("../middleware/auth.middleware");

const instructorController =
    require("../controller/instructor.controller");
const { uploadProfileImage } = require("../middleware/upload.middleware");

router.use(authenticate);
router.use(requireRole("INSTRUCTOR"));

router.get(
    "/students",
    requirePermission("COURSE_VIEW"),
    instructorController.getMyStudents
);

router.get(
    "/reports/enrollments",
    requirePermission("COURSE_VIEW"),
    instructorController.getEnrollmentReport
);

/**
 * @swagger
 * tags:
 *   name: Instructor
 *   description: Instructor profile APIs
 */

/**
 * @swagger
 * /api/instructors/me:
 *   get:
 *     summary: Get my instructor profile
 *     tags: [Instructor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile including the instructor's read-only referral code, when available
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 *       404:
 *         description: Instructor profile not found
 */
router.get(
    "/me",
    requirePermission("PROFILE_VIEW"),
    instructorController.getMyProfile
);

/**
 * @swagger
 * /api/instructors/me:
 *   put:
 *     summary: Update my instructor profile
 *     tags: [Instructor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               specialization:
 *                 type: string
 *               qualification:
 *                 type: string
 *               experience_years:
 *                 type: integer
 *                 minimum: 0
 *               profile_image_url:
 *                 type: string
 *               bio:
 *                 type: string
 *               designation:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Role or permission denied
 *       404:
 *         description: Instructor profile not found
 */
router.put(
    "/me",
    requirePermission("PROFILE_UPDATE"),
    instructorController.updateMyProfile
);

router.post(
    "/me/profile-image",
    requirePermission("PROFILE_UPDATE"),
    uploadProfileImage,
    instructorController.uploadProfileImage
);

module.exports = router;
