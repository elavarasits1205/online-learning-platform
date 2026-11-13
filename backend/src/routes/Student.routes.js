
const express = require("express");

const {
    authenticate,
    requireRole,
    requirePermission
} = require("../middleware/auth.middleware");

const enrollmentController =
    require("../controller/enrollment.controller");

const studentProfileController =
    require("../controller/studentProfile.controller");
const notificationPreferenceController =
    require("../controller/notificationPreference.controller");
const accountPreferenceController =
    require("../controller/accountPreference.controller");
const studentAssessmentController =
    require("../controller/studentAssessment.controller");

const learningCourseController =
    require("../controller/learningCourse.controller");

const lessonProgressController =
    require("../controller/lessonProgress.controller");

const { uploadProfileImage } =
    require("../middleware/upload.middleware");

const cartController =
    require("../controller/cart.controller");
const courseReviewController =
    require("../controller/courseReview.controller");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Student Enrollments
 *   description: Student course enrollment APIs
 */

/**
 * @swagger
 * /api/student/enrollments:
 *   get:
 *     summary: Get the logged-in student's enrollments
 *     tags:
 *       - Student Enrollments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enrollments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student access required
 */
router.get(
    "/enrollments",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("ENROLLMENT_VIEW"),
    enrollmentController.getMyEnrollments
);

/**
 * @swagger
 * /api/student/enrollments:
 *   post:
 *     summary: Enroll the student in a free course
 *     description: Paid courses require payment first.
 *     tags:
 *       - Student Enrollments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - course_id
 *             properties:
 *               course_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Enrollment completed
 *       200:
 *         description: Already enrolled
 *       400:
 *         description: Invalid course ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student access required
 *       404:
 *         description: Course not found
 *       409:
 *         description: Payment required or enrollment limit reached
 */
router.post(
    "/enrollments",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("ENROLLMENT_CREATE"),
    enrollmentController.enrollInCourse
);

/**
 * @swagger
 * /api/student/enrollments/{enrollmentId}:
 *   delete:
 *     summary: Remove a course from My Learning
 *     tags:
 *       - Student Enrollments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Course removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student access required
 *       404:
 *         description: Enrollment not found
 */
router.delete(
    "/enrollments/:enrollmentId",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("ENROLLMENT_DELETE"),
    enrollmentController.removeMyEnrollment
);

/**
 * @swagger
 * /api/student/profile:
 *   get:
 *     summary: Get the logged-in student's profile
 *     tags:
 *       - Student Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student profile retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student access required
 *       404:
 *         description: Student profile not found
 */
router.get(
    "/profile",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("PROFILE_VIEW"),
    studentProfileController.getMyProfile
);

router.get(
    "/notification-preferences",
    authenticate,
    requireRole("STUDENT"),
    notificationPreferenceController.getMyPreferences
);

router.patch(
    "/notification-preferences",
    authenticate,
    requireRole("STUDENT"),
    notificationPreferenceController.updateMyPreferences
);

router.get(
    "/account-preferences",
    authenticate,
    requireRole("STUDENT"),
    accountPreferenceController.getMyPreferences
);

router.patch(
    "/account-preferences",
    authenticate,
    requireRole("STUDENT"),
    accountPreferenceController.updateMyPreferences
);

router.post(
    "/profile/image",
    authenticate,
    requireRole("STUDENT"),
    uploadProfileImage,
    studentProfileController.uploadMyProfileImage
);

// ========================================
// STUDENT CART ROUTES
// ========================================

router.post(
    "/cart/items",
    authenticate,
    requireRole("STUDENT"),
    cartController.addToCart
);

router.get(
    "/cart",
    authenticate,
    requireRole("STUDENT"),
    cartController.getMyCart
);

router.delete(
    "/cart/items/:courseId",
    authenticate,
    requireRole("STUDENT"),
    cartController.removeFromCart
);

router.post(
    "/courses/:courseId/reviews",
    authenticate,
    requireRole("STUDENT"),
    courseReviewController.saveCourseReview
);

/**
 * @swagger
 * /api/student/profile:
 *   patch:
 *     summary: Update the logged-in student's profile
 *     tags:
 *       - Student Profile
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
 *               phoneNumber:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum:
 *                   - MALE
 *                   - FEMALE
 *                   - OTHER
 *                   - PREFER_NOT_TO_SAY
 *               profileImageUrl:
 *                 type: string
 *               addressLine1:
 *                 type: string
 *               addressLine2:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               country:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Student profile updated
 *       400:
 *         description: Invalid profile data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student access required
 *       404:
 *         description: Student profile not found
 */
router.patch(
    "/profile",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("PROFILE_UPDATE"),
    studentProfileController.updateMyProfile
);

/**
 * @swagger
 * /api/student/assessments:
 *   get:
 *     summary: Get available assessments for logged-in student
 *     description: Retrieves all published assessments belonging to courses in which the student is enrolled.
 *     tags:
 *       - Student Assessments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available assessments retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Student role required
 *       500:
 *         description: Internal server error
 */
router.get(
    "/assessments",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("EXAM_ATTEMPT"),
    studentAssessmentController.getAvailableAssessments
);
/**
 * @swagger
 * /api/student/assessments/{assessmentId}:
 *   get:
 *     summary: Get assessment details for a student
 *     description: Retrieves assessment questions and options for an enrolled student.
 *     tags:
 *       - Student Assessments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assessment ID
 *     responses:
 *       200:
 *         description: Assessment details retrieved successfully
 *       400:
 *         description: Invalid assessment ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student role required
 *       404:
 *         description: Assessment not found or not available
 */
router.get(
    "/assessments/:assessmentId",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("EXAM_ATTEMPT"),
    studentAssessmentController.getAssessmentDetails
);
/**
 * @swagger
 * /api/student/assessments/{assessmentId}/start:
 *   post:
 *     summary: Start or resume an assessment
 *     description: Creates a new attempt or resumes an existing in-progress attempt.
 *     tags:
 *       - Student Assessments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assessment ID
 *     responses:
 *       201:
 *         description: Assessment started successfully
 *       200:
 *         description: Existing assessment attempt resumed
 *       400:
 *         description: Invalid assessment ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student role required
 *       404:
 *         description: Assessment not found or not available
 *       409:
 *         description: Maximum attempts reached or no active questions
 */
router.post(
    "/assessments/:assessmentId/start",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("EXAM_ATTEMPT"),
    studentAssessmentController.startAssessment
);
/**
 * @swagger
 * /api/student/assessments/attempts/{attemptId}/answers:
 *   post:
 *     summary: Save or update a student's assessment answer
 *     tags:
 *       - Student Assessments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assessment attempt ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question_id
 *             properties:
 *               question_id:
 *                 type: integer
 *               selected_option_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               answer_text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Assessment answer saved successfully
 *       400:
 *         description: Invalid answer data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student role required
 *       404:
 *         description: Attempt or question not found
 *       409:
 *         description: Attempt expired or not in progress
 */
router.post(
    "/assessments/attempts/:attemptId/answers",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("EXAM_ATTEMPT"),
    studentAssessmentController.saveAssessmentAnswer
);
/**
 * @swagger
 * /api/student/assessments/attempts/{attemptId}/submit:
 *   post:
 *     summary: Submit and evaluate student assessment
 *     description: Submits an in-progress attempt and automatically evaluates objective questions.
 *     tags:
 *       - Student Assessments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assessment attempt ID
 *     responses:
 *       200:
 *         description: Assessment submitted and evaluated successfully
 *       400:
 *         description: Invalid attempt ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student role required
 *       404:
 *         description: Assessment attempt not found
 *       409:
 *         description: Attempt not active or manual evaluation required
 */
router.post(
    "/assessments/attempts/:attemptId/submit",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("EXAM_ATTEMPT"),
    studentAssessmentController.submitAssessment
);
/**
 * @swagger
 * /api/student/assessments/attempts/{attemptId}:
 *   get:
 *     summary: Get an assessment attempt with saved answers
 *     description: Returns the in-progress attempt, questions and the student's saved answers.
 *     tags:
 *       - Student Assessments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Assessment attempt retrieved successfully
 *       400:
 *         description: Invalid attempt ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student role required
 *       404:
 *         description: Assessment attempt not found
 */
router.get(
    "/assessments/attempts/:attemptId",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("EXAM_ATTEMPT"),
    studentAssessmentController.getAttemptDetails
);
/**
 * @swagger
 * /api/student/assessments/attempts/{attemptId}/result:
 *   get:
 *     summary: Get student's assessment result
 *     description: Retrieves the evaluated result of the logged-in student's assessment attempt.
 *     tags:
 *       - Student Assessments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assessment attempt ID
 *     responses:
 *       200:
 *         description: Assessment result retrieved successfully
 *       400:
 *         description: Invalid attempt ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student role required
 *       404:
 *         description: Assessment result not found
 *       409:
 *         description: Assessment result is not available yet
 */
router.get(
    "/assessments/attempts/:attemptId/result",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("RESULT_VIEW"),
    studentAssessmentController.getAssessmentResult
);


// ========================================
// STUDENT COURSE LEARNING ROUTES
// ========================================

router.get(
    "/learning/activity",
    authenticate,
    requireRole("STUDENT"),
    learningCourseController.getLearningActivity
);

// Get course learning content for an enrolled student.
router.get(
    "/learning/courses/:courseId",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("ENROLLMENT_VIEW"),
    learningCourseController.getEnrolledCourseLearningContent
);

// Save playback progress for an enrolled student's lesson.
// The service scopes the write to the authenticated student's active enrollment
// and verifies that the lesson belongs to the requested course.
router.post(
    "/learning/courses/:courseId/lessons/:lessonId/progress",
    authenticate,
    requireRole("STUDENT"),
    lessonProgressController.updateLessonProgress
);

// Mark an enrolled student's lesson as completed.
router.post(
    "/learning/courses/:courseId/lessons/:lessonId/complete",
    authenticate,
    requireRole("STUDENT"),
    lessonProgressController.markLessonComplete
);
module.exports = router;
