const pool = require("../config/database");

async function findByUserId(userId) {
    const result = await pool.query(
        `SELECT preferences
         FROM olp_auth.account_preference
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
    );

    return result.rows[0]?.preferences || {};
}

async function mergeForUser(userId, preferences) {
    const result = await pool.query(
        `INSERT INTO olp_auth.account_preference (user_id, preferences)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id)
         DO UPDATE SET
            preferences = olp_auth.account_preference.preferences || EXCLUDED.preferences,
            updated_at = NOW()
         RETURNING preferences`,
        [userId, JSON.stringify(preferences)]
    );

    return result.rows[0]?.preferences || {};
}

module.exports = { findByUserId, mergeForUser };
