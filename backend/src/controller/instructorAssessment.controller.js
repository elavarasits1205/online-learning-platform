const assessmentService = require(
    "../services/instructorAssessment.service"
);

async function createAssessment(req, res, next) {
    try {
        const assessment = await assessmentService.createAssessment(
            req.user.id,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "Assessment created successfully.",
            data: assessment
        });
    } catch (error) {
        next(error);
    }
}

async function listAssessments(req, res, next) {
    try {
        const assessments = await assessmentService.listAssessments(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "Assessments retrieved successfully.",
            data: assessments
        });
    } catch (error) {
        next(error);
    }
}

async function updateAssessment(req, res, next) {
    try {
        const assessment = await assessmentService.updateAssessment(
            req.user.id,
            req.params.assessmentId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Assessment updated successfully.",
            data: assessment
        });
    } catch (error) {
        next(error);
    }
}

async function createQuestion(req, res, next) {
    try {
        const question = await assessmentService.createQuestion(
            req.user.id,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "Question created successfully.",
            data: question
        });
    } catch (error) {
        next(error);
    }
}

async function updateQuestion(req, res, next) {
    try {
        const question = await assessmentService.updateQuestion(
            req.user.id,
            req.params.questionId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Question updated successfully.",
            data: question
        });
    } catch (error) {
        next(error);
    }
}

async function createQuestionOptions(req, res, next) {
    try {
        const options = await assessmentService.createQuestionOptions(
            req.user.id,
            req.params.questionId,
            req.body.options
        );

        return res.status(201).json({
            success: true,
            message: "Question options created successfully.",
            data: options
        });
    } catch (error) {
        next(error);
    }
}

async function attachQuestionToAssessment(req, res, next) {
    try {
        const result =
            await assessmentService.attachQuestionToAssessment(
                req.user.id,
                req.params.assessmentId,
                req.body
            );

        return res.status(201).json({
            success: true,
            message: "Question attached to assessment successfully.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function publishAssessment(req, res, next) {
    try {
        const assessment =
            await assessmentService.publishAssessment(
                req.user.id,
                req.params.assessmentId
            );

        return res.status(200).json({
            success: true,
            message: "Assessment published successfully.",
            data: assessment
        });
    } catch (error) {
        next(error);
    }
}

async function updateQuestionOptions(req, res, next) {
    try {
        const options = await assessmentService.updateQuestionOptions(
            req.user.id,
            req.params.questionId,
            req.body.options
        );

        return res.status(200).json({
            success: true,
            message: "Question options updated successfully.",
            data: options
        });
    } catch (error) {
        next(error);
    }
}

async function getQuestionWithOptions(req, res, next) {
    try {
        const question = await assessmentService.getQuestionWithOptions(
            req.user.id,
            req.params.questionId
        );

        return res.status(200).json({
            success: true,
            message: "Question retrieved successfully.",
            data: question
        });
    } catch (error) {
        next(error);
    }
}

async function getAssessmentDetails(req, res, next) {
    try {
        const assessment =
            await assessmentService.getAssessmentDetails(
                req.user.id,
                req.params.assessmentId
            );

        return res.status(200).json({
            success: true,
            message: "Assessment details retrieved successfully.",
            data: assessment
        });
    } catch (error) {
        next(error);
    }
}

async function getAssessmentResults(req, res, next) {
    try {
        const results =
            await assessmentService.getAssessmentResults(
                req.user.id,
                req.params.assessmentId
            );

        return res.status(200).json({
            success: true,
            message: "Assessment results retrieved successfully.",
            data: results
        });
    } catch (error) {
        next(error);
    }
}

async function getAssessmentAttemptDetail(req, res, next) {
    try {
        const result = await assessmentService.getAssessmentAttemptDetail(
            req.user.id,
            req.params.assessmentId,
            req.params.attemptId
        );

        return res.status(200).json({
            success: true,
            message: "Assessment attempt retrieved successfully.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function evaluateAssessmentAttempt(req, res, next) {
    try {
        const result = await assessmentService.evaluateAssessmentAttempt(
            req.user.id,
            req.params.assessmentId,
            req.params.attemptId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Assessment result evaluated successfully.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createAssessment,
    listAssessments,
    createQuestion,
    updateQuestion,
    createQuestionOptions,
    attachQuestionToAssessment,
    publishAssessment,
    updateQuestionOptions,
    getQuestionWithOptions,
    getAssessmentDetails,
    updateAssessment,
    getAssessmentResults,
    getAssessmentAttemptDetail,
    evaluateAssessmentAttempt
};