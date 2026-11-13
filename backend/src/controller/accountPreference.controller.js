const preferenceService = require("../services/accountPreference.service");

async function getMyPreferences(req, res, next) {
    try {
        const preferences = await preferenceService.getForUser(req.user.id);
        return res.status(200).json({ success: true, data: { preferences } });
    } catch (error) {
        return next(error);
    }
}

async function updateMyPreferences(req, res, next) {
    try {
        const preferences = await preferenceService.updateForUser(
            req.user.id,
            req.body || {}
        );
        return res.status(200).json({
            success: true,
            message: "Account preferences saved.",
            data: { preferences }
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = { getMyPreferences, updateMyPreferences };
