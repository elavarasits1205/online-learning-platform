const express = require("express");

const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const controller = require("../controller/paymentAdmin.controller");

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Admin Payments
 *   description: Admin payment records, transactions, refunds, reports and webhooks
 */

/**
 * @swagger
 * /api/admin/payments:
 *   get:
 *     summary: List student payments
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: student_id
 *         schema: { type: string }
 *       - in: query
 *         name: course_id
 *         schema: { type: string }
 *       - in: query
 *         name: include_deleted
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 * /api/admin/payments/{id}:
 *   delete:
 *     summary: Soft delete an unsettled payment
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment soft deleted successfully
 *       409:
 *         description: Payment is settled or has an active transaction
 *
 * /api/admin/payments/statuses:
 *   get:
 *     summary: List payment statuses
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statuses retrieved successfully
 *
 * /api/admin/payments/transactions:
 *   get:
 *     summary: List payment transactions
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *
 * /api/admin/payments/refunds:
 *   get:
 *     summary: List payment refunds
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Refunds retrieved successfully
 *
 * /api/admin/payments/webhooks:
 *   get:
 *     summary: List payment webhooks
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Webhooks retrieved successfully
 */

router.get(
    "/statuses",
    requireRoleOrPermission(
        ["ADMIN"],
        "ALL_PAYMENTS_VIEW",
        "TRANSACTION_VIEW",
        "REFUND_VIEW",
        "PAYMENT_WEBHOOK_VIEW"
    ),
    controller.getStatusOptions
);

router.get(
    "/transactions",
    requireRoleOrPermission(["ADMIN"], "TRANSACTION_VIEW"),
    controller.getTransactions
);
router.get(
    "/transactions/:id",
    requireRoleOrPermission(["ADMIN"], "TRANSACTION_VIEW"),
    controller.getTransactionById
);

router.get(
    "/refunds",
    requireRoleOrPermission(["ADMIN"], "REFUND_VIEW"),
    controller.getRefunds
);
router.get(
    "/refunds/:id",
    requireRoleOrPermission(["ADMIN"], "REFUND_VIEW"),
    controller.getRefundById
);

router.get(
    "/webhooks",
    requireRoleOrPermission(["ADMIN"], "PAYMENT_WEBHOOK_VIEW"),
    controller.getWebhooks
);
router.get(
    "/webhooks/:id",
    requireRoleOrPermission(["ADMIN"], "PAYMENT_WEBHOOK_VIEW"),
    controller.getWebhookById
);

router.get(
    "/reports",
    requireRoleOrPermission(["ADMIN"], "PAYMENT_REPORT_VIEW"),
    controller.getPaymentReport
);
router.get(
    "/",
    requireRoleOrPermission(["ADMIN"], "ALL_PAYMENTS_VIEW"),
    controller.getPayments
);
router.delete(
    "/:id",
    requireRoleOrPermission(["ADMIN"], "ALL_PAYMENTS_DELETE"),
    controller.deletePayment
);
router.get(
    "/:id",
    requireRoleOrPermission(["ADMIN"], "ALL_PAYMENTS_VIEW"),
    controller.getPaymentById
);

module.exports = router;
