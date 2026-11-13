
const purchaseHistoryRepository =
    require("../repositories/purchaseHistory.repository");

// ============================================================
// CREATE STANDARD SERVICE ERROR
// ============================================================

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// ============================================================
// VALIDATE POSITIVE INTEGER
// ============================================================

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);

    return Number.isSafeInteger(parsed) && parsed > 0
        ? parsed
        : fallback;
}

// ============================================================
// GET LOGGED-IN STUDENT PURCHASE HISTORY
// ============================================================

async function getPurchaseHistory(userId, query = {}) {

    // Validate the authenticated user's ID.
    if (!/^[1-9]\d*$/.test(String(userId))) {
        throw createError("Invalid student user ID", 401);
    }

    // Validate pagination parameters.
    const page = parsePositiveInteger(query.page, 1);

    const limit = Math.min(
        parsePositiveInteger(query.limit, 10),
        50
    );

    const offset = (page - 1) * limit;

    if (!Number.isSafeInteger(offset)) {
        throw createError("Invalid pagination parameters", 400);
    }

    // Fetch purchase records and total count.
    const [purchases, total] = await Promise.all([
        purchaseHistoryRepository.getPurchaseHistory(
            userId,
            limit,
            offset
        ),

        purchaseHistoryRepository.countPurchaseHistory(userId)
    ]);

    // Return purchase history with pagination details.
    return {
        success: true,
        message: "Purchase history retrieved successfully",
        data: purchases,
        pagination: {
            current_page: page,
            per_page: limit,
            total_records: total,
            total_pages: Math.ceil(total / limit)
        }
    };
}

module.exports = {
    getPurchaseHistory
};
