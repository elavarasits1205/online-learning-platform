const repository = require("../repositories/paymentAdmin.repository");

const {
    createError,
    validateId,
    parseBoolean,
    normalizeDatabaseError
} = require("../utils/coupon-child.helpers");

function parsePagination(query) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    if (!Number.isInteger(page) || page < 1) {
        throw createError("page must be a positive integer.");
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw createError("limit must be between 1 and 100.");
    }

    return { page, limit };
}

function optionalId(value, field) {
    return value !== undefined && value !== ""
        ? validateId(value, field)
        : null;
}

function optionalBoolean(value, field) {
    return value !== undefined && value !== ""
        ? parseBoolean(value, field)
        : false;
}

function optionalText(value) {
    return value !== undefined && value !== null
        ? String(value).trim()
        : null;
}

async function getPayments(query = {}) {
    try {
        const { page, limit } = parsePagination(query);

        return await repository.findPayments({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            status: optionalText(query.status),
            studentId: optionalId(query.student_id, "student_id"),
            courseId: optionalId(query.course_id, "course_id"),
            includeDeleted: optionalBoolean(
                query.include_deleted,
                "include_deleted"
            )
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getPaymentReport(query = {}) {
    try {
        const { page, limit } = parsePagination(query);

        return await repository.findPaymentReport({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            status: optionalText(query.status)
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getPaymentById(id) {
    try {
        const payment = await repository.findPaymentById(validateId(id));

        if (!payment) {
            throw createError("Payment not found.", 404);
        }

        return payment;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function deletePayment(id, userId) {
    try {
        const paymentId = validateId(id);
        const actorId = validateId(userId, "authenticated user id");
        return await repository.softDeletePayment(paymentId, actorId);
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getTransactions(query = {}) {
    try {
        const { page, limit } = parsePagination(query);

        return await repository.findTransactions({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            status: optionalText(query.status),
            paymentId: optionalId(query.payment_id, "payment_id"),
            includeDeleted: optionalBoolean(
                query.include_deleted,
                "include_deleted"
            )
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getTransactionById(id) {
    try {
        const transaction = await repository.findTransactionById(
            validateId(id)
        );

        if (!transaction) {
            throw createError("Payment transaction not found.", 404);
        }

        return transaction;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getRefunds(query = {}) {
    try {
        const { page, limit } = parsePagination(query);

        return await repository.findRefunds({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            status: optionalText(query.status),
            paymentId: optionalId(query.payment_id, "payment_id"),
            includeDeleted: optionalBoolean(
                query.include_deleted,
                "include_deleted"
            )
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getRefundById(id) {
    try {
        const refund = await repository.findRefundById(validateId(id));

        if (!refund) {
            throw createError("Payment refund not found.", 404);
        }

        return refund;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getWebhooks(query = {}) {
    try {
        const { page, limit } = parsePagination(query);

        return await repository.findWebhooks({
            page,
            limit,
            search: String(query.search ?? "").trim(),
            processingStatus: optionalText(query.processing_status),
            paymentId: optionalId(query.payment_id, "payment_id"),
            includeDeleted: optionalBoolean(
                query.include_deleted,
                "include_deleted"
            )
        });
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getWebhookById(id) {
    try {
        const webhook = await repository.findWebhookById(validateId(id));

        if (!webhook) {
            throw createError("Payment webhook not found.", 404);
        }

        return webhook;
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

async function getStatusOptions() {
    try {
        return await repository.getStatusOptions();
    } catch (error) {
        throw normalizeDatabaseError(error);
    }
}

module.exports = {
    getPayments,
    getPaymentReport,
    getPaymentById,
    deletePayment,
    getTransactions,
    getTransactionById,
    getRefunds,
    getRefundById,
    getWebhooks,
    getWebhookById,
    getStatusOptions
};
