
const service = require("../services/admin-course.service");
const { getUpdateAudit, getApprovalAudit } = require("../utils/audit");

async function listPending(req, res, next) {
    try {
        const courses = await service.listPending();

        return res.status(200).json({
            success: true,
            count: courses.length,
            data: courses
        });
    } catch (error) {
        next(error);
    }
}

async function listCourses(req, res, next) {
    try {
        const courses = await service.listAllCourses();

        return res.status(200).json({
            success: true,
            count: courses.length,
            data: courses
        });
    } catch (error) {
        next(error);
    }
}

async function getReviewBundle(req, res, next) {
    try {
        const course = await service.getReviewBundle(req.params.id);

        return res.status(200).json({
            success: true,
            data: course
        });
    } catch (error) {
        next(error);
    }
}

async function submitForApproval(req, res, next) {
    try {
        const course = await service.submitForApproval(
            req.params.id,
            getUpdateAudit(req).updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Course submitted for admin approval",
            data: course
        });
    } catch (error) {
        next(error);
    }
}

async function approve(req, res, next) {
    try {
        const course = await service.decide(
            req.params.id,
            getApprovalAudit(req).updatedBy,
            "APPROVE"
        );

        return res.status(200).json({
            success: true,
            message: "Course approved and published successfully",
            data: course
        });
    } catch (error) {
        next(error);
    }
}

async function reject(req, res, next) {
    try {
        const course = await service.decide(
            req.params.id,
            getApprovalAudit(req).updatedBy,
            "REJECT",
            req.body?.reason
        );

        return res.status(200).json({
            success: true,
            message: "Course rejected successfully",
            data: course
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listPending,
    listCourses,
    getReviewBundle,
    submitForApproval,
    approve,
    reject
};
