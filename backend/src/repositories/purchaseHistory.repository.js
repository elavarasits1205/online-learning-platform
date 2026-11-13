
const { pool } = require("./payment.repository");

// ============================================================
// GET STUDENT PURCHASE HISTORY
// Fetch only successful Demo Checkout purchases.
// Real payment gateways and unsuccessful payments are excluded.
// ============================================================

async function getPurchaseHistory(userId, limit = 10, offset = 0) {
    const result = await pool.query(
        `SELECT
            p.id AS payment_id,
            p.payment_number,
            p.enrollment_id,
            p.course_id,

            c.title AS course_title,
            c.thumbnail_url AS course_thumbnail,

            p.currency_code,
            p.original_amount,
            p.discount_amount,
            p.coupon_discount_amount,
            p.referral_discount_amount,
            p.tax_amount,
            p.final_amount,
            p.paid_amount,

            p.status AS payment_status,
            p.payment_method,
            p.payment_gateway,

            p.paid_at,
            p.created_at AS purchase_date,

            e.status AS enrollment_status,

            pt.transaction_number,
            pt.status AS transaction_status

        FROM payment.payment p

        INNER JOIN learning.student s
            ON s.id = p.student_id

        LEFT JOIN learning.course c
            ON c.id = p.course_id

        LEFT JOIN learning.enrollment e
            ON e.id = p.enrollment_id

        LEFT JOIN LATERAL (
            SELECT
                t.transaction_number,
                t.status
            FROM payment.payment_transaction t
            WHERE t.payment_id = p.id
              AND t.payment_gateway = 'DEMO'
              AND t.payment_method = 'DEMO'
              AND t.transaction_type = 'PAYMENT'
              AND t.status = 'SUCCESS'
              AND t.soft_delete = FALSE
            ORDER BY t.created_at DESC, t.id DESC
            LIMIT 1
        ) pt ON TRUE

        WHERE s.user_id = $1
          AND s.is_active = TRUE
          AND s.soft_delete = FALSE

          AND p.soft_delete = FALSE
          AND p.payment_gateway = 'DEMO'
          AND p.payment_method = 'DEMO'
          AND p.status = 'PAID'

          AND pt.transaction_number IS NOT NULL

        ORDER BY p.paid_at DESC NULLS LAST,
                 p.created_at DESC,
                 p.id DESC

        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
    );

    return result.rows;
}

// ============================================================
// COUNT STUDENT PURCHASE HISTORY
// Count only successful Demo Checkout purchases.
// Used for pagination.
// ============================================================

async function countPurchaseHistory(userId) {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS total

         FROM payment.payment p

         INNER JOIN learning.student s
            ON s.id = p.student_id

         WHERE s.user_id = $1
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE

           AND p.soft_delete = FALSE
           AND p.payment_gateway = 'DEMO'
           AND p.payment_method = 'DEMO'
           AND p.status = 'PAID'

           AND EXISTS (
               SELECT 1
               FROM payment.payment_transaction t
               WHERE t.payment_id = p.id
                 AND t.payment_gateway = 'DEMO'
                 AND t.payment_method = 'DEMO'
                 AND t.transaction_type = 'PAYMENT'
                 AND t.status = 'SUCCESS'
                 AND t.soft_delete = FALSE
           )`,
        [userId]
    );

    return result.rows[0].total;
}

module.exports = {
    getPurchaseHistory,
    countPurchaseHistory
};
