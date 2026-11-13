const pool = require("../config/database");

async function createChallenge({ userId, email, otpHash, linkTokenHash }) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `SELECT id FROM olp_auth."user" WHERE id = $1 FOR UPDATE`,
            [userId],
        );
        const recent = await client.query(
            `SELECT COUNT(*)::integer AS request_count
             FROM olp_auth.password_reset_challenge
             WHERE user_id = $1
               AND created_at > NOW() - INTERVAL '1 hour'`,
            [userId],
        );
        if (recent.rows[0].request_count >= 3) {
            await client.query("ROLLBACK");
            return null;
        }

        await client.query(
            `UPDATE olp_auth.password_reset_challenge
             SET consumed_at = NOW(), reset_ticket_hash = NULL
             WHERE user_id = $1 AND consumed_at IS NULL`,
            [userId],
        );
        const result = await client.query(
            `INSERT INTO olp_auth.password_reset_challenge (
                user_id, email_normalized, otp_hash, link_token_hash, expires_at
             ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 minutes')
             RETURNING id`,
            [userId, email, otpHash, linkTokenHash],
        );
        await client.query("COMMIT");
        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function consumeChallenge(challengeId) {
    await pool.query(
        `UPDATE olp_auth.password_reset_challenge
         SET consumed_at = NOW(), reset_ticket_hash = NULL
         WHERE id = $1 AND consumed_at IS NULL`,
        [challengeId],
    );
}

async function findChallengeForOtp(email, linkTokenHash) {
    const result = await pool.query(
        `SELECT id, user_id, otp_hash, attempt_count
         FROM olp_auth.password_reset_challenge
         WHERE email_normalized = $1
           AND link_token_hash = $2
           AND consumed_at IS NULL
           AND expires_at > NOW()
           AND attempt_count < 5
         ORDER BY created_at DESC
         LIMIT 1`,
        [email, linkTokenHash],
    );
    return result.rows[0] || null;
}

async function incrementFailedOtp(challengeId) {
    await pool.query(
        `UPDATE olp_auth.password_reset_challenge
         SET attempt_count = attempt_count + 1,
             consumed_at = CASE WHEN attempt_count + 1 >= 5 THEN NOW() ELSE consumed_at END
         WHERE id = $1 AND consumed_at IS NULL`,
        [challengeId],
    );
}

async function saveVerifiedTicket(challengeId, ticketHash) {
    const result = await pool.query(
        `UPDATE olp_auth.password_reset_challenge
         SET reset_ticket_hash = $2,
             verified_expires_at = NOW() + INTERVAL '10 minutes'
         WHERE id = $1
           AND consumed_at IS NULL
           AND expires_at > NOW()
           AND attempt_count < 5
         RETURNING id`,
        [challengeId, ticketHash],
    );
    return result.rowCount === 1;
}

async function completePasswordReset({ email, ticketHash, passwordHash }) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const challengeResult = await client.query(
            `SELECT id, user_id
             FROM olp_auth.password_reset_challenge
             WHERE email_normalized = $1
               AND reset_ticket_hash = $2
               AND verified_expires_at > NOW()
               AND expires_at > NOW()
               AND consumed_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [email, ticketHash],
        );
        const challenge = challengeResult.rows[0];
        if (!challenge) {
            await client.query("ROLLBACK");
            return false;
        }

        const updatedUser = await client.query(
            `UPDATE olp_auth."user"
             SET password_hash = $2,
                 password_changed_at = NOW(),
                 session_version = session_version + 1,
                 failed_login_attempts = 0,
                 is_locked = FALSE,
                 locked_until = NULL,
                 updated_at = NOW(),
                 updated_by = $1
             WHERE id = $1 AND LOWER(email) = $3 AND soft_delete = FALSE
             RETURNING id`,
            [challenge.user_id, passwordHash, email],
        );
        if (!updatedUser.rowCount) {
            await client.query("ROLLBACK");
            return false;
        }

        await client.query(
            `UPDATE olp_auth.refresh_token
             SET revoked_at = COALESCE(revoked_at, NOW()),
                 revoked_by = $1,
                 updated_by = $1
             WHERE user_id = $1 AND revoked_at IS NULL AND soft_delete = FALSE`,
            [challenge.user_id],
        );
        await client.query(
            `UPDATE olp_auth.password_reset_challenge
             SET consumed_at = NOW(), reset_ticket_hash = NULL
             WHERE user_id = $1 AND consumed_at IS NULL`,
            [challenge.user_id],
        );
        await client.query("COMMIT");
        return true;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    createChallenge,
    consumeChallenge,
    findChallengeForOtp,
    incrementFailedOtp,
    saveVerifiedTicket,
    completePasswordReset,
};
