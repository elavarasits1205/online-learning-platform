const pool = require("../config/database");

// ============================================================
// COMMON HELPERS
// ============================================================

async function getInstructorId(userId) {
    const result = await pool.query(
        `SELECT id
         FROM learning.instructor
         WHERE user_id = $1
           AND is_active = TRUE
           AND soft_delete = FALSE
         LIMIT 1`,
        [userId]
    );

    return result.rows[0]?.id ?? null;
}

async function ownsCourse(userId, courseId) {
    const result = await pool.query(
        `SELECT 1
         FROM learning.instructor i
         JOIN learning.course_instructor ci
           ON ci.instructor_id = i.id
         JOIN learning.course c
           ON c.id = ci.course_id
         WHERE i.user_id = $1
           AND c.id = $2
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND ci.is_active = TRUE
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE
         LIMIT 1`,
        [userId, courseId]
    );

    return result.rowCount > 0;
}

async function moduleBelongsToCourse(moduleId, courseId) {
    const result = await pool.query(
        `SELECT 1
         FROM learning.module
         WHERE id = $1
           AND course_id = $2
           AND is_active = TRUE
           AND soft_delete = FALSE
         LIMIT 1`,
        [moduleId, courseId]
    );

    return result.rowCount > 0;
}

// ============================================================
// 1. CREATE ASSESSMENT
// ============================================================

async function createAssessment(data) {
    const result = await pool.query(
        `INSERT INTO assessment.assessment (
            course_id,
            module_id,
            assessment_code,
            title,
            description,
            assessment_type,
            instructions,
            duration_minutes,
            total_marks,
            pass_percentage,
            max_attempts,
            status,
            created_by,
            is_active,
            soft_delete
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            0, $9, $10, $11, $12, TRUE, FALSE
        )
        RETURNING *`,
        [
            data.course_id,
            data.module_id,
            data.assessment_code,
            data.title,
            data.description,
            data.assessment_type,
            data.instructions,
            data.duration_minutes,
            data.pass_percentage,
            data.max_attempts,
            data.status,
            data.userId
        ]
    );

    return result.rows[0];
}

// ============================================================
// 2. LIST ASSESSMENTS
// ============================================================

async function listAssessments(userId) {
    const result = await pool.query(
        `SELECT
            a.id,
            a.course_id,
            a.module_id,
            a.assessment_code,
            a.title,
            a.description,
            a.assessment_type,
            a.duration_minutes,
            a.total_marks,
            a.pass_percentage,
            a.max_attempts,
            a.status,
            a.is_active,
            (
                SELECT COUNT(*)::INTEGER
                FROM assessment.assessment_question aq
                WHERE aq.assessment_id = a.id
                  AND aq.is_active = TRUE
            ) AS question_count,
            (
                SELECT COUNT(*)::INTEGER
                FROM assessment.assessment_attempt aa
                WHERE aa.assessment_id = a.id
                  AND COALESCE(aa.soft_delete, FALSE) = FALSE
            ) AS attempt_count,
            c.title AS course_title,
            m.title AS module_title
         FROM assessment.assessment a
         JOIN learning.course c
           ON c.id = a.course_id
         JOIN learning.instructor i
           ON i.user_id = $1
         JOIN learning.course_instructor ci
           ON ci.instructor_id = i.id
          AND ci.course_id = c.id
         LEFT JOIN learning.module m
           ON m.id = a.module_id
         WHERE a.soft_delete = FALSE
           AND a.is_active = TRUE
           AND ci.is_active = TRUE
           AND i.soft_delete = FALSE
           AND i.is_active = TRUE
         ORDER BY a.created_at DESC`,
        [userId]
    );

    return result.rows;
}

// ============================================================
// 3. GET ASSESSMENT DETAILS
// ============================================================

async function getAssessmentByInstructor(userId, assessmentId) {
    const result = await pool.query(
        `SELECT
            a.id,
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
            a.available_from,
            a.available_until,
            a.status,
            a.created_at,
            a.updated_at,
            c.title AS course_title,
            m.title AS module_title
         FROM assessment.assessment a
         JOIN learning.course c
           ON c.id = a.course_id
         JOIN learning.instructor i
           ON i.user_id = $2
         JOIN learning.course_instructor ci
           ON ci.instructor_id = i.id
          AND ci.course_id = a.course_id
         LEFT JOIN learning.module m
           ON m.id = a.module_id
         WHERE a.id = $1
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND ci.is_active = TRUE
         LIMIT 1`,
        [assessmentId, userId]
    );

    return result.rows[0] || null;
}

async function getAssessmentQuestions(assessmentId) {
    const result = await pool.query(
        `SELECT
            aq.id AS assessment_question_id,
                        aq.question_id,
            aq.question_number,
            aq.marks,
            aq.negative_marks,
            aq.is_mandatory,
            q.question_code,
            q.question_text,
            q.question_type,
            q.explanation,
            q.default_marks,
            q.difficulty_level
         FROM assessment.assessment_question aq
         JOIN assessment.question q
           ON q.id = aq.question_id
         WHERE aq.assessment_id = $1
           AND aq.is_active = TRUE
           AND q.is_active = TRUE
           AND q.soft_delete = FALSE
         ORDER BY aq.question_number ASC`,
        [assessmentId]
    );

    return result.rows;
}

async function getQuestionOptions(questionIds) {
    const result = await pool.query(
        `SELECT
            id,
            question_id,
            option_code,
            option_text,
            display_order,
            is_correct,
            explanation
         FROM assessment.question_option
         WHERE question_id = ANY($1::bigint[])
           AND is_active = TRUE
         ORDER BY question_id, display_order ASC`,
        [questionIds]
    );

    return result.rows;
}

// ============================================================
// 4. CREATE QUESTION
// ============================================================

async function createQuestion(data) {
    const result = await pool.query(
        `INSERT INTO assessment.question (
            question_code,
            question_text,
            question_type,
            explanation,
            default_marks,
            negative_marks,
            difficulty_level,
            is_active,
            created_by,
            soft_delete
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, FALSE)
        RETURNING *`,
        [
            data.question_code,
            data.question_text,
            data.question_type,
            data.explanation,
            data.default_marks,
            data.negative_marks,
            data.difficulty_level,
            data.userId
        ]
    );

    return result.rows[0];
}

// ============================================================
// 5. UPDATE QUESTION
// ============================================================

async function updateQuestion(client, questionId, userId, updates) {
    const fields = Object.keys(updates);

    const setClause = fields.map(
        (field, index) => `${field} = $${index + 1}`
    );

    const values = fields.map(field => updates[field]);

    values.push(userId);
    values.push(questionId);

    const result = await client.query(
        `UPDATE assessment.question
         SET ${setClause.join(", ")},
             updated_at = NOW(),
             updated_by = $${values.length - 1}
         WHERE id = $${values.length}
           AND created_by = $${values.length - 1}
         RETURNING *`,
        values
    );

    return result.rows[0] || null;
}

// ============================================================
// 6. CREATE QUESTION OPTIONS
// ============================================================

async function createQuestionOptions(client, questionId, options, userId) {
    const insertedOptions = [];

    for (const option of options) {
        const result = await client.query(
            `INSERT INTO assessment.question_option (
                question_id,
                option_code,
                option_text,
                display_order,
                is_correct,
                explanation,
                is_active,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
            RETURNING id, question_id, option_code,
                      option_text, display_order, is_correct`,
            [
                questionId,
                option.option_code,
                option.option_text,
                option.display_order,
                option.is_correct,
                option.explanation,
                userId
            ]
        );

        insertedOptions.push(result.rows[0]);
    }

    return insertedOptions;
}

// ============================================================
// 7. UPDATE QUESTION OPTIONS
// ============================================================

async function getQuestionByInstructor(client, questionId, userId) {
    const result = await client.query(
        `SELECT id, question_type
         FROM assessment.question
         WHERE id = $1
           AND created_by = $2
           AND is_active = TRUE
           AND soft_delete = FALSE
         FOR UPDATE`,
        [questionId, userId]
    );

    return result.rows[0] || null;
}

async function getExistingQuestionOptions(client, questionId) {
    const result = await client.query(
        `SELECT id, option_code, display_order, is_active
         FROM assessment.question_option
         WHERE question_id = $1
         FOR UPDATE`,
        [questionId]
    );

    return result.rows;
}

async function updateQuestionOption(client, option, userId, questionId) {
    const result = await client.query(
        `UPDATE assessment.question_option
         SET option_code = $1,
             option_text = $2,
             display_order = $3,
             is_correct = $4,
             explanation = $5,
             is_active = TRUE,
             updated_at = NOW(),
             updated_by = $6
         WHERE id = $7
           AND question_id = $8
         RETURNING *`,
        [
            option.option_code,
            option.option_text,
            option.display_order,
            option.is_correct,
            option.explanation,
            userId,
            option.id,
            questionId
        ]
    );

    return result.rows[0];
}


async function moveQuestionOptionToTemporaryValues(
    client,
    optionId,
    questionId,
    temporaryCode,
    temporaryOrder
) {
    const result = await client.query(
        `UPDATE assessment.question_option
         SET option_code = $1,
             display_order = $2,
             updated_at = NOW()
         WHERE id = $3
           AND question_id = $4
         RETURNING id`,
        [temporaryCode, temporaryOrder, optionId, questionId]
    );

    return result.rows[0] || null;
}



async function insertQuestionOption(client, option, userId, questionId) {
    const result = await client.query(
        `INSERT INTO assessment.question_option (
            question_id,
            option_code,
            option_text,
            display_order,
            is_correct,
            explanation,
            is_active,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
        RETURNING *`,
        [
            questionId,
            option.option_code,
            option.option_text,
            option.display_order,
            option.is_correct,
            option.explanation,
            userId
        ]
    );

    return result.rows[0];
}

async function deactivateQuestionOptions(client, questionId, userId, omittedIds) {
    if (!omittedIds.length) return;

    await client.query(
        `UPDATE assessment.question_option
         SET is_active = FALSE,
             updated_at = NOW(),
             updated_by = $2
         WHERE question_id = $1
           AND id = ANY($3::bigint[])`,
        [questionId, userId, omittedIds]
    );
}

// ============================================================
// 8. ATTACH QUESTION TO ASSESSMENT
// ============================================================

async function getAssessmentForUpdate(client, userId, assessmentId) {
    const result = await client.query(
        `SELECT
            a.id,
            a.course_id,
            a.module_id,
            a.assessment_type,
            a.status
         FROM assessment.assessment a
         JOIN learning.instructor i
           ON i.user_id = $2
         JOIN learning.course_instructor ci
           ON ci.instructor_id = i.id
          AND ci.course_id = a.course_id
         WHERE a.id = $1
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND ci.is_active = TRUE
         FOR UPDATE OF a`,
        [assessmentId, userId]
    );

    return result.rows[0] || null;
}

async function getQuestionForUpdate(client, questionId, userId) {
    const result = await client.query(
        `SELECT id, question_type
         FROM assessment.question
         WHERE id = $1
           AND created_by = $2
           AND is_active = TRUE
           AND soft_delete = FALSE
         FOR UPDATE`,
        [questionId, userId]
    );

    return result.rows[0] || null;
}

async function questionAlreadyAttached(client, assessmentId, questionId) {
    const result = await client.query(
        `SELECT 1
         FROM assessment.assessment_question
         WHERE assessment_id = $1
           AND question_id = $2`,
        [assessmentId, questionId]
    );

    return result.rowCount > 0;
}

async function questionNumberAlreadyUsed(client, assessmentId, number) {
    const result = await client.query(
        `SELECT 1
         FROM assessment.assessment_question
         WHERE assessment_id = $1
           AND question_number = $2
           AND is_active = TRUE`,
        [assessmentId, number]
    );

    return result.rowCount > 0;
}

async function insertAssessmentQuestion(client, data) {
    const result = await client.query(
        `INSERT INTO assessment.assessment_question (
            assessment_id,
            question_id,
            question_number,
            marks,
            negative_marks,
            is_mandatory,
            created_by,
            is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        RETURNING *`,
        [
            data.assessmentId,
            data.questionId,
            data.questionNumber,
            data.marks,
            data.negativeMarks,
            data.isMandatory,
            data.userId
        ]
    );

    return result.rows[0];
}

async function recalculateAssessmentTotalMarks(client, assessmentId, userId) {
    const result = await client.query(
        `UPDATE assessment.assessment
         SET total_marks = (
             SELECT COALESCE(SUM(aq.marks), 0)
             FROM assessment.assessment_question aq
             WHERE aq.assessment_id = $1
               AND aq.is_active = TRUE
         ),
         updated_at = NOW(),
         updated_by = $2
         WHERE id = $1
         RETURNING total_marks`,
        [assessmentId, userId]
    );

    return result.rows[0]?.total_marks;
}

// ============================================================
// 9. GET QUESTION WITH OPTIONS
// ============================================================

async function getQuestionDetails(questionId, userId) {
    const result = await pool.query(
        `SELECT
            id,
            question_code,
            question_text,
            question_type,
            explanation,
            default_marks,
            negative_marks,
            difficulty_level,
            created_at,
            updated_at
         FROM assessment.question
         WHERE id = $1
           AND created_by = $2
           AND is_active = TRUE
           AND soft_delete = FALSE
         LIMIT 1`,
        [questionId, userId]
    );

    return result.rows[0] || null;
}

async function getActiveQuestionOptions(questionId) {
    const result = await pool.query(
        `SELECT
            id,
            option_code,
            option_text,
            display_order,
            is_correct,
            explanation
         FROM assessment.question_option
         WHERE question_id = $1
           AND is_active = TRUE
         ORDER BY display_order ASC`,
        [questionId]
    );

    return result.rows;
}

// ============================================================
// 10. PUBLISH ASSESSMENT
// ============================================================
async function getAssessmentForPublish(client, userId, assessmentId) {
    const result = await client.query(
        `SELECT
            a.id,
            a.course_id,
            a.module_id,
            a.title,
            c.title AS course_title,
            a.status,
            a.is_active,
            a.soft_delete
         FROM assessment.assessment a
         JOIN learning.course c
           ON c.id = a.course_id
         JOIN learning.instructor i
           ON i.user_id = $2
         JOIN learning.course_instructor ci
           ON ci.instructor_id = i.id
          AND ci.course_id = a.course_id
         WHERE a.id = $1
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND ci.is_active = TRUE
         FOR UPDATE OF a`,
        [assessmentId, userId]
    );

    return result.rows[0] || null;
}

async function getQuestionsForPublish(client, assessmentId) {
    const result = await client.query(
        `SELECT
            aq.question_id,
            aq.question_number,
            aq.marks,
            aq.negative_marks,
            q.question_type
         FROM assessment.assessment_question aq
         JOIN assessment.question q
           ON q.id = aq.question_id
         WHERE aq.assessment_id = $1
           AND aq.is_active = TRUE
           AND q.is_active = TRUE
           AND q.soft_delete = FALSE
         ORDER BY aq.question_number`,
        [assessmentId]
    );

    return result.rows;
}

async function getChoiceQuestionOptionCounts(client, questionIds) {
    const result = await client.query(
        `SELECT
            question_id,
            COUNT(*) AS option_count,
            COUNT(*) FILTER (
                WHERE is_correct = TRUE
            ) AS correct_count
         FROM assessment.question_option
         WHERE question_id = ANY($1::bigint[])
           AND is_active = TRUE
         GROUP BY question_id`,
        [questionIds]
    );

    return result.rows;
}

async function publishAssessmentRecord(client, assessmentId, totalMarks, userId) {
    const result = await client.query(
        `UPDATE assessment.assessment
         SET status = 'PUBLISHED',
             total_marks = $2,
             updated_at = NOW(),
             updated_by = $3
         WHERE id = $1
         RETURNING *`,
        [assessmentId, totalMarks, userId]
    );

    return result.rows[0];
}

// ============================================================
// 11. UPDATE ASSESSMENT
// ============================================================

async function getAssessmentStatusForUpdate(client, assessmentId, userId) {
    const result = await client.query(
        `SELECT a.id, a.status
         FROM assessment.assessment a
         JOIN learning.instructor i
           ON i.user_id = $2
         JOIN learning.course_instructor ci
           ON ci.instructor_id = i.id
          AND ci.course_id = a.course_id
         WHERE a.id = $1
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND ci.is_active = TRUE
         FOR UPDATE OF a`,
        [assessmentId, userId]
    );

    return result.rows[0] || null;
}
async function getAssessmentDates(client, assessmentId) {
    const result = await client.query(
        `SELECT available_from, available_until
         FROM assessment.assessment
         WHERE id = $1`,
        [assessmentId]
    );

    return result.rows[0] || null;
}

async function updateAssessmentRecord(client, assessmentId, userId, updates) {
    const fields = Object.keys(updates);

    const setClause = fields.map(
        (field, index) => `${field} = $${index + 1}`
    );

    const values = fields.map(field => updates[field]);

    values.push(assessmentId);
    values.push(userId);

    const result = await client.query(
        `UPDATE assessment.assessment
         SET ${setClause.join(", ")},
             updated_at = NOW(),
             updated_by = $${values.length}
         WHERE id = $${values.length - 1}
         RETURNING *`,
        values
    );

    return result.rows[0];
}

// ============================================================
// 12. GET ASSESSMENT RESULTS
// ============================================================

async function getAssessmentResultsByInstructor(userId, assessmentId) {
    const result = await pool.query(
        `SELECT
            a.id,
            a.course_id,
            a.title AS assessment_title,
            a.assessment_type,
            a.total_marks,
            a.pass_percentage,
            c.title AS course_title
         FROM assessment.assessment a
         JOIN learning.course c
            ON c.id = a.course_id
         JOIN learning.instructor i
            ON i.user_id = $2
         JOIN learning.course_instructor ci
            ON ci.instructor_id = i.id
           AND ci.course_id = a.course_id
         WHERE a.id = $1
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND ci.is_active = TRUE
         LIMIT 1`,
        [assessmentId, userId]
    );

    return result.rows[0] || null;
}

async function getAssessmentAttempts(assessmentId) {
    const result = await pool.query(
        `SELECT
            aa.id AS attempt_id,
            aa.attempt_number,
            aa.status,
            aa.total_questions,
            aa.answered_questions,
            aa.correct_answers,
            aa.wrong_answers,
            aa.unanswered_questions,
            aa.total_marks,
            aa.obtained_marks,
            aa.percentage,
            aa.passed,
            aa.passing_percentage,
            aa.started_at,
            aa.submitted_at,
            aa.time_taken_seconds,
            aa.result_published_at,
            s.id AS student_id,
            s.register_number,
            s.student_code,
            u.first_name,
            u.last_name,
            u.email,
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
         JOIN olp_auth."user" u
            ON u.id = s.user_id
         LEFT JOIN result.certificate cert
            ON cert.enrollment_id = aa.enrollment_id
           AND cert.soft_delete = FALSE
           AND cert.status = 'ISSUED'
         WHERE aa.assessment_id = $1
           AND e.soft_delete = FALSE
           AND e.status IN ('ACTIVE', 'COMPLETED')
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND u.is_active = TRUE
           AND u.soft_delete = FALSE
           AND COALESCE(aa.soft_delete, FALSE) = FALSE
         ORDER BY
            aa.attempt_number DESC,
            aa.submitted_at DESC NULLS LAST`,
        [assessmentId]
    );

    return result.rows;
}

// ============================================================
// 13. ATTEMPT REVIEW AND MANUAL EVALUATION
// ============================================================

async function getAttemptDetailForInstructor(userId, assessmentId, attemptId) {
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
            aa.passed,
            aa.passing_percentage,
            aa.time_taken_seconds,
            aa.last_saved_at,
            aa.result_published_at,
            a.title AS assessment_title,
            a.assessment_code,
            a.assessment_type,
            a.instructions,
            a.duration_minutes,
            a.pass_percentage,
            a.passing_required,
            a.allow_review_after_submission,
            a.total_marks AS assessment_total_marks,
            a.course_id,
            a.module_id,
            c.title AS course_title,
            m.title AS module_title,
            s.id AS student_id,
            s.register_number,
            s.student_code,
            u.first_name,
            u.last_name,
            u.email,
            cert.id AS certificate_id,
            cert.certificate_number,
            cert.certificate_url,
            cert.verification_code,
            cert.issue_date,
            cert.certificate_title,
            cert.status AS certificate_status
         FROM assessment.assessment_attempt aa
         JOIN assessment.assessment a
            ON a.id = aa.assessment_id
         JOIN learning.enrollment e
            ON e.id = aa.enrollment_id
         JOIN learning.student s
            ON s.id = e.student_id
         JOIN olp_auth."user" u
            ON u.id = s.user_id
         JOIN learning.course c
            ON c.id = a.course_id
         LEFT JOIN learning.module m
            ON m.id = a.module_id
         JOIN learning.instructor i
            ON i.user_id = $3
         JOIN learning.course_instructor ci
            ON ci.instructor_id = i.id
           AND ci.course_id = a.course_id
         LEFT JOIN result.certificate cert
            ON cert.enrollment_id = aa.enrollment_id
           AND cert.soft_delete = FALSE
           AND cert.status = 'ISSUED'
         WHERE aa.id = $1
           AND aa.assessment_id = $2
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND ci.is_active = TRUE
           AND e.soft_delete = FALSE
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND u.is_active = TRUE
           AND u.soft_delete = FALSE
           AND COALESCE(aa.soft_delete, FALSE) = FALSE
         LIMIT 1`,
        [attemptId, assessmentId, userId]
    );

    return result.rows[0] || null;
}
async function getAttemptAnswers(client, attemptId) {
    const result = await client.query(
        `SELECT
            ans.id AS answer_id,
            ans.question_id,
            ans.answer_text,
            ans.is_answered,
            ans.is_correct,
            ans.marks_awarded,
            ans.evaluation_comment,
            COALESCE(
                ARRAY_AGG(aao.option_id)
                FILTER (WHERE aao.option_id IS NOT NULL AND aao.soft_delete = FALSE),
                ARRAY[]::BIGINT[]
            ) AS selected_option_ids
         FROM assessment.assessment_answer ans
         LEFT JOIN assessment.assessment_answer_option aao
            ON aao.answer_id = ans.id
         WHERE ans.attempt_id = $1
           AND ans.soft_delete = FALSE
         GROUP BY
            ans.id,
            ans.question_id,
            ans.answer_text,
            ans.is_answered,
            ans.is_correct,
            ans.marks_awarded,
            ans.evaluation_comment`,
        [attemptId]
    );

    return result.rows;
}

async function getAttemptForUpdate(client, userId, attemptId) {
    const result = await client.query(
        `SELECT
            aa.id AS attempt_id,
            aa.assessment_id,
            aa.enrollment_id,
            aa.attempt_number,
            aa.status,
            aa.started_at,
            aa.submitted_at,
            a.pass_percentage,
            a.passing_required,
            a.assessment_type,
            a.course_id,
            a.title AS assessment_title,
            c.title AS course_title,
            s.user_id AS student_user_id,
            a.total_marks AS assessment_total_marks
         FROM assessment.assessment_attempt aa
         JOIN assessment.assessment a
            ON a.id = aa.assessment_id
         JOIN learning.enrollment e
           ON e.id = aa.enrollment_id
          AND e.soft_delete = FALSE
         JOIN learning.student s
           ON s.id = e.student_id
          AND s.is_active = TRUE
          AND s.soft_delete = FALSE
         JOIN learning.course c
           ON c.id = a.course_id
         JOIN learning.instructor i
            ON i.user_id = $2
         JOIN learning.course_instructor ci
            ON ci.instructor_id = i.id
           AND ci.course_id = a.course_id
         WHERE aa.id = $1
           AND a.is_active = TRUE
           AND a.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND ci.is_active = TRUE
           AND COALESCE(aa.soft_delete, FALSE) = FALSE
         FOR UPDATE OF aa`,
        [attemptId, userId]
    );

    return result.rows[0] || null;
}

async function getAttemptQuestionRows(client, attemptId, assessmentId) {
    const result = await client.query(
        `SELECT
            aq.question_id,
            aq.question_number,
            aq.marks,
            aq.negative_marks,
            q.question_type,
            ans.id AS answer_id,
            ans.is_answered,
            ans.answer_text,
            ans.is_correct,
            ans.marks_awarded,
            ans.evaluation_comment,
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
            ans.answer_text,
            ans.is_correct,
            ans.marks_awarded,
            ans.evaluation_comment
         ORDER BY aq.question_number`,
        [attemptId, assessmentId]
    );

    return result.rows;
}

async function updateAnswerEvaluation(client, answerId, data, userId) {
    const result = await client.query(
        `UPDATE assessment.assessment_answer
         SET is_correct = $2,
             marks_awarded = $3,
             evaluation_comment = $4,
             evaluated_at = NOW(),
             updated_at = NOW(),
             updated_by = $5
         WHERE id = $1
           AND soft_delete = FALSE
         RETURNING *`,
        [
            answerId,
            data.isCorrect,
            data.marksAwarded,
            data.evaluationComment,
            userId
        ]
    );

    return result.rows[0] || null;
}

async function updateAttemptEvaluation(client, attemptId, totals, userId) {
    const result = await client.query(
        `UPDATE assessment.assessment_attempt
         SET status = 'EVALUATED',
             submitted_at = COALESCE(submitted_at, NOW()),
             total_questions = $2,
             answered_questions = $3,
             correct_answers = $4,
             wrong_answers = $5,
             unanswered_questions = $6,
             total_marks = $7,
             obtained_marks = $8,
             percentage = $9,
             passed = $10,
             passing_percentage = $11,
             result_published_at = NOW(),
             time_taken_seconds = $12,
             updated_at = NOW(),
             updated_by = $13
         WHERE id = $1
         RETURNING *`,
        [
            attemptId,
            totals.totalQuestions,
            totals.answeredQuestions,
            totals.correctAnswers,
            totals.wrongAnswers,
            totals.unansweredQuestions,
            totals.totalMarks,
            totals.obtainedMarks,
            totals.percentage,
            totals.passed,
            totals.passingPercentage,
            totals.timeTakenSeconds,
            userId
        ]
    );

    return result.rows[0];
}

module.exports = {
    getInstructorId,
    ownsCourse,
    moduleBelongsToCourse,
    createAssessment,
    listAssessments,
    getAssessmentByInstructor,
    getAssessmentQuestions,
    getQuestionOptions,
    createQuestion,
    updateQuestion,
    createQuestionOptions,
    getQuestionByInstructor,
    getExistingQuestionOptions,
    updateQuestionOption,
    moveQuestionOptionToTemporaryValues,
    insertQuestionOption,
    deactivateQuestionOptions,
    getAssessmentForUpdate,
    getQuestionForUpdate,
    questionAlreadyAttached,
    questionNumberAlreadyUsed,
    insertAssessmentQuestion,
    recalculateAssessmentTotalMarks,
    getQuestionDetails,
    getActiveQuestionOptions,
    getAssessmentForPublish,
    getQuestionsForPublish,
    getChoiceQuestionOptionCounts,
    publishAssessmentRecord,
    getAssessmentStatusForUpdate,
    getAssessmentDates,
    updateAssessmentRecord,
    getAssessmentResultsByInstructor,
    getAssessmentAttempts,
    getAttemptDetailForInstructor,
    getAttemptAnswers,
    getAttemptForUpdate,
    getAttemptQuestionRows,
    updateAnswerEvaluation,
    updateAttemptEvaluation
};
