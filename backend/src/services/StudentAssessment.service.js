const repository = require("../repositories/studentAssessment.repository");
const lessonProgressService = require("./lessonProgress.service");

const START_ERRORS = {
    ASSESSMENT_NOT_AVAILABLE: {
        statusCode: 404,
        message: "Assessment not found or not available for this student"
    },
    ASSESSMENT_NOT_STARTED: {
        statusCode: 409,
        message: "This assessment is not available yet"
    },
    ASSESSMENT_CLOSED: {
        statusCode: 409,
        message: "This assessment is no longer accepting attempts"
    },
    NO_ASSESSMENT_QUESTIONS: {
        statusCode: 409,
        message: "This assessment has no active questions"
    },
    MAX_ATTEMPTS_REACHED: {
        statusCode: 409,
        message: "Maximum assessment attempts reached"
    },
    RESULT_PENDING: {
        statusCode: 409,
        message: "Your previous attempt is awaiting instructor evaluation"
    }
};

const ANSWER_ERRORS = {
    ATTEMPT_NOT_FOUND: {
        statusCode: 404,
        message: "Assessment attempt not found"
    },
    ATTEMPT_NOT_ACTIVE: {
        statusCode: 409,
        message: "Assessment attempt is not in progress"
    },
    ATTEMPT_EXPIRED: {
        statusCode: 409,
        message: "Assessment time has expired"
    },
    QUESTION_NOT_FOUND: {
        statusCode: 404,
        message: "Question not found in this assessment"
    },
    INVALID_OPTIONS: {
        statusCode: 400,
        message: "Invalid selected options"
    },
    INVALID_ANSWER_TEXT: {
        statusCode: 400,
        message: "Answer text must be a string"
    },
    ANSWER_REQUIRED: {
        statusCode: 400,
        message: "Please provide an answer"
    },
    CHOOSE_ONE_ANSWER_FORMAT: {
        statusCode: 400,
        message: "Provide either selected options or answer text, not both"
    },
    ONLY_ONE_OPTION_ALLOWED: {
        statusCode: 400,
        message: "Only one option is allowed for this question"
    },
    INVALID_QUESTION_OPTIONS: {
        statusCode: 400,
        message: "One or more options do not belong to this question"
    },
    UNSUPPORTED_QUESTION_TYPE: {
        statusCode: 400,
        message: "This question type is not supported"
    }
};

const SUBMIT_ERRORS = {
    ATTEMPT_NOT_FOUND: {
        statusCode: 404,
        message: "Assessment attempt not found"
    },
    ATTEMPT_NOT_ACTIVE: {
        statusCode: 409,
        message: "Assessment attempt is not in progress"
    },
    NO_ASSESSMENT_QUESTIONS: {
        statusCode: 409,
        message: "Assessment has no active questions"
    },
    CORRECT_ANSWER_NOT_CONFIGURED: {
        statusCode: 409,
        message: "A correct option has not been configured for a question"
    }
};

async function getAvailableAssessments(userId) {
    const assessments = await repository.getAvailableAssessments(userId);

    return {
        statusCode: 200,
        body: {
            success: true,
            message: "Available assessments retrieved successfully",
            data: {
                assessments
            }
        }
    };
}

async function getAssessmentDetails(userId, assessmentId) {
    const details = await repository.getAssessmentDetails(userId, assessmentId);

    if (!details) {
        return {
            statusCode: 404,
            body: {
                success: false,
                message: "Assessment not found or not available for this student"
            }
        };
    }

    const attempts = await repository.getStudentAttemptsForAssessment(
        userId,
        assessmentId
    );

    const assessment = details.assessment;
    const attemptCount = attempts.length;
    const inProgressAttempt = attempts.find(
        attempt => attempt.status === "IN_PROGRESS"
    );
    const latestAttempt = attempts[0] || null;
    const bestEvaluatedAttempt = attempts
        .filter(attempt => attempt.status === "EVALUATED")
        .sort((a, b) => Number(b.percentage) - Number(a.percentage))[0] || null;

    return {
        statusCode: 200,
        body: {
            success: true,
            message: "Assessment details retrieved successfully",
            data: {
                ...details,
                attempts,
                attempt_count: attemptCount,
                attempts_remaining:
                    assessment.max_attempts === null
                        ? null
                        : Math.max(Number(assessment.max_attempts) - attemptCount, 0),
                can_start:
                    !inProgressAttempt &&
                    latestAttempt?.status !== "SUBMITTED" &&
                    (assessment.max_attempts === null ||
                        attemptCount < Number(assessment.max_attempts)),
                in_progress_attempt: inProgressAttempt || null,
                latest_attempt: latestAttempt,
                best_attempt: bestEvaluatedAttempt
            }
        }
    };
}

async function startAssessment(userId, assessmentId) {
    const result = await repository.startAssessment(userId, assessmentId);

    if (result.error && START_ERRORS[result.error]) {
        return {
            statusCode: START_ERRORS[result.error].statusCode,
            body: {
                success: false,
                message: START_ERRORS[result.error].message
            }
        };
    }

    const attempt = result.attempt;
    const durationMinutes =
        result.duration_minutes === null || result.duration_minutes === undefined
            ? null
            : Number(result.duration_minutes);

    const endsAt = durationMinutes === null
        ? null
        : new Date(
            new Date(attempt.started_at).getTime() + durationMinutes * 60 * 1000
        ).toISOString();

    return {
        statusCode: result.resumed ? 200 : 201,
        body: {
            success: true,
            message: result.resumed
                ? "Existing assessment attempt resumed successfully"
                : "Assessment started successfully",
            data: {
                attempt_id: attempt.attempt_id,
                assessment_id: attempt.assessment_id,
                enrollment_id: attempt.enrollment_id,
                attempt_number: attempt.attempt_number,
                status: attempt.status,
                started_at: attempt.started_at,
                ends_at: endsAt,
                duration_minutes: durationMinutes,
                total_questions: attempt.total_questions,
                total_marks: attempt.total_marks,
                passing_percentage: attempt.passing_percentage,
                resumed: result.resumed
            }
        }
    };
}

async function saveAssessmentAnswer(userId, attemptId, payload) {
    const result = await repository.saveAssessmentAnswer(
        userId,
        attemptId,
        payload
    );

    if (result.error && ANSWER_ERRORS[result.error]) {
        return {
            statusCode: ANSWER_ERRORS[result.error].statusCode,
            body: {
                success: false,
                message: ANSWER_ERRORS[result.error].message
            }
        };
    }

    return {
        statusCode: 200,
        body: {
            success: true,
            message: "Assessment answer saved successfully",
            data: result
        }
    };
}

async function submitAssessment(userId, attemptId) {
    const result = await repository.submitAssessment(userId, attemptId);

    if (result.error && SUBMIT_ERRORS[result.error]) {
        return {
            statusCode: SUBMIT_ERRORS[result.error].statusCode,
            body: {
                success: false,
                message: SUBMIT_ERRORS[result.error].message
            }
        };
    }

    if (result.result?.assessment_id && result.result?.enrollment_id) {
        try {
            await lessonProgressService.refreshCourseProgressForAssessment({
                assessmentId: result.result.assessment_id,
                enrollmentId: result.result.enrollment_id,
                userId
            });
        } catch (progressError) {
            // The assessment submission is already committed; keep it successful
            // and let the next course load recalculate the displayed progress.
            console.error("Failed to refresh course progress after assessment submission:", progressError);
        }
    }

    const evaluationPending = result.result.requires_manual_evaluation === true;

    return {
        statusCode: 200,
        body: {
            success: true,
            message: evaluationPending
                ? "Assessment submitted successfully. Your written answers are awaiting instructor evaluation."
                : "Assessment submitted and evaluated successfully",
            data: result.result
        }
    };
}

async function getAssessmentResult(userId, attemptId) {
    const result = await repository.getAssessmentResult(userId, attemptId);

    if (!result) {
        return {
            statusCode: 404,
            body: {
                success: false,
                message: "Assessment result not found"
            }
        };
    }

    const status = String(result.status || "").toUpperCase();

    if (!["EVALUATED", "SUBMITTED"].includes(status)) {
        return {
            statusCode: 409,
            body: {
                success: false,
                message: "Assessment result is not available yet"
            }
        };
    }

    return {
        statusCode: 200,
        body: {
            success: true,
            message: status === "SUBMITTED"
                ? "Assessment submitted. Awaiting instructor evaluation."
                : "Assessment result retrieved successfully",
            data: result
        }
    };
}

async function getAttemptDetails(userId, attemptId) {
    const details = await repository.getAttemptDetails(userId, attemptId);

    if (!details) {
        return {
            statusCode: 404,
            body: {
                success: false,
                message: "Assessment attempt not found"
            }
        };
    }

    return {
        statusCode: 200,
        body: {
            success: true,
            message: "Assessment attempt retrieved successfully",
            data: details
        }
    };
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
