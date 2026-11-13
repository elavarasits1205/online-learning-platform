
const express = require("express");

const router = express.Router();

const {
    authenticate,
    requireRole
} = require("../middleware/auth.middleware");

const certificateController =
    require("../controller/certificate.controller");

/**
 * @swagger
 * tags:
 *   name: Student Certificates
 *   description: Student certificate eligibility APIs
 */

/**
 * @swagger
 * /api/student/certificates/eligibility/{enrollmentId}:
 *   get:
 *     summary: Check certificate eligibility
 *     description: Checks whether the authenticated student has completed all mandatory lessons and passed all required module and course assessments.
 *     tags: [Student Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student enrollment ID
 *     responses:
 *       200:
 *         description: Certificate eligibility fetched successfully
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
 *                   example: Certificate eligibility fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     enrollmentId:
 *                       type: integer
 *                       example: 1
 *                     courseId:
 *                       type: integer
 *                       example: 13
 *                     lessons:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 10
 *                         completed:
 *                           type: integer
 *                           example: 10
 *                     assessments:
 *                       type: object
 *                       properties:
 *                         totalRequired:
 *                           type: integer
 *                           example: 3
 *                         passed:
 *                           type: integer
 *                           example: 3
 *                     isEligible:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Invalid enrollment ID
 *       401:
 *         description: Authentication token missing or invalid
 *       403:
 *         description: Student role required
 *       404:
 *         description: Enrollment not found or access denied
 *       500:
 *         description: Internal server error
 */

// GET /api/student/certificates/eligibility/:enrollmentId
router.get(
    "/eligibility/:enrollmentId",
    authenticate,
    requireRole("STUDENT"),
    certificateController.getCertificateEligibility
);


/**
 * @swagger
 * /api/student/certificates/generate/{enrollmentId}:
 *   post:
 *     summary: Generate student certificate
 *     description: Generates a certificate when all mandatory lessons and required assessments are completed.
 *     tags: [Student Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student enrollment ID
 *     responses:
 *       201:
 *         description: Certificate generated successfully
 *       400:
 *         description: Student is not eligible
 *       401:
 *         description: Authentication token missing or invalid
 *       403:
 *         description: Student role required
 *       404:
 *         description: Enrollment not found
 *       409:
 *         description: Certificate already exists
 *       500:
 *         description: Internal server error
 */

// POST /api/student/certificates/generate/:enrollmentId
router.post(
    "/generate/:enrollmentId",
    authenticate,
    requireRole("STUDENT"),
    certificateController.generateCertificate
);


/**
 * @swagger
 * /api/student/certificates/download/{certificateId}:
 *   get:
 *     summary: Download student certificate PDF
 *     description: Generates and downloads the issued certificate PDF for the authenticated student.
 *     tags: [Student Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: certificateId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Certificate ID
 *     responses:
 *       200:
 *         description: Certificate PDF downloaded successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid certificate ID
 *       401:
 *         description: Authentication token missing or invalid
 *       403:
 *         description: Student role required
 *       404:
 *         description: Certificate not found or access denied
 *       500:
 *         description: Internal server error
 */

// GET /api/student/certificates/download/:certificateId
router.get(
    "/download/:certificateId",
    authenticate,
    requireRole("STUDENT"),
    certificateController.downloadCertificatePdf
);



/**
 * @swagger
 * /api/student/certificates/upload-pdf/{certificateId}:
 *   post:
 *     summary: Upload PDF for an existing certificate
 *     description: Generates the PDF for an already issued certificate, uploads it to the private Supabase Certificates bucket, and saves the storage path in the database. Does not create a new certificate.
 *     tags: [Student Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: certificateId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Existing certificate ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Certificate PDF uploaded successfully
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
 *                   example: Certificate PDF uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     certificate_number:
 *                       type: string
 *                       example: LN-2026-5A1FED23
 *                     certificate_url:
 *                       type: string
 *                       example: student-3/LN-2026-5A1FED23.pdf
 *                     status:
 *                       type: string
 *                       example: ISSUED
 *       400:
 *         description: Invalid certificate ID
 *       401:
 *         description: Authentication token missing or invalid
 *       403:
 *         description: Student role required
 *       404:
 *         description: Certificate not found or access denied
 *       409:
 *         description: Certificate PDF is already uploaded
 *       500:
 *         description: PDF generation or Supabase upload failed
 */

// POST /api/student/certificates/upload-pdf/:certificateId
router.post(
    "/upload-pdf/:certificateId",
    authenticate,
    requireRole("STUDENT"),
    certificateController.retryCertificatePdf
);



/**
 * @swagger
 * /api/student/certificates/verify/{verificationCode}:
 *   get:
 *     summary: Verify certificate authenticity
 *     description: Public API to verify an issued or revoked certificate using its unique verification code.
 *     tags: [Student Certificates]
 *     parameters:
 *       - in: path
 *         name: verificationCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Fa-f0-9]{48}$'
 *         description: Unique 48-character certificate verification code
 *     responses:
 *       200:
 *         description: Certificate verification result
 *       400:
 *         description: Invalid verification code
 *       500:
 *         description: Internal server error
 */

// Public verification route - no student authentication required.
router.get(
    "/verify/:verificationCode",
    certificateController.verifyCertificate
);


/**
 * @swagger
 * /api/student/certificates/by-enrollment/{enrollmentId}:
 *   get:
 *     summary: Get existing certificate by enrollment
 *     description: Fetches an already issued certificate belonging to the authenticated student.
 *     tags: [Student Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student enrollment ID
 *     responses:
 *       200:
 *         description: Certificate details fetched successfully, or null if no certificate exists.
 *       400:
 *         description: Invalid enrollment ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Student role required
 *       500:
 *         description: Internal server error
 */

// GET /api/student/certificates/by-enrollment/:enrollmentId
router.get(
    "/by-enrollment/:enrollmentId",
    authenticate,
    requireRole("STUDENT"),
    certificateController.getCertificateByEnrollment
);

/**
 * @swagger
 * /api/student/certificates/regenerate-pdf/{certificateId}:
 *   post:
 *     summary: Regenerate existing certificate PDF
 *     description: Regenerates the PDF of an existing issued certificate and replaces the existing file in Supabase Storage. Does not create a new certificate.
 *     tags: [Student Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: certificateId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Certificate PDF regenerated successfully
 *       400:
 *         description: Invalid certificate ID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Student role required
 *       404:
 *         description: Certificate not found
 *       500:
 *         description: PDF generation or storage upload failed
 */

// POST /api/student/certificates/regenerate-pdf/:certificateId
router.post(
    "/regenerate-pdf/:certificateId",
    authenticate,
    requireRole("STUDENT"),
    certificateController.regenerateCertificatePdf
);


module.exports = router;
