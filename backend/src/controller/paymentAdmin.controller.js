const service = require("../services/paymentAdmin.service");

function sendError(res, error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error("Admin Payment API error:", error);
    }

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? "Internal server error"
                : error.message
    });
}

function listHandler(serviceMethod, label) {
    return async (req, res) => {
        try {
            const result = await serviceMethod(req.query);

            return res.status(200).json({
                success: true,
                message: `${label} retrieved successfully`,
                count: result.rows.length,
                pagination: result.pagination,
                data: result.rows
            });
        } catch (error) {
            return sendError(res, error);
        }
    };
}

function detailHandler(serviceMethod, label) {
    return async (req, res) => {
        try {
            const row = await serviceMethod(req.params.id);

            return res.status(200).json({
                success: true,
                message: `${label} retrieved successfully`,
                data: row
            });
        } catch (error) {
            return sendError(res, error);
        }
    };
}

async function getStatusOptions(_req, res) {
    try {
        const statuses = await service.getStatusOptions();

        return res.status(200).json({
            success: true,
            message: "Payment statuses retrieved successfully",
            data: statuses
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function deletePayment(req, res) {
    try {
        const payment = await service.deletePayment(req.params.id, req.user?.id);

        return res.status(200).json({
            success: true,
            message: "Payment deleted successfully",
            data: payment
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    getPayments: listHandler(service.getPayments, "Payments"),
    getPaymentById: detailHandler(service.getPaymentById, "Payment"),
    deletePayment,
    getPaymentReport: listHandler(service.getPaymentReport, "Payment report"),
    getTransactions: listHandler(
        service.getTransactions,
        "Payment transactions"
    ),
    getTransactionById: detailHandler(
        service.getTransactionById,
        "Payment transaction"
    ),
    getRefunds: listHandler(service.getRefunds, "Payment refunds"),
    getRefundById: detailHandler(service.getRefundById, "Payment refund"),
    getWebhooks: listHandler(service.getWebhooks, "Payment webhooks"),
    getWebhookById: detailHandler(service.getWebhookById, "Payment webhook"),
    getStatusOptions
};
