const studentAssessmentService =
    require("../services/StudentAssessment.service");

function normalizeBigIntId(value) {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) && value > 0
            ? String(value)
            : null;
    }

    const id = String(value ?? "").trim();

    return /^[1-9]\d*$/.test(id) ? id : null;
}

async function getAvailableAssessments(req, res, next) {
    try {
        const result =
            await studentAssessmentService.getAvailableAssessments(
                req.user.id
            );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

async function getAssessmentDetails(req, res, next) {
    try {
        const assessmentId = normalizeBigIntId(
            req.params.assessmentId
        );

        if (!assessmentId) {
            return res.status(400).json({
                success: false,
                message: "Invalid assessment ID"
            });
        }

        const result =
            await studentAssessmentService.getAssessmentDetails(
                req.user.id,
                assessmentId
            );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

async function startAssessment(req, res, next) {
    try {
        const assessmentId = normalizeBigIntId(
            req.params.assessmentId
        );

        if (!assessmentId) {
            return res.status(400).json({
                success: false,
                message: "Invalid assessment ID"
            });
        }

        const result =
            await studentAssessmentService.startAssessment(
                req.user.id,
                assessmentId
            );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

async function saveAssessmentAnswer(req, res, next) {
    try {
        const attemptId = normalizeBigIntId(
            req.params.attemptId
        );

        const questionId = normalizeBigIntId(
            req.body?.question_id
        );

        const selectedOptionIds =
            req.body?.selected_option_ids;

        if (!attemptId || !questionId) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt ID or question ID"
            });
        }

        if (
            !Array.isArray(selectedOptionIds) ||
            selectedOptionIds.some(
                id => !normalizeBigIntId(id)
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "selected_option_ids must be an array of valid BIGINT IDs"
            });
        }

        const result =
            await studentAssessmentService.saveAssessmentAnswer(
                req.user.id,
                attemptId,
                {
                    ...req.body,
                    question_id: questionId,
                    selected_option_ids:
                        selectedOptionIds.map(normalizeBigIntId)
                }
            );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

async function submitAssessment(req, res, next) {
    try {
        const attemptId = normalizeBigIntId(
            req.params.attemptId
        );

        if (!attemptId) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt ID"
            });
        }

        const result =
            await studentAssessmentService.submitAssessment(
                req.user.id,
                attemptId
            );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

async function getAssessmentResult(req, res, next) {
    try {
        const attemptId = normalizeBigIntId(
            req.params.attemptId
        );

        if (!attemptId) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt ID"
            });
        }

        const result =
            await studentAssessmentService.getAssessmentResult(
                req.user.id,
                attemptId
            );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

async function getAttemptDetails(req, res, next) {
    try {
        const attemptId = normalizeBigIntId(
            req.params.attemptId
        );

        if (!attemptId) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt ID"
            });
        }

        const result =
            await studentAssessmentService.getAttemptDetails(
                req.user.id,
                attemptId
            );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getAvailableAssessments,
    getAssessmentDetails,
    startAssessment,
    saveAssessmentAnswer,
    submitAssessment,
    getAssessmentResult,
    getAttemptDetails
};