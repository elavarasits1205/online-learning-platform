const learningCourseService =
    require("../services/learningCourse.service");

async function getLearningActivity(req, res, next) {
    try {
        const data = await learningCourseService.getLearningActivity(req.user.id);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return next(error);
    }
}

// GET LEARNING CONTENT FOR AN ENROLLED STUDENT
async function getEnrolledCourseLearningContent(req, res, next) {
    try {
        const courseId = Number(req.params.courseId);
        const userId = req.user?.id;

        // Validate course ID.
        if (
            !Number.isSafeInteger(courseId) ||
            courseId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid course ID is required."
            });
        }

        // Validate authentication.
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication is required."
            });
        }

        // Get learning content through the service.
        const learningContent =
            await learningCourseService
                .getEnrolledCourseLearningContent(
                    userId,
                    courseId
                );

        // Course missing or student not enrolled.
        if (!learningContent) {
            return res.status(403).json({
                success: false,
                message:
                    "You must be enrolled in this course to access its lessons."
            });
        }

        return res.status(200).json({
            success: true,
            data: learningContent
        });
    } catch (error) {
        console.error(
            "Failed to fetch course learning content:",
            error.message
        );

        return next(error);
    }
}

module.exports = {
    getLearningActivity,
    getEnrolledCourseLearningContent
};
