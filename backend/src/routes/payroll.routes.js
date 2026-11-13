
const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth.middleware");
const controller = require("../controller/payroll.controller");

// ============================================================
// PAYROLL SWAGGER DOCUMENTATION
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Payroll - Instructor
 *     description: Instructor earnings, payroll history and payslips
 *   - name: Payroll - Compensation
 *     description: Instructor course compensation management
 *   - name: Payroll - Periods
 *     description: Payroll period management
 *   - name: Payroll - Instructor Payroll
 *     description: Instructor payroll processing and management
 *   - name: Payroll - Course Earnings
 *     description: Course-wise instructor earnings
 *   - name: Payroll - Payments
 *     description: Instructor payroll payment management
 *   - name: Payroll - Reports
 *     description: Payroll reports and summaries
 *
 * components:
 *   schemas:
 *
 *     PayrollInstructorReference:
 *       type: object
 *       properties:
 *         instructor_id:
 *           type: string
 *           example: "12"
 *         instructor_user_id:
 *           type: string
 *           example: "25"
 *         instructor_code:
 *           type: string
 *           example: "INS001"
 *         instructor_username:
 *           type: string
 *           example: "instructor01"
 *         instructor_email:
 *           type: string
 *           example: "instructor@example.com"
 *         instructor_first_name:
 *           type: string
 *           example: "John"
 *         instructor_last_name:
 *           type: string
 *           nullable: true
 *           example: "Kumar"
 *         instructor_name:
 *           type: string
 *           example: "John Kumar"
 *
 *     PayrollCourseReference:
 *       type: object
 *       properties:
 *         course_id:
 *           type: string
 *           example: "45"
 *         course_code:
 *           type: string
 *           example: "CRS001"
 *         course_title:
 *           type: string
 *           example: "React JS"
 *
 *     PayrollPeriodReference:
 *       type: object
 *       properties:
 *         payroll_period_id:
 *           type: string
 *           example: "2"
 *         period_code:
 *           type: string
 *           example: "PAY-2026-10"
 *         period_start:
 *           type: string
 *           format: date
 *           example: "2026-10-01"
 *         period_end:
 *           type: string
 *           format: date
 *           example: "2026-10-31"
 *
 *     PayrollPagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 20
 *         total:
 *           type: string
 *           example: "100"
 *         totalPages:
 *           type: integer
 *           example: 5
 *
 *     PayrollApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Records retrieved successfully."
 *         data:
 *           type: object
 *
 *     PayrollErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Record not found."
 *
 *     Compensation:
 *       allOf:
 *         - $ref: '#/components/schemas/PayrollInstructorReference'
 *         - $ref: '#/components/schemas/PayrollCourseReference'
 *         - type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "1"
 *             compensation_type:
 *               type: string
 *               example: "COMMISSION"
 *             fixed_amount:
 *               type: number
 *               nullable: true
 *               example: 5000
 *             commission_percentage:
 *               type: number
 *               nullable: true
 *               example: 20
 *             currency_code:
 *               type: string
 *               example: "INR"
 *             effective_from:
 *               type: string
 *               format: date
 *               example: "2026-10-01"
 *             effective_until:
 *               type: string
 *               format: date
 *               nullable: true
 *             is_active:
 *               type: boolean
 *               example: true
 *             notes:
 *               type: string
 *               nullable: true
 *
 *     CompensationRequest:
 *       type: object
 *       required:
 *         - instructor_id
 *         - course_id
 *         - compensation_type
 *         - currency_code
 *         - effective_from
 *       properties:
 *         instructor_id:
 *           type: string
 *           example: "12"
 *         course_id:
 *           type: string
 *           example: "45"
 *         compensation_type:
 *           type: string
 *           example: "COMMISSION"
 *         fixed_amount:
 *           type: number
 *           nullable: true
 *           example: 5000
 *         commission_percentage:
 *           type: number
 *           nullable: true
 *           example: 20
 *         currency_code:
 *           type: string
 *           example: "INR"
 *         effective_from:
 *           type: string
 *           format: date
 *           example: "2026-10-01"
 *         effective_until:
 *           type: string
 *           format: date
 *           nullable: true
 *           example: "2026-12-31"
 *         is_active:
 *           type: boolean
 *           example: true
 *         notes:
 *           type: string
 *           nullable: true
 *
 *     PayrollPeriod:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "2"
 *         period_code:
 *           type: string
 *           example: "PAY-2026-10"
 *         period_start:
 *           type: string
 *           format: date
 *           example: "2026-10-01"
 *         period_end:
 *           type: string
 *           format: date
 *           example: "2026-10-31"
 *         status:
 *           type: string
 *           example: "OPEN"
 *         processed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         processed_by:
 *           type: string
 *           nullable: true
 *           example: "5"
 *         processed_by_username:
 *           type: string
 *           nullable: true
 *           example: "admin01"
 *         is_active:
 *           type: boolean
 *           example: true
 *
 *     PayrollPeriodRequest:
 *       type: object
 *       required:
 *         - period_code
 *         - period_start
 *         - period_end
 *       properties:
 *         period_code:
 *           type: string
 *           example: "PAY-2026-10"
 *         period_start:
 *           type: string
 *           format: date
 *           example: "2026-10-01"
 *         period_end:
 *           type: string
 *           format: date
 *           example: "2026-10-31"
 *         status:
 *           type: string
 *           example: "OPEN"
 *         is_active:
 *           type: boolean
 *           example: true
 *
 *     InstructorPayroll:
 *       allOf:
 *         - $ref: '#/components/schemas/PayrollInstructorReference'
 *         - $ref: '#/components/schemas/PayrollPeriodReference'
 *         - type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "10"
 *             payroll_number:
 *               type: string
 *               example: "PR-2026-001"
 *             total_earnings:
 *               type: number
 *               example: 25000
 *             total_deductions:
 *               type: number
 *               example: 1000
 *             net_amount:
 *               type: number
 *               example: 24000
 *             currency_code:
 *               type: string
 *               example: "INR"
 *             status:
 *               type: string
 *               example: "DRAFT"
 *             approved_at:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             approved_by:
 *               type: string
 *               nullable: true
 *               example: "5"
 *             approved_by_username:
 *               type: string
 *               nullable: true
 *               example: "admin01"
 *             paid_at:
 *               type: string
 *               format: date-time
 *               nullable: true
 *
 *     InstructorPayrollRequest:
 *       type: object
 *       required:
 *         - payroll_period_id
 *         - instructor_id
 *         - payroll_number
 *         - currency_code
 *       properties:
 *         payroll_period_id:
 *           type: string
 *           example: "2"
 *         instructor_id:
 *           type: string
 *           example: "12"
 *         payroll_number:
 *           type: string
 *           example: "PR-2026-001"
 *         currency_code:
 *           type: string
 *           example: "INR"
 *
 *     CourseEarning:
 *       allOf:
 *         - $ref: '#/components/schemas/PayrollInstructorReference'
 *         - $ref: '#/components/schemas/PayrollCourseReference'
 *         - type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "100"
 *             instructor_payroll_id:
 *               type: string
 *               example: "10"
 *             payroll_number:
 *               type: string
 *               example: "PR-2026-001"
 *             payroll_status:
 *               type: string
 *               example: "DRAFT"
 *             period_code:
 *               type: string
 *               example: "PAY-2026-10"
 *             compensation_id:
 *               type: string
 *               example: "1"
 *             compensation_type:
 *               type: string
 *               example: "COMMISSION"
 *             earning_type:
 *               type: string
 *               example: "COMMISSION"
 *             eligible_student_count:
 *               type: integer
 *               example: 20
 *               description: Number of eligible paid enrollments attributed to the instructor by referral
 *             gross_course_revenue:
 *               type: number
 *               example: 50000
 *             eligible_course_revenue:
 *               type: number
 *               example: 45000
 *             rate_percentage:
 *               type: number
 *               nullable: true
 *               example: 20
 *             rate_amount:
 *               type: number
 *               nullable: true
 *               example: 9000
 *             fixed_amount:
 *               type: number
 *               example: 0
 *             commission_amount:
 *               type: number
 *               example: 9000
 *             student_amount:
 *               type: number
 *               example: 0
 *             total_earning:
 *               type: number
 *               example: 9000
 *             calculation_notes:
 *               type: string
 *               nullable: true
 *
 *     CourseEarningRequest:
 *       type: object
 *       required:
 *         - instructor_payroll_id
 *         - course_id
 *         - compensation_id
 *         - total_earning
 *       properties:
 *         instructor_payroll_id:
 *           type: string
 *           example: "10"
 *         course_id:
 *           type: string
 *           example: "45"
 *         compensation_id:
 *           type: string
 *           example: "1"
 *         earning_type:
 *           type: string
 *           example: "COMMISSION"
 *         eligible_student_count:
 *           type: integer
 *           example: 20
 *           description: Number of eligible paid enrollments attributed to the instructor by referral
 *         gross_course_revenue:
 *           type: number
 *           example: 50000
 *         eligible_course_revenue:
 *           type: number
 *           example: 45000
 *         rate_percentage:
 *           type: number
 *           nullable: true
 *           example: 20
 *         rate_amount:
 *           type: number
 *           nullable: true
 *           example: 9000
 *         fixed_amount:
 *           type: number
 *           example: 0
 *         commission_amount:
 *           type: number
 *           example: 9000
 *         student_amount:
 *           type: number
 *           example: 0
 *         total_earning:
 *           type: number
 *           example: 9000
 *         calculation_notes:
 *           type: string
 *           nullable: true
 *
 *     PayrollPayment:
 *       allOf:
 *         - $ref: '#/components/schemas/PayrollInstructorReference'
 *         - $ref: '#/components/schemas/PayrollPeriodReference'
 *         - type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "50"
 *             instructor_payroll_id:
 *               type: string
 *               example: "10"
 *             payroll_number:
 *               type: string
 *               example: "PR-2026-001"
 *             payroll_status:
 *               type: string
 *               example: "APPROVED"
 *             payment_number:
 *               type: string
 *               example: "PAYMENT-2026-001"
 *             payment_method:
 *               type: string
 *               example: "BANK_TRANSFER"
 *             payment_gateway:
 *               type: string
 *               nullable: true
 *             amount:
 *               type: number
 *               example: 24000
 *             currency_code:
 *               type: string
 *               example: "INR"
 *             bank_reference:
 *               type: string
 *               nullable: true
 *             status:
 *               type: string
 *               example: "INITIATED"
 *             initiated_at:
 *               type: string
 *               format: date-time
 *             processed_at:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             failed_at:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             failure_reason:
 *               type: string
 *               nullable: true
 *
 *     PayrollPaymentRequest:
 *       type: object
 *       required:
 *         - instructor_payroll_id
 *         - payment_number
 *         - payment_method
 *         - amount
 *         - currency_code
 *       properties:
 *         instructor_payroll_id:
 *           type: string
 *           example: "10"
 *         payment_number:
 *           type: string
 *           example: "PAYMENT-2026-001"
 *         payment_method:
 *           type: string
 *           example: "BANK_TRANSFER"
 *         payment_gateway:
 *           type: string
 *           nullable: true
 *         amount:
 *           type: number
 *           example: 24000
 *         currency_code:
 *           type: string
 *           example: "INR"
 *         bank_reference:
 *           type: string
 *           nullable: true
 *
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authenticate);

// ============================================================
// COMMON SWAGGER PARAMETERS
// ============================================================

/**
 * @swagger
 * components:
 *   parameters:
 *     PayrollId:
 *       in: path
 *       name: id
 *       required: true
 *       description: PostgreSQL BIGINT record ID. Pass it as a string.
 *       schema:
 *         type: string
 *         pattern: '^[1-9][0-9]*$'
 *       example: "10"
 *
 *     PayrollPage:
 *       in: query
 *       name: page
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *
 *     PayrollLimit:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 20
 *
 *     PayrollSearch:
 *       in: query
 *       name: search
 *       schema:
 *         type: string
 *       description: Search by related instructor, course, payroll or period details.
 *
 *     PayrollStatus:
 *       in: query
 *       name: status
 *       schema:
 *         type: string
 */

// ============================================================
// INSTRUCTOR SELF-SERVICE
// ============================================================

/**
 * @swagger
 * /api/payroll/instructor/overview:
 *   get:
 *     summary: Get instructor earnings overview
 *     description: Returns the authenticated instructor's payroll totals. Instructor ID is derived from the JWT user ID.
 *     tags: [Payroll - Instructor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Earnings overview retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               message: Instructor earnings overview retrieved.
 *               data:
 *                 instructor_id: "12"
 *                 instructor_code: INS001
 *                 instructor_username: instructor01
 *                 instructor_name: John Kumar
 *                 payroll_count: "3"
 *                 total_earnings: "75000.00"
 *                 total_deductions: "3000.00"
 *                 net_amount: "72000.00"
 *                 paid_amount: "24000.00"
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Instructor access required.
 *
 * /api/payroll/instructor/course-earnings:
 *   get:
 *     summary: Get instructor course-wise earnings
 *     tags: [Payroll - Instructor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollPage'
 *       - $ref: '#/components/parameters/PayrollLimit'
 *       - $ref: '#/components/parameters/PayrollSearch'
 *     responses:
 *       200:
 *         description: Course earnings retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 data:
 *                   - id: "100"
 *                     instructor_payroll_id: "10"
 *                     payroll_number: PR-2026-001
 *                     instructor_id: "12"
 *                     instructor_code: INS001
 *                     instructor_username: instructor01
 *                     course_id: "45"
 *                     course_code: CRS001
 *                     course_title: React JS
 *                     compensation_id: "1"
 *                     compensation_type: COMMISSION
 *                     total_earning: "9000.00"
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: "1"
 *                   totalPages: 1
 *
 * /api/payroll/instructor/payroll-history:
 *   get:
 *     summary: Get authenticated instructor payroll history
 *     tags: [Payroll - Instructor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollPage'
 *       - $ref: '#/components/parameters/PayrollLimit'
 *       - $ref: '#/components/parameters/PayrollSearch'
 *       - $ref: '#/components/parameters/PayrollStatus'
 *     responses:
 *       200:
 *         description: Payroll history retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 data:
 *                   - id: "10"
 *                     payroll_period_id: "2"
 *                     period_code: PAY-2026-10
 *                     period_start: "2026-10-01"
 *                     period_end: "2026-10-31"
 *                     instructor_id: "12"
 *                     instructor_code: INS001
 *                     instructor_username: instructor01
 *                     payroll_number: PR-2026-001
 *                     total_earnings: "25000.00"
 *                     total_deductions: "1000.00"
 *                     net_amount: "24000.00"
 *                     status: APPROVED
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: "1"
 *                   totalPages: 1
 *
 * /api/payroll/instructor/payment-history:
 *   get:
 *     summary: Get authenticated instructor payment history
 *     tags: [Payroll - Instructor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollPage'
 *       - $ref: '#/components/parameters/PayrollLimit'
 *       - $ref: '#/components/parameters/PayrollSearch'
 *       - $ref: '#/components/parameters/PayrollStatus'
 *     responses:
 *       200:
 *         description: Payment history retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 data:
 *                   - id: "50"
 *                     instructor_payroll_id: "10"
 *                     payroll_number: PR-2026-001
 *                     instructor_id: "12"
 *                     instructor_code: INS001
 *                     instructor_username: instructor01
 *                     payroll_period_id: "2"
 *                     period_code: PAY-2026-10
 *                     payment_number: PAYMENT-2026-001
 *                     amount: "24000.00"
 *                     currency_code: INR
 *                     status: SUCCESS
 *
 * /api/payroll/instructor/payslip/{payrollId}:
 *   get:
 *     summary: Download or retrieve instructor payslip data
 *     description: Returns the payroll, course earnings and payment information belonging to the authenticated instructor.
 *     tags: [Payroll - Instructor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payrollId
 *         required: true
 *         schema:
 *           type: string
 *         example: "10"
 *     responses:
 *       200:
 *         description: Payslip data retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               message: Payslip retrieved successfully.
 *               data:
 *                 payroll:
 *                   id: "10"
 *                   payroll_number: PR-2026-001
 *                   instructor_id: "12"
 *                   instructor_code: INS001
 *                   instructor_username: instructor01
 *                   payroll_period_id: "2"
 *                   period_code: PAY-2026-10
 *                   total_earnings: "25000.00"
 *                   total_deductions: "1000.00"
 *                   net_amount: "24000.00"
 *                 earnings: []
 *                 payments: []
 *       404:
 *         description: Payslip not found.
 */

// ============================================================
// COMPENSATION MANAGEMENT
// ============================================================

/**
 * @swagger
 * /api/payroll/compensations:
 *   get:
 *     summary: Get all instructor course compensations
 *     tags: [Payroll - Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollPage'
 *       - $ref: '#/components/parameters/PayrollLimit'
 *       - $ref: '#/components/parameters/PayrollSearch'
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *         description: Filter by instructor BIGINT ID.
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: Keep consolidated payrolls that include earnings for this course BIGINT ID.
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: Filter by course BIGINT ID.
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Compensation list retrieved with instructor and course details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 data:
 *                   - id: "1"
 *                     instructor_id: "12"
 *                     instructor_code: INS001
 *                     instructor_user_id: "25"
 *                     instructor_username: instructor01
 *                     instructor_email: instructor@example.com
 *                     instructor_first_name: John
 *                     instructor_last_name: Kumar
 *                     instructor_name: John Kumar
 *                     course_id: "45"
 *                     course_code: CRS001
 *                     course_title: React JS
 *                     compensation_type: COMMISSION
 *                     commission_percentage: "20.00"
 *                     currency_code: INR
 *                     is_active: true
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: "1"
 *                   totalPages: 1
 *
 *   post:
 *     summary: Create instructor course compensation
 *     tags: [Payroll - Compensation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompensationRequest'
 *     responses:
 *       201:
 *         description: Compensation created with instructor and course names.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *       400:
 *         description: Invalid request or foreign-key reference.
 *       403:
 *         description: Admin access required.
 *
 * /api/payroll/compensations/{id}:
 *   get:
 *     summary: Get compensation by ID
 *     tags: [Payroll - Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Compensation details with instructor and course names.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Compensation'
 *       404:
 *         description: Compensation not found.
 *
 *   put:
 *     summary: Update compensation
 *     tags: [Payroll - Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompensationRequest'
 *     responses:
 *       200:
 *         description: Updated compensation with instructor and course names.
 *       404:
 *         description: Compensation not found.
 *
 *   delete:
 *     summary: Soft delete compensation
 *     tags: [Payroll - Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Compensation deleted.
 */

// ============================================================
// PAYROLL PERIOD MANAGEMENT
// ============================================================

/**
 * @swagger
 * /api/payroll/periods:
 *   get:
 *     summary: Get all payroll periods
 *     tags: [Payroll - Periods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollPage'
 *       - $ref: '#/components/parameters/PayrollLimit'
 *       - $ref: '#/components/parameters/PayrollSearch'
 *       - $ref: '#/components/parameters/PayrollStatus'
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Payroll periods with processed-by username.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *
 *   post:
 *     summary: Create payroll period
 *     tags: [Payroll - Periods]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PayrollPeriodRequest'
 *     responses:
 *       201:
 *         description: Payroll period created.
 *       400:
 *         description: Invalid period dates or request data.
 *
 * /api/payroll/periods/{id}:
 *   get:
 *     summary: Get payroll period by ID
 *     tags: [Payroll - Periods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Payroll period with processed-by user details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollPeriod'
 *
 *   put:
 *     summary: Update payroll period
 *     tags: [Payroll - Periods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PayrollPeriodRequest'
 *     responses:
 *       200:
 *         description: Payroll period updated.
 *
 *   delete:
 *     summary: Soft delete payroll period
 *     tags: [Payroll - Periods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Payroll period deleted.
 */

// ============================================================
// INSTRUCTOR PAYROLL MANAGEMENT
// ============================================================

/**
 * @swagger
 * /api/payroll/instructor-payrolls:
 *   get:
 *     summary: Get all instructor payroll records
 *     description: Admin can view all records. Instructor can view only their own records.
 *     tags: [Payroll - Instructor Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollPage'
 *       - $ref: '#/components/parameters/PayrollLimit'
 *       - $ref: '#/components/parameters/PayrollSearch'
 *       - $ref: '#/components/parameters/PayrollStatus'
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: periodId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payroll records including instructor and period details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 data:
 *                   - id: "10"
 *                     payroll_period_id: "2"
 *                     period_code: PAY-2026-10
 *                     period_start: "2026-10-01"
 *                     period_end: "2026-10-31"
 *                     instructor_id: "12"
 *                     instructor_code: INS001
 *                     instructor_username: instructor01
 *                     instructor_email: instructor@example.com
 *                     instructor_name: John Kumar
 *                     payroll_number: PR-2026-001
 *                     total_earnings: "25000.00"
 *                     total_deductions: "1000.00"
 *                     net_amount: "24000.00"
 *                     currency_code: INR
 *                     status: DRAFT
 *
 *   post:
 *     summary: Create instructor payroll
 *     tags: [Payroll - Instructor Payroll]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InstructorPayrollRequest'
 *     responses:
 *       201:
 *         description: Instructor payroll created with instructor and period names.
 *       400:
 *         description: Invalid instructor or period.
 *
 * /api/payroll/instructor-payrolls/{id}:
 *   get:
 *     summary: Get instructor payroll by ID
 *     tags: [Payroll - Instructor Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Instructor payroll with foreign-key details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InstructorPayroll'
 *       404:
 *         description: Payroll not found.
 *
 *   put:
 *     summary: Update instructor payroll
 *     tags: [Payroll - Instructor Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               total_earnings:
 *                 type: number
 *                 example: 25000
 *               total_deductions:
 *                 type: number
 *                 example: 1000
 *               currency_code:
 *                 type: string
 *                 example: INR
 *     responses:
 *       200:
 *         description: Payroll updated with instructor and period names.
 *       409:
 *         description: Finalized payroll cannot be edited.
 *
 *   delete:
 *     summary: Soft delete instructor payroll
 *     tags: [Payroll - Instructor Payroll]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Payroll deleted.
 */

// ============================================================
// COURSE EARNINGS MANAGEMENT
// ============================================================

/**
 * @swagger
 * /api/payroll/course-earnings:
 *   get:
 *     summary: Get all course earnings
 *     description: Admin can view all course earnings. Instructor can view only their own.
 *     tags: [Payroll - Course Earnings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollPage'
 *       - $ref: '#/components/parameters/PayrollLimit'
 *       - $ref: '#/components/parameters/PayrollSearch'
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *       - in: query
 *         name: payrollId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Course earnings with instructor, course, payroll and compensation names.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *
 *   post:
 *     summary: Create course earning
 *     tags: [Payroll - Course Earnings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseEarningRequest'
 *     responses:
 *       201:
 *         description: Course earning created with all related names.
 *       400:
 *         description: Invalid course, compensation or payroll reference.
 *
 * /api/payroll/course-earnings/{id}:
 *   get:
 *     summary: Get course earning by ID
 *     tags: [Payroll - Course Earnings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Course earning with all foreign-key details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseEarning'
 *
 *   put:
 *     summary: Update course earning
 *     tags: [Payroll - Course Earnings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseEarningRequest'
 *     responses:
 *       200:
 *         description: Updated course earning with related names.
 *
 *   delete:
 *     summary: Soft delete course earning
 *     tags: [Payroll - Course Earnings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Course earning deleted.
 */

// ============================================================
// PAYMENT MANAGEMENT
// ============================================================

/**
 * @swagger
 * /api/payroll/payments:
 *   get:
 *     summary: Get all payroll payments
 *     description: Admin can view all payments. Instructor can view only their own payments.
 *     tags: [Payroll - Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollPage'
 *       - $ref: '#/components/parameters/PayrollLimit'
 *       - $ref: '#/components/parameters/PayrollSearch'
 *       - $ref: '#/components/parameters/PayrollStatus'
 *       - in: query
 *         name: payrollId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payments with instructor, payroll and period names.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 data:
 *                   - id: "50"
 *                     instructor_payroll_id: "10"
 *                     payroll_number: PR-2026-001
 *                     instructor_id: "12"
 *                     instructor_code: INS001
 *                     instructor_username: instructor01
 *                     instructor_email: instructor@example.com
 *                     instructor_name: John Kumar
 *                     payroll_period_id: "2"
 *                     period_code: PAY-2026-10
 *                     payment_number: PAYMENT-2026-001
 *                     payment_method: BANK_TRANSFER
 *                     amount: "24000.00"
 *                     currency_code: INR
 *                     status: INITIATED
 *
 *   post:
 *     summary: Initiate payroll payment
 *     tags: [Payroll - Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PayrollPaymentRequest'
 *     responses:
 *       201:
 *         description: Payment initiated with instructor and payroll references.
 *       400:
 *         description: Invalid payment request.
 *       409:
 *         description: Payroll must be approved before payment.
 *
 * /api/payroll/payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payroll - Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Payment details with instructor and payroll names.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollPayment'
 *
 *   put:
 *     summary: Update payment information
 *     tags: [Payroll - Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payment_method:
 *                 type: string
 *                 example: BANK_TRANSFER
 *               payment_gateway:
 *                 type: string
 *                 nullable: true
 *               amount:
 *                 type: number
 *                 example: 24000
 *               currency_code:
 *                 type: string
 *                 example: INR
 *               bank_reference:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Payment updated.
 *       409:
 *         description: Successful payment cannot be edited.
 *
 *   delete:
 *     summary: Soft delete payment
 *     tags: [Payroll - Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PayrollId'
 *     responses:
 *       200:
 *         description: Payment deleted.
 */

// ============================================================
// PAYROLL REPORTS
// ============================================================

/**
 * @swagger
 * /api/payroll/reports:
 *   get:
 *     summary: Get payroll reports
 *     description: Returns payroll totals and instructor details, optionally filtered by period or instructor.
 *     tags: [Payroll - Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodId
 *         schema:
 *           type: string
 *         description: Filter by payroll period BIGINT ID.
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *         description: Filter by instructor BIGINT ID.
 *     responses:
 *       200:
 *         description: Payroll report retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollApiResponse'
 *             example:
 *               success: true
 *               data:
 *                 - payroll_period_id: "2"
 *                   period_code: PAY-2026-10
 *                   instructor_payroll_id: "10"
 *                   payroll_number: PR-2026-001
 *                   instructor_id: "12"
 *                   instructor_code: INS001
 *                   instructor_username: instructor01
 *                   instructor_email: instructor@example.com
 *                   instructor_name: John Kumar
 *                   total_earnings: "25000.00"
 *                   total_deductions: "1000.00"
 *                   net_amount: "24000.00"
 *                   currency_code: INR
 *                   status: APPROVED
 *       403:
 *         description: Admin access required.
 */

// ============================================================
// ROUTE REGISTRATION
// ============================================================

// Instructor self-service
router.get(
    "/instructor/overview",
    controller.getInstructorOverview
);

router.get(
    "/instructor/course-earnings",
    controller.getAll("courseEarning")
);

router.get(
    "/instructor/payroll-history",
    controller.getAll("instructorPayroll")
);

router.get(
    "/instructor/payment-history",
    controller.getAll("payment")
);

router.get(
    "/instructor/payslip/:payrollId",
    controller.getInstructorPayslip
);

// Compensation
router.get("/referral-settings", controller.getReferralSettings);
router.put("/referral-settings", controller.saveReferralSettings);

router.get("/compensations", controller.getAll("compensation"));
router.get(
    "/compensations/instructor-courses",
    controller.getCompensationInstructorCourses
);
router.get("/compensations/:id", controller.getById("compensation"));
router.post("/compensations", controller.create("compensation"));
router.put("/compensations/:id", controller.update("compensation"));
router.delete("/compensations/:id", controller.remove("compensation"));

// Payroll periods
router.get("/periods", controller.getAll("period"));
router.get("/periods/:id", controller.getById("period"));
router.post("/periods/:id/calculate", controller.calculatePeriod);
router.post("/periods", controller.create("period"));
router.put("/periods/:id", controller.update("period"));
router.delete("/periods/:id", controller.remove("period"));

// Instructor payroll
router.get("/instructor-payrolls", controller.getAll("instructorPayroll"));
router.get("/instructor-payrolls/:id", controller.getById("instructorPayroll"));
router.post("/instructor-payrolls", controller.create("instructorPayroll"));
router.put("/instructor-payrolls/:id", controller.update("instructorPayroll"));
router.delete("/instructor-payrolls/:id", controller.remove("instructorPayroll"));

// Course earnings
router.get("/course-earnings", controller.getAll("courseEarning"));
router.get("/course-earnings/:id", controller.getById("courseEarning"));
router.post("/course-earnings", controller.create("courseEarning"));
router.put("/course-earnings/:id", controller.update("courseEarning"));
router.delete("/course-earnings/:id", controller.remove("courseEarning"));

// Payments
router.get("/payments", controller.getAll("payment"));
router.get("/payments/:id", controller.getById("payment"));
router.post("/payments", controller.create("payment"));
router.put("/payments/:id", controller.update("payment"));
router.delete("/payments/:id", controller.remove("payment"));

// Reports
router.get("/reports", controller.getReports);

module.exports = router;
