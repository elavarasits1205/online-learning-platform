
const purchaseHistoryService =
    require("../services/purchaseHistory.service");

// ============================================================
// GET STUDENT PURCHASE HISTORY
// ============================================================

async function getPurchaseHistory(req, res, next) {
    try {
        // Get the authenticated student's user ID.
        const userId = req.user.id;

        // Fetch purchase history through the service layer.
        const result =
            await purchaseHistoryService.getPurchaseHistory(
                userId,
                req.query
            );

        return res.status(200).json(result);

    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getPurchaseHistory
};
    