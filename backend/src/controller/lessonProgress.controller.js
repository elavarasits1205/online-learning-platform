
const lessonProgressService =
    require("../services/lessonProgress.service");

// ============================================================
// MARK LESSON COMPLETE CONTROLLER
// ============================================================
// Purpose:
// Frontend-லிருந்து வரும் lesson completion request-ஐ
// receive செய்து service layer-க்கு அனுப்பும்.
// ============================================================

async function markLessonComplete(req, res, next) {

    try {

        // ----------------------------------------------------
        // 1. CALL SERVICE LAYER
        // ----------------------------------------------------
        // courseId and lessonId come from URL parameters.
        // userId comes from authenticated JWT middleware.

        const result =
            await lessonProgressService.markLessonComplete({

                courseId: req.params.courseId,
                lessonId: req.params.lessonId,
                userId: req.user?.id

            });

        // ----------------------------------------------------
        // 2. SEND SUCCESS RESPONSE
        // ----------------------------------------------------
        // If lesson completion succeeds, return HTTP 200
        // along with updated course progress details.

        return res.status(200).json({
            success: true,
            message: "Lesson marked as completed",
            data: result
        });

    } catch (error) {

        // ----------------------------------------------------
        // 3. HANDLE KNOWN ERRORS
        // ----------------------------------------------------
        // If service sends a statusCode (400, 401, 403, 404),
        // return that status and error message to frontend.

        if (error.statusCode) {

            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        // ----------------------------------------------------
        // 4. HANDLE UNKNOWN ERRORS
        // ----------------------------------------------------
        // Unexpected errors are forwarded to Express
        // global error-handling middleware.

        return next(error);
    }
}

async function updateLessonProgress(req, res, next) {
    try {
        const result = await lessonProgressService.updateLessonProgress({
            courseId: req.params.courseId,
            lessonId: req.params.lessonId,
            userId: req.user?.id,
            progressPercentage: req.body?.progress_percentage
        });

        return res.status(200).json({
            success: true,
            message: "Lesson progress saved",
            data: result
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        return next(error);
    }
}

// Export controller function for route registration.
module.exports = {
    markLessonComplete,
    updateLessonProgress
};
