
const enrollmentService = require("../services/enrollment.service");

// POST - ENROLL IN COURSE
async function enrollInCourse(req, res, next) {
    try {
        const result = await enrollmentService.enrollInCourse(
            req.user.id,
            req.body || {}
        );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

// GET - MY ENROLLMENTS
async function getMyEnrollments(req, res, next) {
    try {
        const result = await enrollmentService.getMyEnrollments(
            req.user.id
        );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

// DELETE - REMOVE MY ENROLLMENT
async function removeMyEnrollment(req, res, next) {
    try {
        const result = await enrollmentService.removeMyEnrollment(
            req.user.id,
            req.params.enrollmentId
        );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    enrollInCourse,
    getMyEnrollments,
    removeMyEnrollment
};
