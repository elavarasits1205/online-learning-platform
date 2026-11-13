const service = require("../services/courseReview.service");

function parseCourseId(value) {
    const courseId = Number(value);
    return Number.isSafeInteger(courseId) && courseId > 0 ? courseId : null;
}

async function getCourseReviews(req, res, next) {
    try {
        const courseId = parseCourseId(req.params.courseId);
        if (!courseId) {
            return res.status(400).json({ success: false, message: "A valid course ID is required." });
        }
        const data = await service.getCourseReviews(courseId, req.user?.id || null);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
}

async function saveCourseReview(req, res, next) {
    try {
        const courseId = parseCourseId(req.params.courseId);
        if (!courseId) {
            return res.status(400).json({ success: false, message: "A valid course ID is required." });
        }
        const review = await service.saveCourseReview(courseId, req.user.id, req.body);
        return res.status(200).json({ success: true, message: "Your review has been saved.", data: { review } });
    } catch (error) {
        return next(error);
    }
}

module.exports = { getCourseReviews, saveCourseReview };
