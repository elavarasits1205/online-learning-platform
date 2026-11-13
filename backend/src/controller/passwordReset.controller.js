const service = require("../services/passwordReset.service");

async function requestPasswordReset(req, res, next) {
    try {
        const data = await service.requestPasswordReset(req.body?.email);
        return res.status(202).json({ success: true, ...data });
    } catch (error) {
        return next(error);
    }
}

async function verifyResetOtp(req, res, next) {
    try {
        const data = await service.verifyResetOtp(req.body || {});
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
}

async function resetPassword(req, res, next) {
    try {
        const data = await service.resetPassword(req.body || {});
        return res.status(200).json({ success: true, ...data });
    } catch (error) {
        return next(error);
    }
}

module.exports = { requestPasswordReset, verifyResetOtp, resetPassword };
