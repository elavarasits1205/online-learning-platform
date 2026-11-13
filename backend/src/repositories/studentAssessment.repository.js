const pool = require("../config/database");

const CHOICE_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"];
const TEXT_TYPES = ["SHORT_TEXT", "LONG_TEXT"];

// PostgreSQL BIGINT option/question identifiers are kept as strings.
function normalizeBigIntId(value) {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
    }

    const id = String(value ?? "").trim();
    return /^[1-9]\d*$/.test(id) ? id : null;
}

function normalizeIdList(values) {
    const ids = (Array.isArray(values) ? values : [])
        .map(normalizeBigIntId)
        .filter(Boolean);

    return [...new Set(ids)].sort((a, b) =>
        BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0
    );
}

function hasTextAnswer(value) {
    return typeof value === "string" && value.trim().length > 0;
}

async function getAvailableAssessments(userId) {
    const result = await pool.query(
        `SELECT
            a.id AS assessment_id,
            a.course_id,
            a.module_id,
            a.assessment_code,
            a.title,
            a.description,
            a.assessment_type,
            a.instructions,
            a.duration_minutes,
            a.total_marks,
            a.pass_percentage,
            a.max_attempts,
            a.passing_required,
            a.randomize_questions,
            a.randomize_options,
            a.show_result_immediately,
            a.allow_review_after_submission,
            a.status,
            a.available_from,
            a.available_until,
            a.is_active,
            c.title AS course_title,
            m.title AS module_title,
            e.id AS enrollment_id,
            COALESCE(attempt_stats.attempt_count, 0)::INTEGER AS attempt_count,
            COALESCE(attempt_stats.in_progress_count, 0)::INTEGER AS in_progress_count,
            latest_attempt.attempt_id AS latest_attempt_id,
            latest_attempt.attempt_number AS latest_attempt_number,
            latest_attempt.status AS latest_status,
            latest_attempt.percentage AS latest_percentage,
            latest_attempt.obtained_marks AS latest_obtained_marks,
            latest_attempt.total_marks AS latest_total_marks,
            COALESCE(latest_attempt.status = 'EVALUATED' AND latest_attempt.passed = TRUE, FALSE) AS latest_passed,
            EXISTS (
                SELECT 1
                FROM assessment.assessment_attempt passed_attempt
                WHERE passed_attempt.assessment_id = a.id
                  AND passed_attempt.enrollment_id = e.id
                  AND passed_attempt.status = 'EVALUATED'
                  AND passed_attempt.passed = TRUE
                  AND COALESCE(passed_attempt.soft_delete, FALSE) = FALSE
            ) AS has_passed,
            cert.id AS certificate_id,
            cert.certificate_number,
            cert.certificate_url,
            cert.verification_code,
            cert.issue_date
         FROM learning.student s
         JOIN learning.enrollment e
            ON e.student_id = s.id
         JOIN learning.course c
            ON c.id = e.course_id
         JOIN assessment.assessment a
            ON a.course_id = c.id
         LEFT JOIN learning.module m
            ON m.id = a.module_id
         LEFT JOIN LATERAL (
            SELECT
                COUNT(*)::INTEGER AS attempt_count,
                COUNT(*) FILTER (
                    WHERE aa.status = 'IN_PROGRESS'
                )::INTEGER AS in_progress_count
            FROM assessment.assessment_attempt aa
            WHERE aa.assessment_id = a.id
              AND aa.enrollment_id = e.id
              AND COALESCE(aa.soft_delete, FALSE) = FALSE
         ) attempt_stats ON TRUE
         LEFT JOIN LATERAL (
            SELECT
                aa.id AS attempt_id,
                aa.attempt_number,
                aa.status,
                aa.percentage,
                aa.obtained_marks,
                aa.total_marks,
                COALESCE(aa.passed, FALSE) AS passed
            FROM assessment.assessment_attempt aa
            WHERE aa.assessment_id = a.id
              AND aa.enrollment_id = e.id
              AND COALESCE(aa.soft_delete, FALSE) = FALSE
            ORDER BY aa.attempt_number DESC
            LIMIT 1
         ) latest_attempt ON TRUE
         LEFT JOIN result.certificate cert
            ON cert.enrollment_id = e.id
           AND cert.soft_delete = FALSE
           AND cert.status = 'ISSUED'
         WHERE s.user_id = $1
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND e.soft_delete = FALSE
           AND e.status IN ('ACTIVE', 'COMPLETED')
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE
           AND a.status = 'PUBLISHED'
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
         ORDER BY c.title, a.id DESC`,
        [userId]
    );

    return result.rows;
}

async function getAssessmentDetails(userId, assessmentId) {
    const assessmentResult = await pool.query(
        `SELECT
            a.id AS assessment_id,
            a.course_id,
            a.module_id,
            a.assessment_code,
            a.title,
            a.description,
            a.assessment_type,
            a.instructions,
            a.duration_minutes,
            a.total_marks,
            a.pass_percentage,
            a.max_attempts,
            a.passing_required,
            a.randomize_questions,
            a.randomize_options,
            a.show_result_immediately,
            a.allow_review_after_submission,
            a.status,
            a.available_from,
            a.available_until,
            a.is_active,
            c.title AS course_title,
            m.title AS module_title,
            e.id AS enrollment_id
         FROM assessment.assessment a
         JOIN learning.student s
            ON s.user_id = $1
         JOIN learning.enrollment e
            ON e.student_id = s.id
           AND e.course_id = a.course_id
         JOIN learning.course c
            ON c.id = a.course_id
         LEFT JOIN learning.module m
            ON m.id = a.module_id
         WHERE a.id = $2
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND e.soft_delete = FALSE
           AND e.status IN ('ACTIVE', 'COMPLETED')
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE
           AND a.status = 'PUBLISHED'
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
         LIMIT 1`,
        [userId, assessmentId]
    );

    if (assessmentResult.rows.length === 0) return null;

    const questionsResult = await pool.query(
        `SELECT
            aq.id AS assessment_question_id,
            aq.question_number,
            aq.marks,
            aq.negative_marks,
            aq.is_mandatory,
            aq.is_active AS assessment_question_is_active,
            q.id AS question_id,
            q.question_code,
            q.question_text,
            q.question_type,
            q.explanation,
            q.default_marks,
            q.difficulty_level,
            q.is_active AS question_is_active,
            qo.id AS option_id,
            qo.option_code,
            qo.option_text,
            qo.display_order,
            qo.is_active AS option_is_active
         FROM assessment.assessment_question aq
         JOIN assessment.question q
            ON q.id = aq.question_id
         LEFT JOIN assessment.question_option qo
            ON qo.question_id = q.id
           AND qo.is_active = TRUE
         WHERE aq.assessment_id = $1
           AND aq.is_active = TRUE
           AND q.is_active = TRUE
           AND q.soft_delete = FALSE
         ORDER BY aq.question_number ASC, qo.display_order ASC`,
        [assessmentId]
    );

    const questionMap = new Map();

    for (const row of questionsResult.rows) {
        if (!questionMap.has(row.question_id)) {
            questionMap.set(row.question_id, {
                question_id: row.question_id,
                assessment_question_id: row.assessment_question_id,
                question_number: row.question_number,
                question_text: row.question_text,
                question_code: row.question_code,
                question_type: row.question_type,
                explanation: row.explanation,
                marks: row.marks,
                negative_marks: row.negative_marks,
                is_mandatory: row.is_mandatory,
                is_active:
                    row.assessment_question_is_active &&
                    row.question_is_active,
                options: []
            });
        }

        if (row.option_id !== null) {
            questionMap.get(row.question_id).options.push({
                option_id: row.option_id,
                option_code: row.option_code,
                option_text: row.option_text,
                display_order: row.display_order,
                is_active: row.option_is_active
            });
        }
    }

    return {
        assessment: assessmentResult.rows[0],
        questions: Array.from(questionMap.values())
    };
}
async function getStudentAttemptsForAssessment(userId, assessmentId) {
    const result = await pool.query(
        `SELECT
            aa.id AS attempt_id,
            aa.assessment_id,
            aa.enrollment_id,
            aa.attempt_number,
            aa.started_at,
            aa.submitted_at,
            aa.status,
            aa.total_questions,
            aa.answered_questions,
            aa.correct_answers,
            aa.wrong_answers,
            aa.unanswered_questions,
            aa.total_marks,
            aa.obtained_marks,
            aa.percentage,
            (aa.status = 'EVALUATED' AND COALESCE(aa.passed, FALSE)) AS passed,
            aa.passing_percentage,
            aa.time_taken_seconds,
            aa.last_saved_at,
            aa.result_published_at,
            COALESCE(aa.soft_delete, FALSE) = FALSE AS is_active,
            cert.id AS certificate_id,
            cert.certificate_number,
            cert.certificate_url,
            cert.verification_code,
            cert.issue_date
         FROM assessment.assessment_attempt aa
         JOIN learning.enrollment e
            ON e.id = aa.enrollment_id
         JOIN learning.student s
            ON s.id = e.student_id
         JOIN assessment.assessment a
            ON a.id = aa.assessment_id
         LEFT JOIN result.certificate cert
            ON cert.enrollment_id = aa.enrollment_id
           AND cert.soft_delete = FALSE
           AND cert.status = 'ISSUED'
         WHERE aa.assessment_id = $2
           AND s.user_id = $1
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND e.soft_delete = FALSE
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND COALESCE(aa.soft_delete, FALSE) = FALSE
         ORDER BY aa.attempt_number DESC`,
        [userId, assessmentId]
    );

    return result.rows;
}

async function startAssessment(userId, assessmentId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const accessResult = await client.query(
            `SELECT
                a.id AS assessment_id,
                a.course_id,
                a.duration_minutes,
                a.max_attempts,
                a.pass_percentage,
                a.passing_required,
                a.available_from,
                a.available_until,
                a.assessment_type,
                a.total_marks,
                e.id AS enrollment_id
             FROM assessment.assessment a
             JOIN learning.student s
                ON s.user_id = $1
             JOIN learning.enrollment e
                ON e.student_id = s.id
                AND e.course_id = a.course_id
             WHERE a.id = $2
               AND s.is_active = TRUE
               AND s.soft_delete = FALSE
               AND e.soft_delete = FALSE
               AND e.status IN ('ACTIVE', 'COMPLETED')
               AND a.status = 'PUBLISHED'
               AND a.is_active = TRUE
               AND a.soft_delete = FALSE
             FOR UPDATE OF a, e`,
            [userId, assessmentId]
        );

        if (accessResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { error: "ASSESSMENT_NOT_AVAILABLE" };
        }

        const assessment = accessResult.rows[0];
        const now = Date.now();

        if (
            assessment.available_from &&
            now < new Date(assessment.available_from).getTime()
        ) {
            await client.query("ROLLBACK");
            return { error: "ASSESSMENT_NOT_STARTED" };
        }

        if (
            assessment.available_until &&
            now > new Date(assessment.available_until).getTime()
        ) {
            await client.query("ROLLBACK");
            return { error: "ASSESSMENT_CLOSED" };
        }

        const existingResult = await client.query(
            `SELECT
                id AS attempt_id,
                assessment_id,
                enrollment_id,
                attempt_number,
                started_at,
                status,
                total_questions,
                total_marks,
                passing_percentage
             FROM assessment.assessment_attempt
             WHERE assessment_id = $1
               AND enrollment_id = $2
               AND status = 'IN_PROGRESS'
               AND COALESCE(soft_delete, FALSE) = FALSE
             ORDER BY attempt_number DESC
             LIMIT 1`,
            [assessmentId, assessment.enrollment_id]
        );

        if (existingResult.rows.length > 0) {
            await client.query("COMMIT");

            return {
                attempt: existingResult.rows[0],
                duration_minutes: assessment.duration_minutes,
                resumed: true
            };
        }

        const latestResult = await client.query(
            `SELECT id, status
             FROM assessment.assessment_attempt
             WHERE assessment_id = $1
               AND enrollment_id = $2
               AND COALESCE(soft_delete, FALSE) = FALSE
             ORDER BY attempt_number DESC
             LIMIT 1`,
            [assessmentId, assessment.enrollment_id]
        );

        if (latestResult.rows[0]?.status === "SUBMITTED") {
            await client.query("ROLLBACK");
            return { error: "RESULT_PENDING" };
        }

        const questionResult = await client.query(
            `SELECT
                COUNT(*)::INTEGER AS total_questions,
                COALESCE(SUM(marks), 0)::NUMERIC AS total_marks
             FROM assessment.assessment_question
             WHERE assessment_id = $1
               AND is_active = TRUE`,
            [assessmentId]
        );

        const { total_questions, total_marks } = questionResult.rows[0];

        if (Number(total_questions) <= 0) {
            await client.query("ROLLBACK");
            return { error: "NO_ASSESSMENT_QUESTIONS" };
        }

        const attemptCountResult = await client.query(
            `SELECT COUNT(*)::INTEGER AS attempt_count
             FROM assessment.assessment_attempt
             WHERE assessment_id = $1
               AND enrollment_id = $2
               AND COALESCE(soft_delete, FALSE) = FALSE`,
            [assessmentId, assessment.enrollment_id]
        );

        const attemptNumber =
            Number(attemptCountResult.rows[0].attempt_count) + 1;

        if (
            assessment.max_attempts !== null &&
            attemptNumber > Number(assessment.max_attempts)
        ) {
            await client.query("ROLLBACK");
            return { error: "MAX_ATTEMPTS_REACHED" };
        }

        const insertResult = await client.query(
            `INSERT INTO assessment.assessment_attempt (
                assessment_id,
                enrollment_id,
                attempt_number,
                status,
                total_questions,
                unanswered_questions,
                total_marks,
                passing_percentage,
                created_by
             )
             VALUES ($1, $2, $3, 'IN_PROGRESS', $4, $4, $5, $6, $7)
             RETURNING
                id AS attempt_id,
                assessment_id,
                enrollment_id,
                attempt_number,
                started_at,
                status,
                total_questions,
                total_marks,
                passing_percentage`,
            [
                assessmentId,
                assessment.enrollment_id,
                attemptNumber,
                total_questions,
                total_marks,
                assessment.pass_percentage,
                userId
            ]
        );

        await client.query("COMMIT");

        return {
            attempt: insertResult.rows[0],
            duration_minutes: assessment.duration_minutes,
            resumed: false
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
async function getStudentAttemptsForAssessment(userId, assessmentId) {
    const result = await pool.query(
        `SELECT
            aa.id AS attempt_id,
            aa.assessment_id,
            aa.enrollment_id,
            aa.attempt_number,
            aa.started_at,
            aa.submitted_at,
            aa.status,
            aa.total_questions,
            aa.answered_questions,
            aa.correct_answers,
            aa.wrong_answers,
            aa.unanswered_questions,
            aa.total_marks,
            aa.obtained_marks,
            aa.percentage,
            (aa.status = 'EVALUATED' AND COALESCE(aa.passed, FALSE)) AS passed,
            aa.passing_percentage,
            aa.time_taken_seconds,
            aa.last_saved_at,
            aa.result_published_at,
            COALESCE(aa.soft_delete, FALSE) = FALSE AS is_active,
            cert.id AS certificate_id,
            cert.certificate_number,
            cert.certificate_url,
            cert.verification_code,
            cert.issue_date
         FROM assessment.assessment_attempt aa
         JOIN learning.enrollment e
            ON e.id = aa.enrollment_id
         JOIN learning.student s
            ON s.id = e.student_id
         JOIN assessment.assessment a
            ON a.id = aa.assessment_id
         LEFT JOIN result.certificate cert
            ON cert.enrollment_id = aa.enrollment_id
           AND cert.soft_delete = FALSE
           AND cert.status = 'ISSUED'
         WHERE aa.assessment_id = $2
           AND s.user_id = $1
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND e.soft_delete = FALSE
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND COALESCE(aa.soft_delete, FALSE) = FALSE
         ORDER BY aa.attempt_number DESC`,
        [userId, assessmentId]
    );

    return result.rows;
}

async function startAssessment(userId, assessmentId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const accessResult = await client.query(
            `SELECT
                a.id AS assessment_id,
                a.course_id,
                a.duration_minutes,
                a.max_attempts,
                a.pass_percentage,
                a.passing_required,
                a.available_from,
                a.available_until,
                a.assessment_type,
                a.total_marks,
                e.id AS enrollment_id
             FROM assessment.assessment a
             JOIN learning.student s
                ON s.user_id = $1
             JOIN learning.enrollment e
                ON e.student_id = s.id
               AND e.course_id = a.course_id
             WHERE a.id = $2
               AND s.is_active = TRUE
               AND s.soft_delete = FALSE
               AND e.soft_delete = FALSE
               AND e.status IN ('ACTIVE', 'COMPLETED')
               AND a.status = 'PUBLISHED'
               AND a.is_active = TRUE
               AND a.soft_delete = FALSE
             FOR UPDATE OF a, e`,
            [userId, assessmentId]
        );

        if (accessResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { error: "ASSESSMENT_NOT_AVAILABLE" };
        }

        const assessment = accessResult.rows[0];
        const now = Date.now();

        if (
            assessment.available_from &&
            now < new Date(assessment.available_from).getTime()
        ) {
            await client.query("ROLLBACK");
            return { error: "ASSESSMENT_NOT_STARTED" };
        }

        if (
            assessment.available_until &&
            now > new Date(assessment.available_until).getTime()
        ) {
            await client.query("ROLLBACK");
            return { error: "ASSESSMENT_CLOSED" };
        }

        const existingResult = await client.query(
            `SELECT
                id AS attempt_id,
                assessment_id,
                enrollment_id,
                attempt_number,
                started_at,
                status,
                total_questions,
                total_marks,
                passing_percentage
             FROM assessment.assessment_attempt
             WHERE assessment_id = $1
               AND enrollment_id = $2
               AND status = 'IN_PROGRESS'
               AND COALESCE(soft_delete, FALSE) = FALSE
             ORDER BY attempt_number DESC
             LIMIT 1`,
            [assessmentId, assessment.enrollment_id]
        );

        if (existingResult.rows.length > 0) {
            await client.query("COMMIT");

            return {
                attempt: existingResult.rows[0],
                duration_minutes: assessment.duration_minutes,
                resumed: true
            };
        }

        const latestResult = await client.query(
            `SELECT id, status
             FROM assessment.assessment_attempt
             WHERE assessment_id = $1
               AND enrollment_id = $2
               AND COALESCE(soft_delete, FALSE) = FALSE
             ORDER BY attempt_number DESC
             LIMIT 1`,
            [assessmentId, assessment.enrollment_id]
        );

        if (latestResult.rows[0]?.status === "SUBMITTED") {
            await client.query("ROLLBACK");
            return { error: "RESULT_PENDING" };
        }

        const questionResult = await client.query(
            `SELECT
                COUNT(*)::INTEGER AS total_questions,
                COALESCE(SUM(marks), 0)::NUMERIC AS total_marks
             FROM assessment.assessment_question
             WHERE assessment_id = $1
               AND is_active = TRUE`,
            [assessmentId]
        );

        const { total_questions, total_marks } = questionResult.rows[0];

        if (Number(total_questions) <= 0) {
            await client.query("ROLLBACK");
            return { error: "NO_ASSESSMENT_QUESTIONS" };
        }

        const attemptCountResult = await client.query(
            `SELECT COUNT(*)::INTEGER AS attempt_count
             FROM assessment.assessment_attempt
             WHERE assessment_id = $1
               AND enrollment_id = $2
               AND COALESCE(soft_delete, FALSE) = FALSE`,
            [assessmentId, assessment.enrollment_id]
        );

        const attemptNumber =
            Number(attemptCountResult.rows[0].attempt_count) + 1;

        if (
            assessment.max_attempts !== null &&
            attemptNumber > Number(assessment.max_attempts)
        ) {
            await client.query("ROLLBACK");
            return { error: "MAX_ATTEMPTS_REACHED" };
        }

        const insertResult = await client.query(
            `INSERT INTO assessment.assessment_attempt (
                assessment_id,
                enrollment_id,
                attempt_number,
                status,
                total_questions,
                answered_questions,
                correct_answers,
                wrong_answers,
                unanswered_questions,
                total_marks,
                obtained_marks,
                percentage,
                passed,
                passing_percentage,
                started_at,
                created_at,
                created_by,
                soft_delete
            )
            VALUES (
                $1, $2, $3, 'IN_PROGRESS',
                $4, 0, 0, 0, $4,
                $5, 0, 0, FALSE, $6,
                NOW(), NOW(), $7, FALSE
            )
            RETURNING
                id AS attempt_id,
                assessment_id,
                enrollment_id,
                attempt_number,
                status,
                total_questions,
                total_marks,
                passing_percentage,
                started_at`,
            [
                assessmentId,
                assessment.enrollment_id,
                attemptNumber,
                total_questions,
                total_marks,
                assessment.pass_percentage,
                userId
            ]
        );

        await client.query("COMMIT");

        return {
            attempt: insertResult.rows[0],
            duration_minutes: assessment.duration_minutes,
            resumed: false
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
async function saveAssessmentAnswer(userId, attemptId, payload) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { question_id, selected_option_ids = [], answer_text } = payload;

        const attemptResult = await client.query(
            `SELECT
                aa.id AS attempt_id,
                aa.assessment_id,
                aa.status,
                aa.started_at,
                a.duration_minutes
             FROM assessment.assessment_attempt aa
             JOIN learning.enrollment e
                ON e.id = aa.enrollment_id
             JOIN learning.student s
                ON s.id = e.student_id
             JOIN assessment.assessment a
                ON a.id = aa.assessment_id
             WHERE aa.id = $1
               AND s.user_id = $2
               AND s.is_active = TRUE
               AND s.soft_delete = FALSE
               AND e.soft_delete = FALSE
               AND COALESCE(aa.soft_delete, FALSE) = FALSE
             FOR UPDATE OF aa`,
            [attemptId, userId]
        );

        if (attemptResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { error: "ATTEMPT_NOT_FOUND" };
        }

        const attempt = attemptResult.rows[0];

        if (attempt.status !== "IN_PROGRESS") {
            await client.query("ROLLBACK");
            return { error: "ATTEMPT_NOT_ACTIVE" };
        }

        if (attempt.duration_minutes !== null) {
            const endsAt =
                new Date(attempt.started_at).getTime() +
                Number(attempt.duration_minutes) * 60 * 1000;

            if (Date.now() >= endsAt) {
                await client.query("ROLLBACK");
                return { error: "ATTEMPT_EXPIRED" };
            }
        }

        const questionResult = await client.query(
            `SELECT
                q.id,
                q.question_type
             FROM assessment.assessment_question aq
             JOIN assessment.question q
                ON q.id = aq.question_id
             WHERE aq.assessment_id = $1
               AND aq.question_id = $2
               AND aq.is_active = TRUE
               AND q.is_active = TRUE
               AND q.soft_delete = FALSE`,
            [attempt.assessment_id, question_id]
        );

        if (questionResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { error: "QUESTION_NOT_FOUND" };
        }

        const question = questionResult.rows[0];
        const questionType = String(question.question_type || "").toUpperCase();

        if (!Array.isArray(selected_option_ids)) {
            await client.query("ROLLBACK");
            return { error: "INVALID_OPTIONS" };
        }

        const optionIds = normalizeIdList(selected_option_ids);

        if (optionIds.length !== selected_option_ids.length) {
            await client.query("ROLLBACK");
            return { error: "INVALID_OPTIONS" };
        }

        if (
            answer_text !== undefined &&
            answer_text !== null &&
            typeof answer_text !== "string"
        ) {
            await client.query("ROLLBACK");
            return { error: "INVALID_ANSWER_TEXT" };
        }

        const textAnswer =
            typeof answer_text === "string" ? answer_text.trim() : "";

        if (CHOICE_TYPES.includes(questionType)) {
            if (optionIds.length === 0) {
                await client.query("ROLLBACK");
                return { error: "ANSWER_REQUIRED" };
            }

            if (
                ["SINGLE_CHOICE", "TRUE_FALSE"].includes(questionType) &&
                optionIds.length > 1
            ) {
                await client.query("ROLLBACK");
                return { error: "ONLY_ONE_OPTION_ALLOWED" };
            }

            if (textAnswer) {
                await client.query("ROLLBACK");
                return { error: "CHOOSE_ONE_ANSWER_FORMAT" };
            }

            const validOptionsResult = await client.query(
                `SELECT id
                 FROM assessment.question_option
                 WHERE question_id = $1
                   AND id = ANY($2::bigint[])
                   AND is_active = TRUE`,
                [question_id, optionIds]
            );

            if (validOptionsResult.rows.length !== optionIds.length) {
                await client.query("ROLLBACK");
                return { error: "INVALID_QUESTION_OPTIONS" };
            }
        } else if (TEXT_TYPES.includes(questionType)) {
            if (!textAnswer) {
                await client.query("ROLLBACK");
                return { error: "ANSWER_REQUIRED" };
            }

            if (optionIds.length > 0) {
                await client.query("ROLLBACK");
                return { error: "CHOOSE_ONE_ANSWER_FORMAT" };
            }
        } else {
            await client.query("ROLLBACK");
            return { error: "UNSUPPORTED_QUESTION_TYPE" };
        }

        const answerResult = await client.query(
            `INSERT INTO assessment.assessment_answer (
                attempt_id,
                question_id,
                answer_text,
                is_answered,
                answered_at,
                created_by
             )
             VALUES ($1, $2, $3, TRUE, NOW(), $4)
             ON CONFLICT (attempt_id, question_id)
             DO UPDATE SET
                answer_text = EXCLUDED.answer_text,
                is_answered = TRUE,
                answered_at = NOW(),
                updated_at = NOW(),
                updated_by = $4,
                is_correct = NULL,
                marks_awarded = 0,
                evaluated_at = NULL,
                evaluation_comment = NULL
             RETURNING id`,
            [
                attemptId,
                question_id,
                TEXT_TYPES.includes(questionType) ? textAnswer : null,
                userId
            ]
        );

        const answerId = answerResult.rows[0].id;

        await client.query(
            `UPDATE assessment.assessment_answer_option
             SET soft_delete = TRUE,
                 updated_at = NOW(),
                 updated_by = $2
             WHERE answer_id = $1
               AND soft_delete = FALSE`,
            [answerId, userId]
        );

        for (const optionId of optionIds) {
            await client.query(
                `INSERT INTO assessment.assessment_answer_option (
                    answer_id,
                    option_id,
                    created_by
                 )
                 VALUES ($1, $2, $3)`,
                [answerId, optionId, userId]
            );
        }

        const countResult = await client.query(
            `SELECT COUNT(*)::INTEGER AS answered_questions
             FROM assessment.assessment_answer
             WHERE attempt_id = $1
               AND is_answered = TRUE
               AND soft_delete = FALSE`,
            [attemptId]
        );

        const answeredQuestions =
            Number(countResult.rows[0].answered_questions);

        await client.query(
            `UPDATE assessment.assessment_attempt
             SET answered_questions = $2,
                 unanswered_questions = GREATEST(total_questions - $2, 0),
                 last_saved_at = NOW(),
                 updated_at = NOW(),
                 updated_by = $3
             WHERE id = $1`,
            [attemptId, answeredQuestions, userId]
        );

        await client.query("COMMIT");

        return {
            answer_id: answerId,
            attempt_id: attemptId,
            question_id,
            answered_questions: answeredQuestions
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
async function saveAssessmentAnswer(userId, attemptId, payload) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const attemptResult = await client.query(
            `SELECT
                aa.id AS attempt_id,
                aa.assessment_id,
                aa.enrollment_id,
                aa.status,
                aa.started_at,
                a.duration_minutes,
                a.available_until
             FROM assessment.assessment_attempt aa
             JOIN assessment.assessment a
                ON a.id = aa.assessment_id
             JOIN learning.enrollment e
                ON e.id = aa.enrollment_id
             JOIN learning.student s
                ON s.id = e.student_id
             WHERE aa.id = $1
               AND s.user_id = $2
               AND s.is_active = TRUE
               AND s.soft_delete = FALSE
               AND e.soft_delete = FALSE
               AND aa.status = 'IN_PROGRESS'
               AND COALESCE(aa.soft_delete, FALSE) = FALSE
               AND a.is_active = TRUE
               AND a.soft_delete = FALSE
             FOR UPDATE OF aa`,
            [attemptId, userId]
        );

        if (attemptResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { error: "ATTEMPT_NOT_AVAILABLE" };
        }

        const attempt = attemptResult.rows[0];

        const startedAt = new Date(attempt.started_at).getTime();
        const now = Date.now();
        const durationMs = Number(attempt.duration_minutes) * 60 * 1000;

        if (durationMs > 0 && now > startedAt + durationMs) {
            await client.query("ROLLBACK");
            return { error: "ATTEMPT_TIME_EXPIRED" };
        }

        if (
            attempt.available_until &&
            now > new Date(attempt.available_until).getTime()
        ) {
            await client.query("ROLLBACK");
            return { error: "ASSESSMENT_CLOSED" };
        }

        const questionId = normalizeBigIntId(payload.question_id);

        if (!questionId) {
            await client.query("ROLLBACK");
            return { error: "INVALID_QUESTION_ID" };
        }

        const questionResult = await client.query(
            `SELECT
                aq.question_id,
                aq.marks,
                aq.negative_marks,
                q.question_type
             FROM assessment.assessment_question aq
             JOIN assessment.question q
                ON q.id = aq.question_id
             WHERE aq.assessment_id = $1
               AND aq.question_id = $2
               AND aq.is_active = TRUE
               AND q.is_active = TRUE
               AND q.soft_delete = FALSE
             LIMIT 1`,
            [attempt.assessment_id, questionId]
        );

        if (questionResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { error: "QUESTION_NOT_IN_ASSESSMENT" };
        }

        const question = questionResult.rows[0];
        const questionType = question.question_type;

        if (
            !CHOICE_TYPES.includes(questionType) &&
            !TEXT_TYPES.includes(questionType)
        ) {
            await client.query("ROLLBACK");
            return { error: "UNSUPPORTED_QUESTION_TYPE" };
        }

        let answerText = null;
        let optionIds = [];

        if (CHOICE_TYPES.includes(questionType)) {
            optionIds = normalizeIdList(
                payload.selected_option_ids ??
                (payload.selected_option_id
                    ? [payload.selected_option_id]
                    : [])
            );

            if (questionType === "SINGLE_CHOICE" || questionType === "TRUE_FALSE") {
                if (optionIds.length > 1) {
                    await client.query("ROLLBACK");
                    return { error: "ONLY_ONE_OPTION_ALLOWED" };
                }
            }

            if (optionIds.length > 0) {
                const validOptionsResult = await client.query(
                    `SELECT id
                     FROM assessment.question_option
                     WHERE question_id = $1
                       AND id = ANY($2::bigint[])
                       AND is_active = TRUE`,
                    [questionId, optionIds]
                );

                if (validOptionsResult.rowCount !== optionIds.length) {
                    await client.query("ROLLBACK");
                    return { error: "INVALID_QUESTION_OPTION" };
                }
            }
        } else {
            answerText =
                typeof payload.answer_text === "string"
                    ? payload.answer_text.trim()
                    : "";

            if (answerText.length > 10000) {
                await client.query("ROLLBACK");
                return { error: "ANSWER_TOO_LONG" };
            }
        }

        const isAnswered = CHOICE_TYPES.includes(questionType)
            ? optionIds.length > 0
            : hasTextAnswer(answerText);

        const existingAnswerResult = await client.query(
            `SELECT id
             FROM assessment.assessment_answer
             WHERE attempt_id = $1
               AND question_id = $2
               AND soft_delete = FALSE
             LIMIT 1
             FOR UPDATE`,
            [attemptId, questionId]
        );

        let answerId;

        if (existingAnswerResult.rows.length > 0) {
            const updateResult = await client.query(
                `UPDATE assessment.assessment_answer
                 SET answer_text = $3,
                     is_answered = $4,
                     is_correct = NULL,
                     marks_awarded = 0,
                     evaluation_comment = NULL,
                     updated_at = NOW(),
                     updated_by = $5
                 WHERE id = $1
                   AND attempt_id = $2
                 RETURNING id`,
                [
                    existingAnswerResult.rows[0].id,
                    attemptId,
                    answerText,
                    isAnswered,
                    userId
                ]
            );

            answerId = updateResult.rows[0].id;
        } else {
            const insertAnswerResult = await client.query(
                `INSERT INTO assessment.assessment_answer (
                    attempt_id,
                    question_id,
                    answer_text,
                    is_answered,
                    marks_awarded,
                    created_at,
                    created_by,
                    soft_delete
                )
                VALUES ($1, $2, $3, $4, 0, NOW(), $5, FALSE)
                RETURNING id`,
                [attemptId, questionId, answerText, isAnswered, userId]
            );

            answerId = insertAnswerResult.rows[0].id;
        }

        await client.query(
            `UPDATE assessment.assessment_answer_option
             SET soft_delete = TRUE,
                 updated_at = NOW(),
                 updated_by = $2
             WHERE answer_id = $1
               AND soft_delete = FALSE`,
            [answerId, userId]
        );

        for (const optionId of optionIds) {
            await client.query(
                `INSERT INTO assessment.assessment_answer_option (
                    answer_id,
                    option_id,
                    created_by,
                    soft_delete
                )
                VALUES ($1, $2, $3, FALSE)
                ON CONFLICT (answer_id, option_id)
                DO UPDATE SET
                    soft_delete = FALSE,
                    updated_at = NOW(),
                    updated_by = $3`,
                [answerId, optionId, userId]
            );
        }

        await client.query(
            `UPDATE assessment.assessment_attempt
             SET last_saved_at = NOW(),
                 updated_at = NOW(),
                 updated_by = $2
             WHERE id = $1`,
            [attemptId, userId]
        );

        await client.query("COMMIT");

        return {
            success: true,
            answer_id: answerId,
            question_id: questionId
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
async function submitAssessment(userId, attemptId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const attemptResult = await client.query(
            `SELECT
                aa.id AS attempt_id,
                aa.assessment_id,
                aa.enrollment_id,
                aa.attempt_number,
                aa.status,
                aa.started_at,
                a.duration_minutes,
                a.pass_percentage,
                a.passing_required,
                a.assessment_type
             FROM assessment.assessment_attempt aa
             JOIN learning.enrollment e
                ON e.id = aa.enrollment_id
             JOIN learning.student s
                ON s.id = e.student_id
             JOIN assessment.assessment a
                ON a.id = aa.assessment_id
             WHERE aa.id = $1
               AND s.user_id = $2
               AND s.is_active = TRUE
               AND s.soft_delete = FALSE
               AND e.soft_delete = FALSE
               AND COALESCE(aa.soft_delete, FALSE) = FALSE
             FOR UPDATE OF aa`,
            [attemptId, userId]
        );

        if (attemptResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { error: "ATTEMPT_NOT_FOUND" };
        }

        const attempt = attemptResult.rows[0];

        if (attempt.status !== "IN_PROGRESS") {
            await client.query("ROLLBACK");
            return { error: "ATTEMPT_NOT_ACTIVE" };
        }

        const answersResult = await client.query(
            `SELECT
                aq.question_id,
                aq.question_number,
                aq.marks,
                aq.negative_marks,
                q.question_type,
                ans.id AS answer_id,
                ans.is_answered,
                ans.answer_text,
                COALESCE(
                    ARRAY_AGG(DISTINCT qo.id)
                    FILTER (WHERE qo.is_correct = TRUE),
                    ARRAY[]::BIGINT[]
                ) AS correct_option_ids,
                COALESCE(
                    ARRAY_AGG(DISTINCT selected.option_id)
                    FILTER (WHERE selected.option_id IS NOT NULL),
                    ARRAY[]::BIGINT[]
                ) AS selected_option_ids
             FROM assessment.assessment_question aq
             JOIN assessment.question q
                ON q.id = aq.question_id
             LEFT JOIN assessment.assessment_answer ans
                ON ans.attempt_id = $1
               AND ans.question_id = aq.question_id
               AND ans.soft_delete = FALSE
             LEFT JOIN assessment.question_option qo
                ON qo.question_id = q.id
               AND qo.is_active = TRUE
             LEFT JOIN assessment.assessment_answer_option selected
                ON selected.answer_id = ans.id
               AND selected.option_id = qo.id
               AND selected.soft_delete = FALSE
             WHERE aq.assessment_id = $2
               AND aq.is_active = TRUE
               AND q.is_active = TRUE
               AND q.soft_delete = FALSE
             GROUP BY
                aq.question_id,
                aq.question_number,
                aq.marks,
                aq.negative_marks,
                q.question_type,
                ans.id,
                ans.is_answered,
                ans.answer_text
             ORDER BY aq.question_number`,
            [attemptId, attempt.assessment_id]
        );

        if (answersResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { error: "NO_ASSESSMENT_QUESTIONS" };
        }

        let answeredQuestions = 0;
        let correctAnswers = 0;
        let wrongAnswers = 0;
        let unansweredQuestions = 0;
        let pendingQuestions = 0;
        let obtainedMarks = 0;

        for (const question of answersResult.rows) {
            const questionType =
                String(question.question_type || "").toUpperCase();

            const selected = normalizeIdList(question.selected_option_ids);
            const correct = normalizeIdList(question.correct_option_ids);
            const textAnswer = hasTextAnswer(question.answer_text);

            const hasAnswer =
                question.is_answered === true &&
                (selected.length > 0 || textAnswer);

            if (!hasAnswer) {
                unansweredQuestions++;
                continue;
            }

            answeredQuestions++;
            const marks = Number(question.marks);

            if (TEXT_TYPES.includes(questionType)) {
                pendingQuestions++;

                if (question.answer_id) {
                    await client.query(
                        `UPDATE assessment.assessment_answer
                         SET is_correct = NULL,
                             marks_awarded = 0,
                             evaluated_at = NULL,
                             updated_at = NOW(),
                             updated_by = $2
                         WHERE id = $1`,
                        [question.answer_id, userId]
                    );
                }

                continue;
            }

            if (selected.length === 0) {
                unansweredQuestions++;
                answeredQuestions--;
                continue;
            }

            if (correct.length === 0) {
                await client.query("ROLLBACK");
                return { error: "CORRECT_ANSWER_NOT_CONFIGURED" };
            }

            const isCorrect =
                selected.length === correct.length &&
                selected.every((id, index) => id === correct[index]);

            const awardedMarks = isCorrect ? marks : 0;

            const contribution = isCorrect
                ? marks
                : -Number(question.negative_marks || 0);

            if (isCorrect) {
                correctAnswers++;
            } else {
                wrongAnswers++;
            }

            obtainedMarks += contribution;

            if (question.answer_id) {
                await client.query(
                    `UPDATE assessment.assessment_answer
                     SET is_correct = $2,
                         marks_awarded = $3,
                         evaluated_at = NOW(),
                         updated_at = NOW(),
                         updated_by = $4
                     WHERE id = $1`,
                    [question.answer_id, isCorrect, awardedMarks, userId]
                );
            }
        }

        const totalQuestions = answersResult.rows.length;

        const totalMarks = answersResult.rows.reduce(
            (sum, question) => sum + Number(question.marks),
            0
        );

        obtainedMarks = Math.max(
            0,
            Math.min(obtainedMarks, totalMarks)
        );

        const percentage = totalMarks > 0
            ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2))
            : 0;

        // A result is not final until all written answers are graded.
        // Never persist a provisional pass for a SUBMITTED attempt.
        const passed = pendingQuestions > 0
            ? false
            : percentage >= Number(attempt.pass_percentage);

        const status = pendingQuestions > 0
            ? "SUBMITTED"
            : "EVALUATED";

        const timeTakenSeconds = Math.max(
            0,
            Math.floor(
                (Date.now() - new Date(attempt.started_at).getTime()) / 1000
            )
        );

        const updateResult = await client.query(
            `UPDATE assessment.assessment_attempt
             SET status = $2,
                 submitted_at = NOW(),
                 total_questions = $3,
                 answered_questions = $4,
                 correct_answers = $5,
                 wrong_answers = $6,
                 unanswered_questions = $7,
                 total_marks = $8,
                 obtained_marks = $9,
                 percentage = $10,
                 passed = $11,
                 passing_percentage = $12,
                 time_taken_seconds = $13,
                 result_published_at = CASE
                    WHEN $15::boolean THEN NOW()
                    ELSE NULL
                 END,
                 updated_at = NOW(),
                 updated_by = $14
             WHERE id = $1
             RETURNING
                id AS attempt_id,
                assessment_id,
                enrollment_id,
                attempt_number,
                status,
                submitted_at,
                total_questions,
                answered_questions,
                correct_answers,
                wrong_answers,
                unanswered_questions,
                total_marks,
                obtained_marks,
                percentage,
                passed,
                passing_percentage,
                time_taken_seconds,
                result_published_at`,
            [
                attemptId,
                status,
                totalQuestions,
                answeredQuestions,
                correctAnswers,
                wrongAnswers,
                unansweredQuestions,
                totalMarks,
                obtainedMarks,
                percentage,
                passed,
                attempt.pass_percentage,
                timeTakenSeconds,
                userId,
                status === "EVALUATED"
            ]
        );

        // Assessment success is not proof of overall course completion.
        // Certificate issuance belongs to the existing course-completion workflow.
        const certificate = null;

        await client.query("COMMIT");

        return {
            result: {
                ...updateResult.rows[0],
                requires_manual_evaluation: pendingQuestions > 0,
                pending_questions: pendingQuestions,
                certificate
            }
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
async function getAssessmentReviewQuestions(
    attemptId,
    assessmentId,
    showCorrectAnswers
) {
    const result = await pool.query(
        `SELECT
            aq.question_id,
            aq.question_number,
            aq.marks,
            aq.negative_marks,
            aq.is_mandatory,
            q.question_text,
            q.question_type,
            q.explanation,
            ans.id AS answer_id,
            ans.answer_text,
            ans.is_answered,
            ans.is_correct,
            ans.marks_awarded,
            ans.evaluation_comment,
            qo.id AS option_id,
            qo.option_code,
            qo.option_text,
            qo.display_order,
            qo.is_active AS option_is_active,
            CASE
                WHEN $3::BOOLEAN THEN qo.is_correct
                ELSE NULL
            END AS option_is_correct,
            CASE
                WHEN $3::BOOLEAN THEN EXISTS (
                    SELECT 1
                    FROM assessment.assessment_answer_option aao
                    WHERE aao.answer_id = ans.id
                      AND aao.option_id = qo.id
                      AND aao.soft_delete = FALSE
                )
                ELSE FALSE
            END AS option_is_selected
         FROM assessment.assessment_question aq
         JOIN assessment.question q
            ON q.id = aq.question_id
         LEFT JOIN assessment.assessment_answer ans
            ON ans.attempt_id = $1
           AND ans.question_id = aq.question_id
           AND ans.soft_delete = FALSE
         LEFT JOIN assessment.question_option qo
            ON qo.question_id = q.id
           AND qo.is_active = TRUE
         WHERE aq.assessment_id = $2
           AND aq.is_active = TRUE
           AND q.is_active = TRUE
           AND q.soft_delete = FALSE
         ORDER BY aq.question_number ASC, qo.display_order ASC`,
        [attemptId, assessmentId, showCorrectAnswers]
    );

    const questionMap = new Map();

    for (const row of result.rows) {
        if (!questionMap.has(row.question_id)) {
            questionMap.set(row.question_id, {
                question_id: row.question_id,
                question_number: row.question_number,
                question_text: row.question_text,
                question_type: row.question_type,
                explanation: row.explanation,
                marks: row.marks,
                negative_marks: row.negative_marks,
                is_mandatory: row.is_mandatory,
                answer_id: row.answer_id,
                answer_text: row.answer_text,
                is_answered: row.is_answered,
                is_correct: row.is_correct,
                marks_awarded: row.marks_awarded,
                evaluation_comment: row.evaluation_comment,
                options: []
            });
        }

        if (row.option_id !== null) {
            questionMap.get(row.question_id).options.push({
                option_id: row.option_id,
                option_code: row.option_code,
                option_text: row.option_text,
                display_order: row.display_order,
                is_active: row.option_is_active,
                is_correct: row.option_is_correct,
                is_selected: row.option_is_selected
            });
        }
    }

    return Array.from(questionMap.values());
}

async function getAssessmentResult(userId, attemptId) {
    const result = await pool.query(
        `SELECT
            aa.id AS attempt_id,
            aa.enrollment_id,
            aa.attempt_number,
            aa.status,
            aa.started_at,
            aa.submitted_at,
            aa.total_questions,
            aa.answered_questions,
            aa.correct_answers,
            aa.wrong_answers,
            aa.unanswered_questions,
            aa.total_marks,
            aa.obtained_marks,
            aa.percentage,
            (aa.status = 'EVALUATED' AND COALESCE(aa.passed, FALSE)) AS passed,
            aa.passing_percentage,
            aa.time_taken_seconds,
            aa.last_saved_at,
            aa.result_published_at,
            COALESCE(aa.soft_delete, FALSE) = FALSE AS is_active,
            a.id AS assessment_id,
            a.course_id,
            a.module_id,
            a.assessment_code,
            a.title AS assessment_title,
            a.description AS assessment_description,
            a.assessment_type,
            a.instructions,
            a.duration_minutes,
            a.pass_percentage,
            a.passing_required,
            a.show_result_immediately,
            a.allow_review_after_submission,
            a.status AS assessment_status,
            a.is_active AS assessment_is_active,
            c.title AS course_title,
            m.title AS module_title,
            (
                SELECT COUNT(*)::INTEGER
                FROM assessment.assessment_attempt counted
                WHERE counted.assessment_id = aa.assessment_id
                  AND counted.enrollment_id = aa.enrollment_id
                  AND COALESCE(counted.soft_delete, FALSE) = FALSE
            ) AS attempt_count,
            cert.id AS certificate_id,
            cert.certificate_number,
            cert.certificate_template_id,
            cert.student_name_snapshot,
            cert.course_title_snapshot,
            cert.completion_date,
            cert.issue_date,
            cert.certificate_title,
            cert.certificate_url,
            cert.verification_code,
            cert.status AS certificate_status
         FROM assessment.assessment_attempt aa
         JOIN learning.enrollment e
            ON e.id = aa.enrollment_id
         JOIN learning.student s
            ON s.id = e.student_id
         JOIN assessment.assessment a
            ON a.id = aa.assessment_id
         JOIN learning.course c
            ON c.id = a.course_id
         LEFT JOIN learning.module m
            ON m.id = a.module_id
         LEFT JOIN result.certificate cert
            ON cert.enrollment_id = aa.enrollment_id
           AND cert.soft_delete = FALSE
           AND cert.status = 'ISSUED'
         WHERE aa.id = $1
           AND s.user_id = $2
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND e.soft_delete = FALSE
           AND COALESCE(aa.soft_delete, FALSE) = FALSE`,
        [attemptId, userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const status = String(row.status || "").toUpperCase();
    const allowReview = row.allow_review_after_submission === true;

    if (status === "EVALUATED" && allowReview) {
        row.questions = await getAssessmentReviewQuestions(
            attemptId,
            row.assessment_id,
            true
        );
    } else if (status === "SUBMITTED") {
        row.questions = await getAssessmentReviewQuestions(
            attemptId,
            row.assessment_id,
            false
        );
    } else {
        row.questions = [];
    }

    row.requires_manual_evaluation = status === "SUBMITTED";

    row.certificate = row.certificate_id
        ? {
            id: row.certificate_id,
            certificate_number: row.certificate_number,
            certificate_template_id: row.certificate_template_id,
            student_name_snapshot: row.student_name_snapshot,
            course_title_snapshot: row.course_title_snapshot,
            completion_date: row.completion_date,
            issue_date: row.issue_date,
            certificate_title: row.certificate_title,
            certificate_url: row.certificate_url,
            verification_code: row.verification_code,
            status: row.certificate_status
        }
        : null;

    return row;
}
async function getAttemptDetails(userId, attemptId) {
    const attemptResult = await pool.query(
        `SELECT
            aa.id AS attempt_id,
            aa.assessment_id,
            aa.enrollment_id,
            aa.attempt_number,
            aa.started_at,
            aa.submitted_at,
            aa.status,
            aa.total_questions,
            aa.answered_questions,
            aa.correct_answers,
            aa.wrong_answers,
            aa.unanswered_questions,
            aa.total_marks,
            aa.obtained_marks,
            aa.percentage,
            (aa.status = 'EVALUATED' AND COALESCE(aa.passed, FALSE)) AS passed,
            aa.passing_percentage,
            aa.time_taken_seconds,
            aa.last_saved_at,
            a.title AS assessment_title,
            a.assessment_type,
            a.instructions,
            a.duration_minutes,
            a.pass_percentage,
            a.passing_required,
            a.allow_review_after_submission,
            c.title AS course_title,
            m.title AS module_title
         FROM assessment.assessment_attempt aa
         JOIN learning.enrollment e
            ON e.id = aa.enrollment_id
         JOIN learning.student s
            ON s.id = e.student_id
         JOIN assessment.assessment a
            ON a.id = aa.assessment_id
         JOIN learning.course c
            ON c.id = a.course_id
         LEFT JOIN learning.module m
            ON m.id = a.module_id
         WHERE aa.id = $1
           AND s.user_id = $2
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND e.soft_delete = FALSE
           AND COALESCE(aa.soft_delete, FALSE) = FALSE
         LIMIT 1`,
        [attemptId, userId]
    );

    if (attemptResult.rows.length === 0) return null;

    const attempt = attemptResult.rows[0];

    const questions = await getAssessmentReviewQuestions(
        attemptId,
        attempt.assessment_id,
        false
    );

    const answersResult = await pool.query(
        `SELECT
            ans.question_id,
            ans.answer_text,
            ans.is_answered,
            COALESCE(
                ARRAY_AGG(aao.option_id)
                FILTER (
                    WHERE aao.option_id IS NOT NULL
                      AND aao.soft_delete = FALSE
                ),
                ARRAY[]::BIGINT[]
            ) AS selected_option_ids
         FROM assessment.assessment_answer ans
         LEFT JOIN assessment.assessment_answer_option aao
            ON aao.answer_id = ans.id
         WHERE ans.attempt_id = $1
           AND ans.soft_delete = FALSE
         GROUP BY
            ans.question_id,
            ans.answer_text,
            ans.is_answered`,
        [attemptId]
    );

    const answerByQuestion = new Map(
        answersResult.rows.map(row => [row.question_id, row])
    );

    for (const question of questions) {
        const saved = answerByQuestion.get(question.question_id);

        question.answer_text = saved?.answer_text ?? "";
        question.is_answered = saved?.is_answered ?? false;
        question.selected_option_ids = normalizeIdList(
            saved?.selected_option_ids
        );
    }

    return {
        attempt,
        questions
    };
}

module.exports = {
    getAvailableAssessments,
    getAssessmentDetails,
    getStudentAttemptsForAssessment,
    startAssessment,
    saveAssessmentAnswer,
    submitAssessment,
    getAssessmentResult,
    getAttemptDetails
};
