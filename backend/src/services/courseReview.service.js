const repository = require("../repositories/courseReview.repository");
const pool = require("../config/database");

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function getCourseReviews(courseId, userId = null) {
    const course = await pool.query(
        `SELECT id FROM learning.course
         WHERE id = $1 AND status = 'PUBLISHED'
           AND is_active = TRUE AND soft_delete = FALSE
         LIMIT 1`,
        [courseId]
    );
    if (!course.rows[0]) throw createError("Course not found.", 404);
    return repository.listCourseReviews(courseId, userId);
}

async function saveCourseReview(courseId, userId, payload = {}) {
    const rating = Number(payload.rating);
    const reviewText = String(payload.review_text ?? "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw createError("Choose a rating from 1 to 5 stars.", 400);
    }
    if (reviewText.length > 3000) {
        throw createError("Reviews can be up to 3,000 characters.", 400);
    }

    const course = await pool.query(
        `SELECT EXISTS (
            SELECT 1
            FROM learning.student s
            JOIN learning.enrollment e ON e.student_id = s.id
            JOIN learning.course c ON c.id = e.course_id
            WHERE s.user_id = $2
              AND s.is_active = TRUE AND s.soft_delete = FALSE
              AND e.course_id = $1 AND e.soft_delete = FALSE
              AND e.status IN ('ACTIVE', 'COMPLETED')
              AND c.status = 'PUBLISHED'
              AND c.is_active = TRUE AND c.soft_delete = FALSE
         ) AS can_review`,
        [courseId, userId]
    );
    if (!course.rows[0]?.can_review) {
        throw createError("Enroll in this course before leaving a review.", 403);
    }

    return repository.saveCourseReview({ courseId, userId, rating, reviewText });
}

module.exports = { getCourseReviews, saveCourseReview };
