
const express = require("express");

const {
    authenticate,
    requireRole,
    requirePermission
} = require("../middleware/auth.middleware");

const paymentController = require("../controller/payment.controller");

const purchaseHistoryController =
    require("../controller/purchaseHistory.controller");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Student payment and checkout APIs
 */

/**
 * @swagger
 * /api/student/payments/create-order:
 *   post:
 *     summary: Create a payment order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id]
 *             properties:
 *               course_id:
 *                 type: integer
 *                 example: 1
 *               coupon_code:
 *                 type: string
 *                 example: SAVE10
 *               referral_code:
 *                 type: string
 *                 example: INS1001
 *     responses:
 *       200:
 *         description: Payment order created
 *       400:
 *         description: Invalid course or payment request
 *       401:
 *         description: Unauthorized
 */
router.post(
    "/create-order",
    authenticate,
    requireRole("STUDENT"),
    paymentController.createOrder
);

/**
 * @swagger
 * /api/student/payments/verify:
 *   post:
 *     summary: Verify a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verification result
 *       400:
 *         description: Invalid payment details
 *       401:
 *         description: Unauthorized
 */
router.post(
    "/verify",
    authenticate,
    requireRole("STUDENT"),
    paymentController.verifyPayment
);

/**
 * @swagger
 * /api/student/payments/demo-checkout:
 *   post:
 *     summary: Complete demo checkout
 *     description: Simulates checkout; does not collect real money.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Send course_id for a single course or course_ids for an atomic cart checkout.
 *             properties:
 *               course_id:
 *                 type: integer
 *                 example: 1
 *               course_ids:
 *                 type: array
 *                 minItems: 1
 *                 uniqueItems: true
 *                 items:
 *                   type: integer
 *                 example: [1, 2]
 *               coupon_code:
 *                 type: string
 *                 example: SAVE10
 *               coupon_codes_by_course:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 example: { "1": "SAVE10" }
 *               referral_codes_by_course:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 example: { "1": "INS1001" }
 *     responses:
 *       200:
 *         description: Demo checkout processed
 *       400:
 *         description: Invalid checkout request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student role required
 */
router.post(
    "/demo-checkout",
    authenticate,
    requireRole("STUDENT"),
    paymentController.confirmDemoCheckout
);

router.get(
    "/automatic-coupon",
    authenticate,
    requireRole("STUDENT"),
    paymentController.getAutomaticCoupon
);

/**
 * @swagger
 * /api/student/payments/apply-coupon:
 *   post:
 *     summary: Validate and apply a course coupon and/or instructor referral code
 *     tags: [Payments]
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
 *               coupon_code:
 *                 type: string
 *                 example: SAVE10
 *               referral_code:
 *                 type: string
 *                 example: INS1001
 *     responses:
 *       200:
 *         description: Coupon validated successfully
 *       400:
 *         description: Invalid or expired coupon
 *       401:
 *         description: Unauthorized
 */
router.post(
    "/apply-coupon",
    authenticate,
    requireRole("STUDENT"),
    paymentController.applyCoupon
);

// ============================================================
// GET STUDENT PURCHASE HISTORY
// Returns successful Demo Checkout purchases only.
// ============================================================



/**
 * @swagger
 * /student/payments/history:
 *   get:
 *     summary: Get student purchase history
 *     description: Returns only successful Demo Checkout purchases for the authenticated student.
 *     tags:
 *       - Student Payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: Purchase history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student role required
 *       500:
 *         description: Internal server error
 */


router.get(
    "/history",
    authenticate,
    requireRole("STUDENT"),
    requirePermission("PAYMENT_HISTORY_VIEW"),
    purchaseHistoryController.getPurchaseHistory
);

module.exports = router;
