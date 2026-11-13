ALTER TABLE olp_auth."user"
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0
        CHECK (session_version >= 0);

ALTER TABLE olp_auth.refresh_token
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0
        CHECK (session_version >= 0);

CREATE TABLE IF NOT EXISTS olp_auth.account_preference (
    user_id BIGINT PRIMARY KEY
        REFERENCES olp_auth."user"(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(preferences) = 'object'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
