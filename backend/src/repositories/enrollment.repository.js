
const pool = require("../config/database");

// ============================================================
// DATABASE TRANSACTION
// ============================================================
// A transaction groups multiple database queries into one unit.
//
// BEGIN  -> Start transaction
// COMMIT -> Save all changes if everything succeeds
// ROLLBACK -> Undo changes if any query fails
//
// We use this during enrollment so partial enrollment data
// is not saved when an operation fails.
async function withTransaction(callback) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Execute all enrollment queries using the same client.
        const result = await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (error) {
        // Undo database changes if any operation fails.
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        // Always release the database connection back to the pool.
        client.release();
    }
}


// ============================================================
// FIND ACTIVE STUDENT
// ============================================================
// A user must have an active student profile before enrolling.
//
// user_id connects the logged-in user with the student record.
// Here is_active and soft_delete are valid columns in student.
async function findActiveStudent(client, userId) {
    const result = await client.query(
        `SELECT id
         FROM learning.student
         WHERE user_id = $1
           AND soft_delete = FALSE
           AND is_active = TRUE
         LIMIT 1`,
        [userId]
    );

    // Return the student record, or null if it does not exist.
    return result.rows[0] || null;
}


// ============================================================
// FIND PUBLISHED COURSE
// ============================================================
// Check whether the requested course exists and is available.
//
// FOR UPDATE locks the selected course row until the transaction
// finishes. This helps prevent concurrent enrollment operations
// from exceeding the course capacity.
async function findPublishedCourse(client, courseId) {
    const result = await client.query(
        `SELECT id, course_code, title, price, course_type, max_students
         FROM learning.course
         WHERE id = $1
           AND soft_delete = FALSE
           AND is_active = TRUE
           AND status = 'PUBLISHED'
         FOR UPDATE`,
        [courseId]
    );

    return result.rows[0] || null;
}


// ============================================================
// CHECK EXISTING ENROLLMENT
// ============================================================
// Before creating a new enrollment, check whether this student
// is already enrolled in the same course.
//
// IMPORTANT:
// learning.enrollment does NOT have an is_active column.
// Therefore, we check soft_delete and enrollment status only.
async function findExistingEnrollment(client, studentId, courseId) {
    const result = await client.query(
        `SELECT id, status
         FROM learning.enrollment
         WHERE student_id = $1
           AND course_id = $2
           AND soft_delete = FALSE
           AND status IN ('PENDING', 'ACTIVE', 'COMPLETED')
         LIMIT 1`,
        [studentId, courseId]
    );

    return result.rows[0] || null;
}


// ============================================================
// COUNT ACTIVE ENROLLMENTS
// ============================================================
// Count students who currently have an active or completed
// enrollment in this course.
//
// This count is used to check max_students course capacity.
//
// CANCELLED and EXPIRED enrollments are not included.
async function countEnrollments(client, courseId) {
    const result = await client.query(
        `SELECT COUNT(*)::int AS enrolled_count
         FROM learning.enrollment
         WHERE course_id = $1
           AND soft_delete = FALSE
           AND status IN ('ACTIVE', 'COMPLETED')`,
        [courseId]
    );

    return result.rows[0].enrolled_count;
}


// ============================================================
// CREATE ENROLLMENT
// ============================================================
// Insert a new enrollment record after all validations pass.
//
// enrollment_number -> Unique/reference number for the enrollment
// student_id        -> Student who is enrolling
// course_id         -> Course selected by the student
// enrollment_date   -> Date and time of enrollment
// status            -> Initial enrollment status
// created_by        -> Logged-in user who created the record
//
// IMPORTANT:
// Do not insert is_active here because the current
// learning.enrollment table does not contain that column.
async function createEnrollment(
    client,
    enrollmentNumber,
    studentId,
    courseId,
    userId
) {
    const result = await client.query(
        `INSERT INTO learning.enrollment
            (
                enrollment_number,
                student_id,
                course_id,
                enrollment_date,
                status,
                created_by
            )
         VALUES ($1, $2, $3, NOW(), 'ACTIVE', $4)
         RETURNING
            id,
            enrollment_number,
            course_id,
            status,
            enrollment_date`,
        [enrollmentNumber, studentId, courseId, userId]
    );

    return result.rows[0];
}


// ============================================================
// GET MY ENROLLMENTS
// ============================================================
// Fetch all courses enrolled by the currently logged-in student.
//
// We connect:
// student -> enrollment -> course
//
// This function supplies course information for the
// student's My Learning page.
//
// Only non-deleted enrollments with ACTIVE or COMPLETED status
// are returned.
async function getMyEnrollments(userId) {
    const result = await pool.query(
        `SELECT
            e.id AS enrollment_id,
            e.enrollment_number,
            e.status AS enrollment_status,
            e.enrollment_date,
            c.id AS course_id,
            c.title,
            c.short_description,
            c.thumbnail_url,
            c.level,
            c.price,
            c.currency_code,
            c.duration_minutes,
            c.course_type
         FROM learning.student s
         JOIN learning.enrollment e
            ON e.student_id = s.id
         JOIN learning.course c
            ON c.id = e.course_id
         WHERE s.user_id = $1
           AND s.soft_delete = FALSE
           AND s.is_active = TRUE
           AND e.soft_delete = FALSE
           AND e.status IN ('ACTIVE', 'COMPLETED')
           AND c.soft_delete = FALSE
         ORDER BY e.enrollment_date DESC`,
        [userId]
    );

    return result.rows;
}


// ============================================================
// REMOVE ENROLLMENT FROM MY LEARNING
// ============================================================
// Remove an enrollment only when it belongs to the logged-in
// student and its current status is ACTIVE.
//
// We use SOFT DELETE instead of permanently deleting the row.
// soft_delete = TRUE -> Marks the enrollment as deleted
// deleted_at = NOW() -> Stores when it was removed
//
// IMPORTANT:
// learning.enrollment does not have an is_active column.
async function getInstructorEnrollmentReport(userId, filters = {}) {
    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(filters.limit, 10) || 20));
    const conditions = [
        "i.user_id = $1",
        "i.soft_delete = FALSE",
        "i.is_active = TRUE",
        "ci.is_active = TRUE",
        "c.soft_delete = FALSE",
        "e.soft_delete = FALSE",
        "s.soft_delete = FALSE",
        "u.soft_delete = FALSE"
    ];
    const values = [userId];
    if (filters.status) {
        values.push(filters.status);
        conditions.push(`UPPER(e.status) = UPPER($${values.length})`);
    }
    if (filters.fromDate) {
        values.push(filters.fromDate);
        conditions.push(`e.enrollment_date >= $${values.length}::date`);
    }
    if (filters.toDate) {
        values.push(filters.toDate);
        conditions.push(`e.enrollment_date < ($${values.length}::date + INTERVAL '1 day')`);
    }

    const from = `learning.instructor i
        JOIN learning.course_instructor ci ON ci.instructor_id = i.id
        JOIN learning.course c ON c.id = ci.course_id
        JOIN learning.enrollment e ON e.course_id = c.id
        JOIN learning.student s ON s.id = e.student_id
        JOIN olp_auth."user" u ON u.id = s.user_id`;
    const where = conditions.join(" AND ");
    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM ${from} WHERE ${where}`,
        values
    );
    const summaryResult = await pool.query(
        `SELECT COUNT(*)::int AS total_enrollments,
                COUNT(DISTINCT e.student_id)::int AS total_students,
                COUNT(DISTINCT c.id)::int AS total_courses,
                COUNT(*) FILTER (WHERE UPPER(e.status) = 'ACTIVE')::int AS active_enrollments,
                COUNT(*) FILTER (WHERE UPPER(e.status) = 'COMPLETED')::int AS completed_enrollments,
                COUNT(*) FILTER (WHERE UPPER(e.status) = 'PENDING')::int AS pending_enrollments,
                COUNT(*) FILTER (WHERE UPPER(e.status) = 'CANCELLED')::int AS cancelled_enrollments,
                COALESCE(SUM(c.price), 0) AS total_course_value
         FROM ${from} WHERE ${where}`,
        values
    );
    const offset = (page - 1) * limit;
    const rowsResult = await pool.query(
        `SELECT e.id, e.enrollment_number, e.enrollment_date, e.completed_at,
                e.last_accessed_at, e.status, e.course_id,
                c.title AS course_title, c.course_code, c.price, c.currency_code,
                s.student_code, s.register_number,
                TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS student_name,
                u.email AS student_email
         FROM ${from} WHERE ${where}
         ORDER BY e.enrollment_date DESC, e.id DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
    );

    return {
        rows: rowsResult.rows,
        summary: summaryResult.rows[0] || {},
        pagination: { page, limit, total: countResult.rows[0]?.total || 0 }
    };
}

async function getInstructorStudents(userId) {
    const result = await pool.query(
        `SELECT s.id::text AS id,
                s.student_code,
                s.register_number,
                TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS student_name,
                u.email AS student_email,
                COUNT(DISTINCT e.id)::int AS enrollment_count,
                COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'COMPLETED')::int AS completed_courses,
                STRING_AGG(DISTINCT c.title, ', ' ORDER BY c.title) AS course_titles,
                MAX(e.enrollment_date) AS most_recent_enrollment,
                MAX(e.last_accessed_at) AS last_student_activity_at
         FROM learning.instructor i
         JOIN learning.course_instructor ci
           ON ci.instructor_id = i.id AND ci.is_active = TRUE
         JOIN learning.course c
           ON c.id = ci.course_id AND c.soft_delete = FALSE
         JOIN learning.enrollment e
           ON e.course_id = c.id AND e.soft_delete = FALSE
         JOIN learning.student s
           ON s.id = e.student_id AND s.soft_delete = FALSE
         JOIN olp_auth."user" u
           ON u.id = s.user_id AND u.soft_delete = FALSE
         WHERE i.user_id = $1
           AND i.soft_delete = FALSE
           AND i.is_active = TRUE
           AND e.status IN ('ACTIVE', 'COMPLETED')
         GROUP BY s.id, u.id
         ORDER BY MAX(e.last_accessed_at) DESC NULLS LAST,
                  MAX(e.enrollment_date) DESC`,
        [userId]
    );

    return result.rows;
}

// Remove an active enrollment belonging to this student
async function removeMyEnrollment(enrollmentId, userId) {
    const result = await pool.query(
        `UPDATE learning.enrollment e
         SET soft_delete = TRUE,
             deleted_at = NOW(),
             updated_at = NOW()
             deleted_at = NOW()
         WHERE e.id = $1
           AND e.student_id = (
               SELECT s.id
               FROM learning.student s
               WHERE s.user_id = $2
                 AND s.soft_delete = FALSE
                 AND s.is_active = TRUE
               LIMIT 1
           )
           AND e.soft_delete = FALSE
           AND e.status = 'ACTIVE'
         RETURNING e.id AS enrollment_id`,
        [enrollmentId, userId]
    );

    return result.rows[0] || null;
}


// ============================================================
// EXPORT REPOSITORY FUNCTIONS
// ============================================================
// The service layer imports these functions and uses them
// to perform enrollment-related database operations.
module.exports = {
    withTransaction,
    findActiveStudent,
    findPublishedCourse,
    findExistingEnrollment,
    countEnrollments,
    createEnrollment,
    getMyEnrollments,
    getInstructorEnrollmentReport,
    getInstructorStudents,
    removeMyEnrollment
};
