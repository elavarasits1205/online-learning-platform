const express = require("express");
const {
    authenticate,
    requireRole,
    requirePermission,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");
const assessmentController = require("../controller/instructorAssessment.controller");
const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Instructor Assessments
 *   description: Instructor assessment management
 */
/**
 * @swagger
 * /api/instructor/assessments:
 *   get:
 *     summary: Get assessments assigned to the logged-in instructor
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assessments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role required
 */
router.get(
    "/assessments",
    authenticate,
    requireRole("INSTRUCTOR"),
    requireRoleOrPermission(
        [],
        "EXAM_VIEW",
        "EXAM_CREATE",
        "EXAM_UPDATE",
        "EXAM_DELETE",
        "RESULT_VIEW",
        "RESULT_CREATE",
        "RESULT_UPDATE",
        "RESULT_DELETE"
    ),
    assessmentController.listAssessments
);

/**
 * @swagger
 * /api/instructor/assessments:
 *   post:
 *     summary: Create an assessment
 *     tags: [Instructor Assessments]
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
 *               - title
 *               - assessment_type
 *             properties:
 *               course_id:
 *                 type: integer
 *                 example: 1
 *               module_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 1
 *               title:
 *                 type: string
 *                 example: Module 1 Quiz
 *               description:
 *                 type: string
 *                 example: Test your understanding
 *               assessment_type:
 *                 type: string
 *                 enum: [MODULE, COURSE]
 *                 example: MODULE
 *               instructions:
 *                 type: string
 *                 example: Choose the correct answer
 *               duration_minutes:
 *                 type: integer
 *                 nullable: true
 *                 example: 20
 *               pass_percentage:
 *                 type: number
 *                 example: 40
 *               max_attempts:
 *                 type: integer
 *                 nullable: true
 *                 example: 3
 *               status:
 *                 type: string
 *                 example: DRAFT
 *     responses:
 *       201:
 *         description: Assessment created successfully
 *       400:
 *         description: Invalid assessment data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role or course access denied
 */
router.post(
    "/assessments",
    authenticate,
    requireRole("INSTRUCTOR"),
    requirePermission("EXAM_CREATE"),
    assessmentController.createAssessment
);
/**
 * @swagger
 * /api/instructor/questions:
 *   post:
 *     summary: Create a question for the instructor question bank
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question_text
 *               - question_type
 *             properties:
 *               question_text:
 *                 type: string
 *                 example: What is React?
 *               question_type:
 *                 type: string
 *                 example: SINGLE_CHOICE
 *               explanation:
 *                 type: string
 *                 example: React is a JavaScript library for building user interfaces.
 *               default_marks:
 *                 type: number
 *                 example: 2
 *               negative_marks:
 *                 type: number
 *                 example: 0
 *               difficulty_level:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *                 example: EASY
 *     responses:
 *       201:
 *         description: Question created successfully
 *       400:
 *         description: Invalid question data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role required
 */
router.post(
    "/questions",
    authenticate,
    requireRole("INSTRUCTOR"),
    requirePermission("QUESTION_CREATE"),
    assessmentController.createQuestion
);
/**
 * @swagger
 * /api/instructor/questions/{questionId}:
 *   put:
 *     summary: Update an instructor question
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question_text:
 *                 type: string
 *                 example: What is React used for?
 *               explanation:
 *                 type: string
 *                 nullable: true
 *                 example: React is used to build user interfaces.
 *               default_marks:
 *                 type: number
 *                 example: 3
 *               negative_marks:
 *                 type: number
 *                 example: 0
 *               difficulty_level:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *                 example: MEDIUM
 *     responses:
 *       200:
 *         description: Question updated successfully
 *       400:
 *         description: Invalid question data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role required
 *       404:
 *         description: Question not found or access denied
 */
router.put(
    "/questions/:questionId",
    authenticate,
    requireRole("INSTRUCTOR"),
    requirePermission("QUESTION_UPDATE"),
    assessmentController.updateQuestion
);

/**
 * @swagger
 * /api/instructor/questions/{questionId}/options:
 *   post:
 *     summary: Add options to an instructor's question
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - options
 *             properties:
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - option_code
 *                     - option_text
 *                     - is_correct
 *                   properties:
 *                     option_code:
 *                       type: string
 *                     option_text:
 *                       type: string
 *                     display_order:
 *                       type: integer
 *                     is_correct:
 *                       type: boolean
 *                     explanation:
 *                       type: string
 *     responses:
 *       201:
 *         description: Question options created successfully
 *       400:
 *         description: Invalid options
 *       403:
 *         description: Instructor access denied
 *       404:
 *         description: Question not found
 */
router.post(
    "/questions/:questionId/options",
    authenticate,
    requireRole("INSTRUCTOR"),
    requireRoleOrPermission([], "QUESTION_CREATE", "QUESTION_UPDATE"),
    assessmentController.createQuestionOptions
);
/**
 * @swagger
 * /api/instructor/assessments/{assessmentId}:
 *   put:
 *     summary: Update a draft assessment
 *     description: Only the instructor assigned to the course can update their DRAFT assessment.
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Full Stack Module Quiz
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: Updated assessment description
 *               instructions:
 *                 type: string
 *                 nullable: true
 *                 example: Read all questions carefully
 *               duration_minutes:
 *                 type: integer
 *                 nullable: true
 *                 example: 30
 *               pass_percentage:
 *                 type: number
 *                 example: 50
 *               max_attempts:
 *                 type: integer
 *                 nullable: true
 *                 example: 3
 *               passing_required:
 *                 type: boolean
 *                 example: true
 *               randomize_questions:
 *                 type: boolean
 *                 example: true
 *               randomize_options:
 *                 type: boolean
 *                 example: false
 *               show_result_immediately:
 *                 type: boolean
 *                 example: true
 *               allow_review_after_submission:
 *                 type: boolean
 *                 example: true
 *               available_from:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-11-01T09:00:00Z"
 *               available_until:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-11-30T18:00:00Z"
 *     responses:
 *       200:
 *         description: Assessment updated successfully
 *       400:
 *         description: Invalid data or assessment is not in DRAFT status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role required
 *       404:
 *         description: Assessment not found or access denied
 */
router.put(
    "/assessments/:assessmentId",
    authenticate,
    requireRole("INSTRUCTOR"),
    requirePermission("EXAM_UPDATE"),
    assessmentController.updateAssessment
);
/**
 * @swagger
 * /api/instructor/questions/{questionId}/options:
 *   put:
 *     summary: Update question options
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - options
 *             properties:
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - option_code
 *                     - option_text
 *                     - is_correct
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: Existing option ID; omit for a new option
 *                     option_code:
 *                       type: string
 *                     option_text:
 *                       type: string
 *                     display_order:
 *                       type: integer
 *                     is_correct:
 *                       type: boolean
 *                     explanation:
 *                       type: string
 *     responses:
 *       200:
 *         description: Options updated successfully
 *       400:
 *         description: Invalid options
 *       404:
 *         description: Question not found
 *       409:
 *         description: Duplicate option code or display order
 */
router.put(
    "/questions/:questionId/options",
    authenticate,
    requireRole("INSTRUCTOR"),
    requirePermission("QUESTION_UPDATE"),
    assessmentController.updateQuestionOptions
);

/**
 * @swagger
 * /api/instructor/assessments/{assessmentId}/questions:
 *   post:
 *     summary: Attach a question to an assessment
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question_id
 *               - question_number
 *               - marks
 *             properties:
 *               question_id:
 *                 type: integer
 *                 example: 2
 *               question_number:
 *                 type: integer
 *                 example: 1
 *               marks:
 *                 type: number
 *                 example: 2
 *               negative_marks:
 *                 type: number
 *                 example: 0
 *               is_mandatory:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Question attached successfully
 *       400:
 *         description: Invalid question data
 *       403:
 *         description: Instructor access denied
 *       404:
 *         description: Assessment or question not found
 *       409:
 *         description: Question already attached
 */
router.post(
    "/assessments/:assessmentId/questions",
    authenticate,
    requireRole("INSTRUCTOR"),
    requirePermission("EXAM_UPDATE"),
    assessmentController.attachQuestionToAssessment
);
/**
 * @swagger
 * /api/instructor/questions/{questionId}:
 *   get:
 *     summary: Get question details with active options
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     responses:
 *       200:
 *         description: Question retrieved successfully
 *       400:
 *         description: Invalid question ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role required
 *       404:
 *         description: Question not found
 */
router.get(
    "/questions/:questionId",
    authenticate,
    requireRole("INSTRUCTOR"),
    requireRoleOrPermission(
        [],
        "QUESTION_VIEW",
        "QUESTION_CREATE",
        "QUESTION_UPDATE",
        "QUESTION_DELETE"
    ),
    assessmentController.getQuestionWithOptions
);
/**
 * @swagger
 * /api/instructor/assessments/{assessmentId}:
 *   get:
 *     summary: Get assessment details with questions and options
 *     description: Retrieves assessment details, attached questions, options and correct answers for the assigned instructor.
 *     tags:
 *       - Instructor Assessments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     responses:
 *       200:
 *         description: Assessment details retrieved successfully
 *       400:
 *         description: Invalid assessment ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role required
 *       404:
 *         description: Assessment not found or access denied
 */
router.get(
    "/assessments/:assessmentId",
    authenticate,
    requireRole("INSTRUCTOR"),
    requireRoleOrPermission(
        [],
        "EXAM_VIEW",
        "EXAM_CREATE",
        "EXAM_UPDATE",
        "EXAM_DELETE"
    ),
    assessmentController.getAssessmentDetails
);
/**
 * @swagger
 * /api/instructor/assessments/{assessmentId}/publish:
 *   post:
 *     summary: Publish a draft assessment
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Assessment published successfully
 *       400:
 *         description: Assessment validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role required
 *       404:
 *         description: Assessment not found or access denied
 */
router.post(
    "/assessments/:assessmentId/publish",
    authenticate,
    requireRole("INSTRUCTOR"),
    requirePermission("EXAM_UPDATE"),
    assessmentController.publishAssessment
);
/**
 * @swagger
 * /api/instructor/assessments/{assessmentId}/results:
 *   get:
 *     summary: Get assessment results for assigned instructor
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Assessment results retrieved successfully
 *       400:
 *         description: Invalid assessment ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Instructor role required
 *       404:
 *         description: Assessment not found or access denied
 */
router.get(
    "/assessments/:assessmentId/results",
    authenticate,
    requireRole("INSTRUCTOR"),
    requireRoleOrPermission(
        [],
        "RESULT_VIEW",
        "RESULT_CREATE",
        "RESULT_UPDATE",
        "RESULT_DELETE"
    ),
    assessmentController.getAssessmentResults
);

/**
 * @swagger
 * /api/instructor/assessments/{assessmentId}/attempts/{attemptId}:
 *   get:
 *     summary: Get an attempt with answers for review and grading
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Attempt retrieved successfully
 *       404:
 *         description: Attempt not found or access denied
 */
router.get(
    "/assessments/:assessmentId/attempts/:attemptId",
    authenticate,
    requireRole("INSTRUCTOR"),
    requireRoleOrPermission(
        [],
        "RESULT_VIEW",
        "RESULT_CREATE",
        "RESULT_UPDATE",
        "RESULT_DELETE"
    ),
    assessmentController.getAssessmentAttemptDetail
);

/**
 * @swagger
 * /api/instructor/assessments/{assessmentId}/attempts/{attemptId}/evaluate:
 *   post:
 *     summary: Save manual grades and publish the final attempt result
 *     tags: [Instructor Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               publish:
 *                 type: boolean
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     question_id:
 *                       type: integer
 *                     marks_awarded:
 *                       type: number
 *                     is_correct:
 *                       type: boolean
 *                     evaluation_comment:
 *                       type: string
 *     responses:
 *       200:
 *         description: Result evaluated and published successfully
 *       409:
 *         description: Written answers are not fully graded
 */
router.post(
    "/assessments/:assessmentId/attempts/:attemptId/evaluate",
    authenticate,
    requireRole("INSTRUCTOR"),
    requirePermission("RESULT_UPDATE"),
    assessmentController.evaluateAssessmentAttempt
);

module.exports = router;
