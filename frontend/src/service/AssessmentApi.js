import api from "./Api";

// ============================================================
// COMMON RESPONSE HELPERS
// ============================================================

export function unwrapAssessmentResponse(response) {
    const body = response?.data ?? response;
    return body?.data ?? body;
}

export function getAssessmentError(error) {
    return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Something went wrong. Please try again."
    );
}

// Keep BIGINT IDs as strings.
export function normalizeAssessmentId(id) {
    if (id === null || id === undefined || id === "") {
        throw new Error("A valid assessment ID is required.");
    }

    const value = String(id);

    if (!/^[1-9]\d*$/.test(value)) {
        throw new Error("Invalid ID. Please provide a valid positive ID.");
    }

    return value;
}

// ============================================================
// INSTRUCTOR ASSESSMENT APIs
// Base route: /api/instructor
// ============================================================

export const instructorAssessmentApi = {
    // List assessments belonging to the logged-in instructor.
    list: () => api.get("/instructor/assessments"),

    // Create assessment.
    create: (payload) =>
        api.post("/instructor/assessments", payload),

    // Get assessment details.
    getDetails: (assessmentId) =>
        api.get(
            `/instructor/assessments/${normalizeAssessmentId(assessmentId)}`
        ),

    // Update assessment.
    update: (assessmentId, payload) =>
        api.put(
            `/instructor/assessments/${normalizeAssessmentId(assessmentId)}`,
            payload
        ),

    // Publish assessment.
    publish: (assessmentId) =>
        api.post(
            `/instructor/assessments/${normalizeAssessmentId(assessmentId)}/publish`
        ),

    // Attach an existing question to an assessment.
    attachQuestion: (assessmentId, payload) =>
        api.post(
            `/instructor/assessments/${normalizeAssessmentId(assessmentId)}/questions`,
            payload
        ),

    // Get assessment results.
    results: (assessmentId) =>
        api.get(
            `/instructor/assessments/${normalizeAssessmentId(assessmentId)}/results`
        ),

    // Get one attempt with answers for review.
    attempt: (assessmentId, attemptId) =>
        api.get(
            `/instructor/assessments/${normalizeAssessmentId(assessmentId)}/attempts/${normalizeAssessmentId(attemptId)}`
        ),

    // Save manual grades and publish the final result.
    evaluateAttempt: (assessmentId, attemptId, payload) =>
        api.post(
            `/instructor/assessments/${normalizeAssessmentId(assessmentId)}/attempts/${normalizeAssessmentId(attemptId)}/evaluate`,
            payload
        ),

    // ========================================================
    // INSTRUCTOR QUESTION BANK APIs
    // ========================================================

    // Create a question.
    createQuestion: (payload) =>
        api.post("/instructor/questions", payload),

    // Get one question with its options.
    getQuestion: (questionId) =>
        api.get(
            `/instructor/questions/${normalizeAssessmentId(questionId)}`
        ),

    // Update a question.
    updateQuestion: (questionId, payload) =>
        api.put(
            `/instructor/questions/${normalizeAssessmentId(questionId)}`,
            payload
        ),

    // Create question options.
    createOptions: (questionId, options) =>
        api.post(
            `/instructor/questions/${normalizeAssessmentId(questionId)}/options`,
            { options }
        ),

    // Update question options.
    updateOptions: (questionId, options) =>
        api.put(
            `/instructor/questions/${normalizeAssessmentId(questionId)}/options`,
            { options }
        )
};

// ============================================================
// STUDENT ASSESSMENT APIs
// Base route: /api/student
// ============================================================

export const studentAssessmentApi = {
    // Get all available assessments and latest attempt information.
    list: () =>
        api.get("/student/assessments"),

    // My Results uses the available assessment list and its latest
    // attempt fields. This does not call an unsupported endpoint.
    myResults: () =>
        api.get("/student/assessments"),

    // Get assessment details and questions.
    details: (assessmentId) =>
        api.get(
            `/student/assessments/${normalizeAssessmentId(assessmentId)}`
        ),

    // Start or resume an assessment.
    start: (assessmentId) =>
        api.post(
            `/student/assessments/${normalizeAssessmentId(assessmentId)}/start`
        ),

    // Get an attempt with saved answers.
    attempt: (attemptId) =>
        api.get(
            `/student/assessments/attempts/${normalizeAssessmentId(attemptId)}`
        ),

    // Save student's answer.
    saveAnswer: (attemptId, payload) =>
        api.post(
            `/student/assessments/attempts/${normalizeAssessmentId(attemptId)}/answers`,
            payload
        ),

    // Submit assessment.
    submit: (attemptId) =>
        api.post(
            `/student/assessments/attempts/${normalizeAssessmentId(attemptId)}/submit`
        ),

    // Get assessment result.
    result: (attemptId) =>
        api.get(
            `/student/assessments/attempts/${normalizeAssessmentId(attemptId)}/result`
        )
};