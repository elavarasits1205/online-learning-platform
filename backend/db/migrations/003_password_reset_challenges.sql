-- Short-lived challenges used by the forgot-password flow.
CREATE TABLE IF NOT EXISTS olp_auth.password_reset_challenge (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES olp_auth."user"(id) ON DELETE CASCADE,
    email_normalized TEXT NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    link_token_hash CHAR(64) NOT NULL UNIQUE,
    reset_ticket_hash CHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    verified_expires_at TIMESTAMPTZ,
    attempt_count SMALLINT NOT NULL DEFAULT 0
        CHECK (attempt_count BETWEEN 0 AND 5),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_created
    ON olp_auth.password_reset_challenge (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_active_expiry
    ON olp_auth.password_reset_challenge (expires_at)
    WHERE consumed_at IS NULL;
