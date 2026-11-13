const publicService = require("../services/public.service");

async function getCatalog(req, res, next) {
    try {
        const data = await publicService.getCatalog(req.query);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
}

async function getCourseDetails(req, res, next) {
    try {
        const courseId = Number(req.params.courseId);
        if (!Number.isSafeInteger(courseId) || courseId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid course ID"
            });
        }

        const userId = req.user?.id || null;
        const course = await publicService.getCourseDetails(courseId, userId);
        return res.status(200).json({
            success: true,
            data: { course }
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }
        return next(error);
    }
}

async function getInstitutions(req, res, next) {
    try {
        const institutions = await publicService.getInstitutions();
        return res.status(200).json({
            success: true,
            data: { institutions }
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getCatalog,
    getCourseDetails,
    getInstitutions
};
