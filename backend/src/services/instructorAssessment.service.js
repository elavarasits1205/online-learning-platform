const pool = require("../config/database");
const crypto = require("crypto");
const repo = require("../repositories/instructorAssessment.repository");
const certificateRepository = require("../repositories/certificate.repository");
const notificationRepository =
    require("../repositories/notification.repository");
const lessonProgressService = require("./lessonProgress.service");

const CHOICE_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"];
const TEXT_TYPES = ["SHORT_TEXT", "LONG_TEXT"];

// Validate and normalize PostgreSQL BIGINT IDs.
// Return a string to avoid JavaScript precision loss.
function normalizeBigIntId(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const id = String(value).trim();

    // PostgreSQL BIGINT identifiers must be positive integers.
    if (!/^[1-9]\d*$/.test(id)) {
        return null;
    }

    try {
        const parsed = BigInt(id);

        // PostgreSQL BIGINT maximum value.
        const maxBigInt = 9223372036854775807n;

        if (parsed > maxBigInt) {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
}

// Throw a validation error when the supplied ID is invalid.
function requireBigIntId(value, fieldName = "id") {
    const id = normalizeBigIntId(value);

    if (!id) {
        throw httpError(`Valid BIGINT ${fieldName} is required.`);
    }

    return id;
}

function normalizeIdList(values) {
    return [...new Set((values || []).map(Number).filter(Number.isSafeInteger))].sort(
        (a, b) => a - b
    );
}

function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function httpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function createAssessment(userId, input) {
    const {
        course_id, module_id = null, title, description = null,
        assessment_type, instructions = null, duration_minutes = null,
        pass_percentage = 40, max_attempts = null
    } = input;

    if (!course_id || !title?.trim()) throw httpError("course_id and title are required.");
    const type = String(assessment_type || "").toUpperCase();
    if (!["MODULE", "COURSE"].includes(type)) throw httpError("assessment_type must be MODULE or COURSE.");
    if ((type === "MODULE" && !module_id) || (type === "COURSE" && module_id != null)) {
        throw httpError("MODULE assessments require module_id; COURSE assessments must not have module_id.");
    }
    if (!Number.isFinite(Number(pass_percentage)) || Number(pass_percentage) < 0 || Number(pass_percentage) > 100) {
        throw httpError("pass_percentage must be between 0 and 100.");
    }
    if (duration_minutes != null && (!Number.isInteger(Number(duration_minutes)) || Number(duration_minutes) <= 0)) {
        throw httpError("duration_minutes must be a positive integer.");
    }
    if (max_attempts != null && (!Number.isInteger(Number(max_attempts)) || Number(max_attempts) <= 0)) {
        throw httpError("max_attempts must be a positive integer.");
    }

    const instructorId = await repo.getInstructorId(userId);
    if (!instructorId) throw httpError("Active instructor profile not found.", 403);
    if (!(await repo.ownsCourse(userId, course_id))) throw httpError("You are not assigned to this course.", 403);

    if (type === "MODULE" && !(await repo.moduleBelongsToCourse(module_id, course_id))) {
        throw httpError("The selected module does not belong to this course.");
    }

    return repo.createAssessment({
        course_id, module_id,
        assessment_code: `ASM-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
        title: title.trim(), description, assessment_type: type, instructions,
        duration_minutes, pass_percentage: Number(pass_percentage), max_attempts,
        status: "DRAFT", userId
    });
}

async function listAssessments(userId) {
    return repo.listAssessments(userId);
}

async function getAssessmentDetails(userId, assessmentId) {
    const id = Number(assessmentId);
    if (!Number.isInteger(id) || id <= 0) throw httpError("Valid assessmentId is required.");
    const assessment = await repo.getAssessmentByInstructor(userId, id);
    if (!assessment) throw httpError("Assessment not found or you do not have access.", 404);

    const questions = await repo.getAssessmentQuestions(id);
    if (questions.length) {
        const options = await repo.getQuestionOptions(questions.map(q => q.question_id));
        const byQuestion = new Map();
        for (const option of options) {
            if (!byQuestion.has(option.question_id)) byQuestion.set(option.question_id, []);
            byQuestion.get(option.question_id).push(option);
        }
        for (const question of questions) question.options = byQuestion.get(question.question_id) || [];
    }
    return { ...assessment, questions };
}

async function updateAssessment(userId, assessmentId, input) {
    const id = Number(assessmentId);
    if (!Number.isInteger(id) || id <= 0) throw httpError("Valid assessmentId is required.");

    const allowedFields = [
        "title", "description", "instructions", "duration_minutes",
        "pass_percentage", "max_attempts", "passing_required",
        "randomize_questions", "randomize_options", "show_result_immediately",
        "allow_review_after_submission", "available_from", "available_until"
    ];
    const hasOwn = field => Object.prototype.hasOwnProperty.call(input, field);
    const updates = {};
    for (const field of allowedFields) if (hasOwn(field)) updates[field] = input[field];
    if (!Object.keys(updates).length) throw httpError("At least one valid field is required.");

    if (hasOwn("title")) {
        if (typeof updates.title !== "string" || !updates.title.trim()) throw httpError("Title cannot be empty.");
        updates.title = updates.title.trim();
    }
    if (hasOwn("duration_minutes") && updates.duration_minutes !== null &&
        (!Number.isInteger(Number(updates.duration_minutes)) || Number(updates.duration_minutes) <= 0)) {
        throw httpError("duration_minutes must be a positive integer or null.");
    }
    if (hasOwn("max_attempts") && updates.max_attempts !== null &&
        (!Number.isInteger(Number(updates.max_attempts)) || Number(updates.max_attempts) <= 0)) {
        throw httpError("max_attempts must be a positive integer or null.");
    }
    if (hasOwn("pass_percentage") &&
        (!Number.isFinite(Number(updates.pass_percentage)) || Number(updates.pass_percentage) < 0 || Number(updates.pass_percentage) > 100)) {
        throw httpError("pass_percentage must be between 0 and 100.");
    }
    for (const field of ["passing_required", "randomize_questions", "randomize_options", "show_result_immediately", "allow_review_after_submission"]) {
        if (hasOwn(field) && typeof updates[field] !== "boolean") throw httpError(`${field} must be a boolean.`);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const assessment = await repo.getAssessmentStatusForUpdate(client, id, userId);
        if (!assessment) throw httpError("Assessment not found or you do not have access.", 404);
        if (assessment.status !== "DRAFT") throw httpError("Only DRAFT assessments can be updated.");

        for (const field of ["available_from", "available_until"]) {
            if (hasOwn(field) && updates[field] !== null) {
                const date = new Date(updates[field]);
                if (Number.isNaN(date.getTime())) throw httpError(`${field} must be a valid date.`);
                updates[field] = date.toISOString();
            }
        }

        const currentDates = await repo.getAssessmentDates(client, id);
        const from = hasOwn("available_from") ? updates.available_from : currentDates.available_from;
        const until = hasOwn("available_until") ? updates.available_until : currentDates.available_until;
        if (from && until && new Date(until) < new Date(from)) {
            throw httpError("available_until must be after or equal to available_from.");
        }

        const result = await repo.updateAssessmentRecord(client, id, userId, updates);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function createQuestion(userId, input) {
    const {
        question_text, question_type, explanation = null,
        default_marks = 1, negative_marks = 0, difficulty_level = "MEDIUM"
    } = input;
    if (typeof question_text !== "string" || !question_text.trim()) throw httpError("question_text is required.");

    const type = String(question_type || "").trim().toUpperCase();
    const difficulty = String(difficulty_level).trim().toUpperCase();
    const allowedTypes = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_TEXT", "LONG_TEXT"];
    if (!allowedTypes.includes(type)) throw httpError("question_type must be SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_TEXT or LONG_TEXT.");
    if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) throw httpError("difficulty_level must be EASY, MEDIUM or HARD.");
    if (!Number.isFinite(Number(default_marks)) || Number(default_marks) < 0) throw httpError("default_marks must be a non-negative number.");
    if (!Number.isFinite(Number(negative_marks)) || Number(negative_marks) < 0) throw httpError("negative_marks must be a non-negative number.");

    if (!(await repo.getInstructorId(userId))) throw httpError("Active instructor profile not found.", 403);
    return repo.createQuestion({
        question_code: `QUE-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
        question_text: question_text.trim(), question_type: type, explanation,
        default_marks: Number(default_marks), negative_marks: Number(negative_marks),
        difficulty_level: difficulty, userId
    });
}

async function updateQuestion(userId, questionId, input) {
    const id = requireBigIntId(questionId, "questionId");

    const allowed = ["question_text", "explanation", "default_marks", "negative_marks", "difficulty_level"];
    const updates = {};
    for (const field of allowed) if (Object.prototype.hasOwnProperty.call(input, field)) updates[field] = input[field];
    if (!Object.keys(updates).length) throw httpError("At least one valid field is required.");

    if (Object.hasOwn(updates, "question_text")) {
        if (typeof updates.question_text !== "string" || !updates.question_text.trim()) throw httpError("question_text cannot be empty.");
        updates.question_text = updates.question_text.trim();
    }
    for (const field of ["default_marks", "negative_marks"]) {
        if (Object.hasOwn(updates, field)) {
            const value = Number(updates[field]);
            if (!Number.isFinite(value) || value < 0) throw httpError(`${field} must be a non-negative number.`);
            updates[field] = value;
        }
    }
    if (Object.hasOwn(updates, "difficulty_level")) {
        const difficulty = String(updates.difficulty_level || "").trim().toUpperCase();
        if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) throw httpError("difficulty_level must be EASY, MEDIUM or HARD.");
        updates.difficulty_level = difficulty;
    }
    if (Object.hasOwn(updates, "explanation") && updates.explanation !== null && typeof updates.explanation !== "string") {
        throw httpError("explanation must be a string or null.");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const question = await repo.getQuestionByInstructor(client, id, userId);
        if (!question) throw httpError("Question not found or you do not have permission to update it.", 404);
        const result = await repo.updateQuestion(client, id, userId, updates);
        if (!result) throw httpError("Question could not be updated.", 404);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
async function createQuestionOptions(userId, questionId, options) {
    const id = requireBigIntId(questionId, "questionId");
    if (!Array.isArray(options) || options.length < 2) throw httpError("At least two options are required.");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const question = await repo.getQuestionByInstructor(client, id, userId);
        if (!question) throw httpError("Question not found or you do not have permission to edit it.", 404);
        const existing = await repo.getExistingQuestionOptions(client, id);
        if (existing.length) throw httpError("Options already exist for this question. Use update options instead.", 409);

        const type = question.question_type;
        if (!["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(type)) {
            throw httpError("Options can only be added to choice-based questions.");
        }
        const correctCount = options.filter(o => o.is_correct === true).length;
        if (correctCount < 1) throw httpError("At least one correct option is required.");
        if (type === "SINGLE_CHOICE" && correctCount !== 1) {
            throw httpError("SINGLE_CHOICE questions must have exactly one correct option.");
        }

        const seenCodes = new Set();
        const normalized = options.map((option, index) => {
            const option_code = String(option.option_code || "").trim();
            const option_text = String(option.option_text || "").trim();
            if (!option_code || !option_text) throw httpError("Every option must include option_code and option_text.");
            if (seenCodes.has(option_code)) throw httpError("Option codes must be unique.");
            seenCodes.add(option_code);
            const display_order = Number(option.display_order ?? index + 1);
            if (!Number.isInteger(display_order) || display_order <= 0) throw httpError("display_order must be a positive integer.");
            return { option_code, option_text, display_order, is_correct: option.is_correct === true, explanation: option.explanation ?? null };
        });
        if (type === "TRUE_FALSE" && normalized.length !== 2) throw httpError("TRUE_FALSE questions must have exactly two options.");

        const saved = await repo.createQuestionOptions(client, id, normalized, userId);
        await client.query("COMMIT");
        return saved;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function updateQuestionOptions(userId, questionId, options) {
    const id = requireBigIntId(questionId, "questionId");
    if (!Array.isArray(options) || options.length < 2) throw httpError("At least two options are required.");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const question = await repo.getQuestionByInstructor(client, id, userId);
        if (!question) throw httpError("Question not found or you do not have permission to edit it.", 404);
        const type = question.question_type;
        if (!["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(type)) {
            throw httpError("Options can only be updated for choice-based questions.");
        }

        const correctCount = options.filter(o => o.is_correct === true).length;
        if (correctCount < 1) throw httpError("At least one correct option is required.");
        if (type === "SINGLE_CHOICE" && correctCount !== 1) {
            throw httpError("SINGLE_CHOICE questions must have exactly one correct option.");
        }
        if (type === "TRUE_FALSE" && options.length !== 2) {
            throw httpError("TRUE_FALSE questions must have exactly two options.");
        }

        const seenCodes = new Set();
        const seenOrders = new Set();
        const normalized = options.map((option, index) => {
            const option_code = String(option.option_code || "").trim();
            const option_text = String(option.option_text || "").trim();
            const display_order = Number(option.display_order ?? index + 1);
            if (!option_code || option_code.length > 10 || !option_text ||
                !Number.isInteger(display_order) || display_order <= 0) {
                throw httpError("Invalid option code, text or display order.");
            }
            if (seenCodes.has(option_code) || seenOrders.has(display_order)) {
                throw httpError("Option codes and display orders must be unique.");
            }
            seenCodes.add(option_code);
            seenOrders.add(display_order);
            const optionId = option.id == null || option.id === "" ? null : normalizeBigIntId(option.id);
            if (option.id != null && option.id !== "" && !optionId) {
                throw httpError("Option id must be a valid BIGINT identifier.");
            }
            return {
                id: optionId,
                option_code, option_text, display_order,
                is_correct: option.is_correct === true,
                explanation: option.explanation ?? null
            };
        });

        const existing = await repo.getExistingQuestionOptions(client, id);
        const existingById = new Map(existing.map(o => [String(o.id), o]));
        for (const option of normalized) {
            if (option.id !== null && !existingById.has(option.id)) {
                throw httpError("One or more option IDs do not belong to this question.");
            }
        }
        const submittedIds = normalized.filter(o => o.id !== null).map(o => o.id);
        const reservedRows = existing.filter(o => !submittedIds.includes(String(o.id)));
        for (const option of normalized) {
            if (reservedRows.some(row => row.option_code === option.option_code ||
                Number(row.display_order) === option.display_order)) {
                throw httpError("Option code or display order is already used by another option, including inactive options.", 409);
            }
        }

        let temporaryOrder = 1000000000;
        for (const option of normalized.filter(o => o.id !== null)) {
            await repo.moveQuestionOptionToTemporaryValues(client, option.id, id,
                `T${crypto.randomUUID().replace(/-/g, "").slice(0, 9)}`,
                temporaryOrder++);
        }

        const saved = [];
        for (const option of normalized) {
            const result = option.id !== null
                ? await repo.updateQuestionOption(client, option, userId, id)
                : await repo.insertQuestionOption(client, option, userId, id);
            saved.push(result);
        }

        const omittedIds = existing
            .filter(o => o.is_active && !submittedIds.includes(String(o.id)))
            .map(o => String(o.id));
        await repo.deactivateQuestionOptions(client, id, userId, omittedIds);

        await client.query("COMMIT");
        return saved;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function attachQuestionToAssessment(userId, assessmentId, input) {
    const { question_id, question_number, marks, negative_marks = 0, is_mandatory = true } = input;
    const id = requireBigIntId(assessmentId, "assessmentId");
    const qid = requireBigIntId(question_id, "question_id");
    const number = Number(question_number);
    const questionMarks = Number(marks);
    const negativeMarks = Number(negative_marks);

    if (!Number.isInteger(number) || number <= 0) {
        throw httpError("Valid assessmentId, question_id and question_number are required.");
    }
    if (!Number.isFinite(questionMarks) || questionMarks <= 0 ||
        !Number.isFinite(negativeMarks) || negativeMarks < 0) {
        throw httpError("marks must be greater than zero and negative_marks must be non-negative.");
    }
    if (typeof is_mandatory !== "boolean") throw httpError("is_mandatory must be a boolean.");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const assessment = await repo.getAssessmentForUpdate(client, userId, id);
        if (!assessment) throw httpError("Assessment not found or you do not have access.", 404);
        if (assessment.status !== "DRAFT") throw httpError("Questions can only be attached to DRAFT assessments.");

        const question = await repo.getQuestionForUpdate(client, qid, userId);
        if (!question) throw httpError("Question not found or you do not have permission to use it.", 404);

        if (assessment.assessment_type === "MODULE" && assessment.module_id !== null &&
            !(await repo.moduleBelongsToCourse(assessment.module_id, assessment.course_id))) {
            throw httpError("Assessment module does not belong to its course.");
        }
        if (await repo.questionAlreadyAttached(client, id, qid)) {
            throw httpError("This question is already attached to the assessment.", 409);
        }
        if (await repo.questionNumberAlreadyUsed(client, id, number)) {
            throw httpError("This question number is already used in the assessment.", 409);
        }

        const questionRow = await repo.insertAssessmentQuestion(client, {
            assessmentId: id, questionId: qid, questionNumber: number,
            marks: questionMarks, negativeMarks, isMandatory: is_mandatory, userId
        });
        const totalMarks = await repo.recalculateAssessmentTotalMarks(client, id, userId);
        await client.query("COMMIT");
        return { question: questionRow, total_marks: totalMarks };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function getQuestionWithOptions(userId, questionId) {
    const id = requireBigIntId(questionId, "questionId");
    const question = await repo.getQuestionDetails(id, userId);
    if (!question) throw httpError("Question not found or you do not have permission to view it.", 404);
    const options = await repo.getActiveQuestionOptions(id);
    return { ...question, options };
}

async function publishAssessment(userId, assessmentId) {
    const id = requireBigIntId(assessmentId, "assessmentId");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const assessment = await repo.getAssessmentForPublish(client, userId, id);
        if (!assessment) throw httpError("Assessment not found or you do not have access.", 404);
        if (assessment.status !== "DRAFT") throw httpError("Only DRAFT assessments can be published.");

        const questions = await repo.getQuestionsForPublish(client, id);
        if (!questions.length) throw httpError("Add at least one active question before publishing.");

        const totalMarks = questions.reduce((total, q) => total + Number(q.marks), 0);
        if (!Number.isFinite(totalMarks) || totalMarks <= 0) throw httpError("Assessment total marks must be greater than zero.");

        const choiceQuestions = questions.filter(q =>
            ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(q.question_type));
        if (choiceQuestions.length) {
            const counts = await repo.getChoiceQuestionOptionCounts(client,
                choiceQuestions.map(q => q.question_id));
            const byQuestion = new Map(counts.map(row => [String(row.question_id), {
                optionCount: Number(row.option_count), correctCount: Number(row.correct_count)
            }]));
            for (const question of choiceQuestions) {
                const data = byQuestion.get(String(question.question_id));
                if (!data || data.optionCount < 2) {
                    throw httpError(`Question ${question.question_id} needs at least two active options.`);
                }
                if (question.question_type === "SINGLE_CHOICE" && data.correctCount !== 1) {
                    throw httpError(`Question ${question.question_id} must have exactly one correct option.`);
                }
                if (question.question_type === "MULTIPLE_CHOICE" && data.correctCount < 1) {
                    throw httpError(`Question ${question.question_id} needs at least one correct option.`);
                }
                if (question.question_type === "TRUE_FALSE" &&
                    (data.optionCount !== 2 || data.correctCount !== 1)) {
                    throw httpError(`TRUE_FALSE question ${question.question_id} must have exactly two active options and one correct option.`);
                }
            }
        }

        const result = await repo.publishAssessmentRecord(client, id, totalMarks, userId);
        await client.query("COMMIT");

        try {
            await notificationRepository.notifyCourseStudents(
                assessment.course_id,
                {
                    notificationType: "ASSESSMENT_PUBLISHED",
                    title: `New assessment: ${assessment.title}`,
                    message: `${assessment.title} is now available in ${assessment.course_title}.`,
                    preferenceKey: "assignmentAssessment",
                    createdBy: userId
                },
                client
            );
        } catch (notificationError) {
            console.error(
                "Failed to notify students about the new assessment:",
                notificationError
            );
        }

        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function getAssessmentResults(userId, assessmentId) {
    const id = requireBigIntId(assessmentId, "assessmentId");
    const assessment = await repo.getAssessmentResultsByInstructor(userId, id);
    if (!assessment) throw httpError("Assessment not found or you do not have access.", 404);
    const rows = await repo.getAssessmentAttempts(id);
    const results = rows.map(row => ({
        ...row,
        student_name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim()
    }));
    return {
        assessment,
        total_attempts: results.length,
        evaluated_attempts: results.filter(row => row.status === "EVALUATED").length,
        pending_attempts: results.filter(row => row.status === "SUBMITTED").length,
        results
    };
}

async function getAssessmentAttemptDetail(userId, assessmentId, attemptId) {
    const id = requireBigIntId(assessmentId, "assessmentId");
    const attempt = requireBigIntId(attemptId, "attemptId");

    const header = await repo.getAttemptDetailForInstructor(userId, id, attempt);
    if (!header) throw httpError("Assessment attempt not found or you do not have access.", 404);

    const questionRows = await repo.getAssessmentQuestions(id);
    const options = questionRows.length
        ? await repo.getQuestionOptions(questionRows.map(row => row.question_id))
        : [];
    const savedAnswers = await repo.getAttemptAnswers(pool, attempt);

    const optionsByQuestion = new Map();
    for (const option of options) {
        if (!optionsByQuestion.has(option.question_id)) {
            optionsByQuestion.set(option.question_id, []);
        }
        optionsByQuestion.get(option.question_id).push(option);
    }

    const answerByQuestion = new Map(
        savedAnswers.map(answer => [answer.question_id, answer])
    );

    const questions = questionRows.map(row => {
        const answer = answerByQuestion.get(row.question_id) || null;
        const selectedIds = normalizeIdList(answer?.selected_option_ids);
        const questionOptions = (optionsByQuestion.get(row.question_id) || []).map(option => ({
            ...option,
            is_selected: selectedIds.includes(String(option.id))
        }));

        return {
            question_id: row.question_id,
            assessment_question_id: row.assessment_question_id,
            question_number: row.question_number,
            question_text: row.question_text,
            question_type: row.question_type,
            explanation: row.explanation,
            marks: row.marks,
            negative_marks: row.negative_marks,
            is_mandatory: row.is_mandatory,
            options: questionOptions,
            answer_id: answer?.answer_id ?? null,
            answer_text: answer?.answer_text ?? null,
            is_answered: answer?.is_answered === true,
            is_correct: answer?.is_correct ?? null,
            marks_awarded: answer?.marks_awarded ?? 0,
            evaluation_comment: answer?.evaluation_comment ?? null,
            selected_option_ids: selectedIds,
            requires_manual_evaluation:
                TEXT_TYPES.includes(String(row.question_type || "").toUpperCase()) &&
                hasText(answer?.answer_text) &&
                (answer?.is_correct === null || answer?.is_correct === undefined)
        };
    });

    return {
        attempt: {
            ...header,
            student_name: [header.first_name, header.last_name].filter(Boolean).join(" ").trim()
        },
        questions,
        certificate: header.certificate_id
            ? {
                id: header.certificate_id,
                certificate_number: header.certificate_number,
                certificate_url: header.certificate_url,
                verification_code: header.verification_code,
                issue_date: header.issue_date,
                certificate_title: header.certificate_title,
                status: header.certificate_status
            }
            : null
    };
}

async function evaluateAssessmentAttempt(userId, assessmentId, attemptId, input = {}) {
    const id = requireBigIntId(assessmentId, "assessmentId");
    const attempt = requireBigIntId(attemptId, "attemptId");

    const rawGrades = Array.isArray(input.answers)
        ? input.answers
        : Array.isArray(input.grades)
            ? input.grades
            : [];

    const gradeByQuestion = new Map();
    for (const grade of rawGrades) {
        const questionId = normalizeBigIntId(grade.question_id ?? grade.questionId);
        if (!questionId) {
            throw httpError("Each grade must include a valid BIGINT question_id.");
        }
        if (gradeByQuestion.has(questionId)) {
            throw httpError(`Duplicate grade supplied for question ${questionId}.`);
        }
        gradeByQuestion.set(questionId, grade);
    }

    const publish = input.publish !== false;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const attemptRow = await repo.getAttemptForUpdate(client, userId, attempt);
        if (!attemptRow) {
            throw httpError("Assessment attempt not found or you do not have access.", 404);
        }
        if (String(attemptRow.assessment_id) !== id) {
            throw httpError("Assessment attempt does not belong to this assessment.", 400);
        }
        if (attemptRow.status !== "SUBMITTED") {
            throw httpError("Only SUBMITTED attempts can be evaluated. EVALUATED attempts are locked.", 409);
        }

        const questions = await repo.getAttemptQuestionRows(client, attempt, id);
        if (!questions.length) throw httpError("Assessment has no active questions.", 409);
        const attemptQuestionIds = new Set(questions.map(question => String(question.question_id)));
        for (const questionId of gradeByQuestion.keys()) {
            if (!attemptQuestionIds.has(questionId)) {
                throw httpError(`Question ${questionId} does not belong to this attempt.`);
            }
        }

        const manuallyGraded = new Set();
        let pendingManual = 0;

        for (const question of questions) {
            const grade = gradeByQuestion.get(String(question.question_id));
            const type = String(question.question_type || "").toUpperCase();
            const selected = normalizeIdList(question.selected_option_ids);
            const answerText = hasText(question.answer_text) ? question.answer_text.trim() : "";
            const hasAnswer = question.is_answered === true &&
                (selected.length > 0 || answerText.length > 0);
            const isTextQuestion = TEXT_TYPES.includes(type);

            if (grade) {
                if (!isTextQuestion) {
                    throw httpError(`Question ${question.question_number} is objective and must be auto-graded.`);
                }
                if (!hasAnswer) {
                    throw httpError(`Question ${question.question_number} has no submitted written answer to grade.`);
                }
                if (Object.prototype.hasOwnProperty.call(grade, "is_correct") && typeof grade.is_correct !== "boolean") {
                    throw httpError("is_correct must be a boolean when supplied.");
                }
                const marks = Number(grade.marks_awarded ?? grade.marks ?? 0);
                const maxMarks = Number(question.marks);

                if (!Number.isFinite(marks) || marks < 0 || marks > maxMarks) {
                    throw httpError(
                        `Marks for question ${question.question_number} must be between 0 and ${maxMarks}.`
                    );
                }

                const isCorrect = Object.prototype.hasOwnProperty.call(grade, "is_correct")
                    ? grade.is_correct === true
                    : maxMarks > 0 && marks >= maxMarks;
                const comment = grade.evaluation_comment ?? grade.comment ?? null;

                if (question.answer_id) {
                    await repo.updateAnswerEvaluation(
                        client,
                        question.answer_id,
                        {
                            isCorrect,
                            marksAwarded: marks,
                            evaluationComment: comment
                        },
                        userId
                    );
                }

                question.is_correct = isCorrect;
                question.marks_awarded = marks;
                question.evaluation_comment = comment;
                manuallyGraded.add(String(question.question_id));
                continue;
            }

            if (isTextQuestion && hasAnswer &&
                (question.is_correct === null || question.is_correct === undefined)) {
                pendingManual++;
            }
        }

        if (publish && pendingManual > 0) {
            throw httpError(
                `Grade all ${pendingManual} written answer(s) before publishing the result.`,
                409
            );
        }

        let answeredQuestions = 0;
        let unansweredQuestions = 0;
        let correctAnswers = 0;
        let wrongAnswers = 0;
        let obtainedMarks = 0;
        let totalMarks = 0;

        for (const question of questions) {
            const marks = Number(question.marks);
            totalMarks += marks;

            const type = String(question.question_type || "").toUpperCase();
            const selected = normalizeIdList(question.selected_option_ids);
            const answerText = hasText(question.answer_text) ? question.answer_text.trim() : "";
            const hasAnswer = question.is_answered === true &&
                (selected.length > 0 || answerText.length > 0);

            if (!hasAnswer) {
                unansweredQuestions++;
                continue;
            }

            answeredQuestions++;

            if (question.is_correct === true) correctAnswers++;
            else if (question.is_correct === false) wrongAnswers++;

            if (manuallyGraded.has(String(question.question_id))) {
                obtainedMarks += Number(question.marks_awarded || 0);
            } else if (question.is_correct === true) {
                obtainedMarks += marks;
            } else if (question.is_correct === false && CHOICE_TYPES.includes(type)) {
                obtainedMarks -= Number(question.negative_marks || 0);
            }
        }

        obtainedMarks = Math.max(0, Math.min(obtainedMarks, totalMarks));

        const percentage = totalMarks > 0
            ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2))
            : 0;

        const passed = percentage >= Number(attemptRow.pass_percentage);

        const endTime = attemptRow.submitted_at
            ? new Date(attemptRow.submitted_at).getTime()
            : Date.now();
        const timeTakenSeconds = Math.max(
            0,
            Math.floor((endTime - new Date(attemptRow.started_at).getTime()) / 1000)
        );

        if (!publish) {
            await client.query("COMMIT");
            return getAssessmentAttemptDetail(userId, id, attempt);
        }

        const updatedAttempt = await repo.updateAttemptEvaluation(
            client,
            attempt,
            {
                totalQuestions: questions.length,
                answeredQuestions,
                correctAnswers,
                wrongAnswers,
                unansweredQuestions,
                totalMarks,
                obtainedMarks,
                percentage,
                passed,
                passingPercentage: attemptRow.pass_percentage,
                timeTakenSeconds
            },
            userId
        );

        // Passing a course assessment alone does not complete the course.
        // Certificate issuance remains controlled by the course-completion workflow.
        const certificate = null;

        await client.query("COMMIT");

        try {
            await notificationRepository.createForUser(
                {
                    userId: attemptRow.student_user_id,
                    notificationType: "ASSESSMENT_RESULT",
                    title: "Assessment result published",
                    message: `Your result for ${attemptRow.assessment_title} in ${attemptRow.course_title} is available.`,
                    preferenceKey: "assignmentAssessment",
                    createdBy: userId
                },
                client
            );
        } catch (notificationError) {
            console.error(
                "Failed to notify the student about the assessment result:",
                notificationError
            );
        }

        try {
            await lessonProgressService.refreshCourseProgressForAssessment({
                assessmentId: id,
                enrollmentId: attemptRow.enrollment_id,
                userId: attemptRow.student_user_id,
                actorId: userId
            });
        } catch (progressError) {
            // Grading is already committed; the course page can recalculate on its next load.
            console.error("Failed to refresh course progress after assessment evaluation:", progressError);
        }

        const detail = await getAssessmentAttemptDetail(userId, id, attempt);

        return {
            ...detail,
            result: updatedAttempt,
            certificate
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    createAssessment,
    listAssessments,
    getAssessmentDetails,
    updateAssessment,
    createQuestion,
    updateQuestion,
    createQuestionOptions,
    updateQuestionOptions,
    attachQuestionToAssessment,
    getQuestionWithOptions,
    publishAssessment,
    getAssessmentResults,
    getAssessmentAttemptDetail,
    evaluateAssessmentAttempt
};
