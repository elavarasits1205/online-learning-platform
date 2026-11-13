const pool = require("../config/database");

async function listCourseReviews(courseId, userId = null) {
    const [summary, reviews, ownReview, permission] = await Promise.all([
        pool.query(
            `SELECT COUNT(*)::integer AS review_count,
                    COALESCE(AVG(rating), 0)::numeric(3,2) AS average_rating
             FROM learning.course_review
             WHERE course_id = $1 AND soft_delete = FALSE`,
            [courseId]
        ),
        pool.query(
            `SELECT r.id, r.rating, r.review_text, r.created_at,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.username, 'Student') AS student_name
             FROM learning.course_review r
             JOIN olp_auth."user" u ON u.id = r.student_user_id
             WHERE r.course_id = $1 AND r.soft_delete = FALSE
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT 50`,
            [courseId]
        ),
        userId
            ? pool.query(
                `SELECT id, rating, review_text
                 FROM learning.course_review
                 WHERE course_id = $1 AND student_user_id = $2 AND soft_delete = FALSE
                 LIMIT 1`,
                [courseId, userId]
            )
            : Promise.resolve({ rows: [] }),
        userId
            ? pool.query(
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
            )
            : Promise.resolve({ rows: [{ can_review: false }] }),
    ]);

    return {
        summary: summary.rows[0],
        reviews: reviews.rows,
        my_review: ownReview.rows[0] || null,
        can_review: permission.rows[0]?.can_review === true,
    };
}

async function saveCourseReview({ courseId, userId, rating, reviewText }) {
    const result = await pool.query(
        `INSERT INTO learning.course_review (
            course_id, student_user_id, rating, review_text, soft_delete
         ) VALUES ($1, $2, $3, $4, FALSE)
         ON CONFLICT (course_id, student_user_id)
         DO UPDATE SET rating = EXCLUDED.rating,
                       review_text = EXCLUDED.review_text,
                       soft_delete = FALSE,
                       updated_at = NOW()
         RETURNING id, course_id, rating, review_text, created_at, updated_at`,
        [courseId, userId, rating, reviewText]
    );

    return result.rows[0];
}

module.exports = { listCourseReviews, saveCourseReview };
