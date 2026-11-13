CREATE TABLE IF NOT EXISTS olp_auth.notification_preference (
    user_id BIGINT PRIMARY KEY
        REFERENCES olp_auth."user"(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(preferences) = 'object'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
