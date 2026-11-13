const pool = require("../config/database");

// ============================================================
// FIND ACTIVE STUDENT
// ============================================================

async function findStudentByUserId(userId) {

    const result = await pool.query(
        `SELECT id
         FROM learning.student
         WHERE user_id = $1
           AND is_active = TRUE
           AND soft_delete = FALSE
         LIMIT 1`,
        [userId]
    );

    return result.rows[0] || null;
}


// ============================================================
// GET OR CREATE ACTIVE CART
// ============================================================

async function getOrCreateActiveCart(studentId) {

    // Create a cart only if the student does not have one.
    await pool.query(
        `INSERT INTO learning.cart (student_id)
         VALUES ($1)
         ON CONFLICT (student_id)
         WHERE status = 'ACTIVE'
           AND soft_delete = FALSE
         DO NOTHING`,
        [studentId]
    );

    const result = await pool.query(
        `SELECT id, student_id, status, created_at
         FROM learning.cart
         WHERE student_id = $1
           AND status = 'ACTIVE'
           AND soft_delete = FALSE
         LIMIT 1`,
        [studentId]
    );

    return result.rows[0] || null;
}


// ============================================================
// FIND AVAILABLE PAID COURSE
// ============================================================

async function findPurchasableCourse(courseId) {

    const result = await pool.query(
        `SELECT
            id,
            title,
            price,
            currency_code,
            course_type,
            status,
            thumbnail_url,
            level

         FROM learning.course

         WHERE id = $1
           AND soft_delete = FALSE
           AND is_active = TRUE
           AND status = 'PUBLISHED'
           AND course_type = 'PAID'

         LIMIT 1`,
        [courseId]
    );

    return result.rows[0] || null;
}


// ============================================================
// CHECK EXISTING ENROLLMENT
// ============================================================

async function isStudentEnrolled(studentId, courseId) {

    const result = await pool.query(
        `SELECT id
         FROM learning.enrollment
         WHERE student_id = $1
           AND course_id = $2
           AND soft_delete = FALSE
           AND status IN ('ACTIVE', 'COMPLETED')
         LIMIT 1`,
        [studentId, courseId]
    );

    return result.rowCount > 0;
}


// ============================================================
// ADD COURSE TO CART
// ============================================================

async function addCartItem(cartId, courseId) {

    const result = await pool.query(
        `INSERT INTO learning.cart_item (
            cart_id,
            course_id
         )
         VALUES ($1, $2)

         ON CONFLICT (cart_id, course_id)
         DO NOTHING

         RETURNING id, cart_id, course_id, added_at`,
        [cartId, courseId]
    );

    return result.rows[0] || null;
}


// ============================================================
// GET CART DETAILS
// ============================================================

async function getCartDetails(studentId) {

    const result = await pool.query(
        `SELECT
            cart.id AS cart_id,
            cart.status AS cart_status,

            COALESCE(
                json_agg(
                    json_build_object(
                        'cart_item_id', ci.id,
                        'course_id', course.id,
                        'title', course.title,
                        'thumbnail_url', course.thumbnail_url,
                        'price', course.price,
                        'currency_code', course.currency_code,
                        'level', course.level,
                        'added_at', ci.added_at
                    )
                    ORDER BY ci.added_at DESC
                ) FILTER (WHERE ci.id IS NOT NULL),
                '[]'::json
            ) AS items,

            COALESCE(
                SUM(course.price),
                0
            ) AS subtotal

         FROM learning.cart cart

         LEFT JOIN learning.cart_item ci
            ON ci.cart_id = cart.id

         LEFT JOIN learning.course course
            ON course.id = ci.course_id
           AND course.soft_delete = FALSE
           AND course.is_active = TRUE
           AND course.status = 'PUBLISHED'

         WHERE cart.student_id = $1
           AND cart.status = 'ACTIVE'
           AND cart.soft_delete = FALSE

         GROUP BY cart.id, cart.status`,
        [studentId]
    );

    return result.rows[0] || null;
}


// ============================================================
// REMOVE COURSE FROM CART
// ============================================================

async function removeCartItem(cartId, courseId) {

    const result = await pool.query(
        `DELETE FROM learning.cart_item
         WHERE cart_id = $1
           AND course_id = $2
         RETURNING id`,
        [cartId, courseId]
    );

    return result.rowCount > 0;
}


// ============================================================
// EXPORT REPOSITORY FUNCTIONS
// ============================================================

module.exports = {
    findStudentByUserId,
    getOrCreateActiveCart,
    findPurchasableCourse,
    isStudentEnrolled,
    addCartItem,
    getCartDetails,
    removeCartItem
};