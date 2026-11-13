-- Community module schema. Safe to apply more than once.
CREATE SCHEMA IF NOT EXISTS community;

CREATE TABLE IF NOT EXISTS community.category (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  parent_category_id BIGINT REFERENCES community.category(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT
);

CREATE TABLE IF NOT EXISTS community.post (
  id BIGSERIAL PRIMARY KEY,
  post_number VARCHAR(80) NOT NULL UNIQUE,
  category_id BIGINT NOT NULL REFERENCES community.category(id),
  author_user_id BIGINT NOT NULL,
  course_id BIGINT,
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  post_type VARCHAR(24) NOT NULL DEFAULT 'DISCUSSION' CHECK (post_type IN ('QUESTION','DISCUSSION','ANNOUNCEMENT')),
  status VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT','PUBLISHED','CLOSED','REMOVED')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  last_replied_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS community.reply (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community.post(id),
  parent_reply_id BIGINT REFERENCES community.reply(id),
  author_user_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','EDITED','REMOVED')),
  is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS community.post_reaction (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community.post(id),
  user_id BIGINT NOT NULL,
  reaction_type VARCHAR(24) NOT NULL CHECK (reaction_type IN ('LIKE','HELPFUL','THANKS','LOVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS community.reply_reaction (
  id BIGSERIAL PRIMARY KEY,
  reply_id BIGINT NOT NULL REFERENCES community.reply(id),
  user_id BIGINT NOT NULL,
  reaction_type VARCHAR(24) NOT NULL CHECK (reaction_type IN ('LIKE','HELPFUL','THANKS','LOVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (reply_id, user_id)
);

CREATE TABLE IF NOT EXISTS community.post_bookmark (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community.post(id),
  user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS community.notification (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  post_id BIGINT REFERENCES community.post(id),
  reply_id BIGINT REFERENCES community.reply(id),
  notification_type VARCHAR(40) NOT NULL,
  title VARCHAR(250) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS community.post_report (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community.post(id),
  reporter_user_id BIGINT NOT NULL,
  report_type VARCHAR(32) NOT NULL CHECK (report_type IN ('SPAM','ABUSE','HARASSMENT','INAPPROPRIATE','OFF_TOPIC','COPYRIGHT','OTHER')),
  reason TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','DISMISSED','ACTION_TAKEN')),
  review_comment TEXT,
  reviewed_by BIGINT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (post_id, reporter_user_id)
);

CREATE TABLE IF NOT EXISTS community.reply_report (
  id BIGSERIAL PRIMARY KEY,
  reply_id BIGINT NOT NULL REFERENCES community.reply(id),
  reporter_user_id BIGINT NOT NULL,
  report_type VARCHAR(32) NOT NULL CHECK (report_type IN ('SPAM','ABUSE','HARASSMENT','INAPPROPRIATE','OFF_TOPIC','COPYRIGHT','OTHER')),
  reason TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','DISMISSED','ACTION_TAKEN')),
  review_comment TEXT,
  reviewed_by BIGINT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT,
  soft_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (reply_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS community_post_feed_idx
  ON community.post (status, is_active, soft_delete, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS community_post_category_feed_idx
  ON community.post (category_id, created_at DESC) WHERE is_active AND NOT soft_delete;
CREATE INDEX IF NOT EXISTS community_post_author_idx
  ON community.post (author_user_id, created_at DESC) WHERE is_active AND NOT soft_delete;
CREATE INDEX IF NOT EXISTS community_post_search_idx
  ON community.post USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));
CREATE INDEX IF NOT EXISTS community_reply_thread_idx
  ON community.reply (post_id, parent_reply_id, created_at) WHERE is_active AND NOT soft_delete;
CREATE INDEX IF NOT EXISTS community_notification_inbox_idx
  ON community.notification (user_id, is_read, created_at DESC) WHERE NOT soft_delete;
CREATE INDEX IF NOT EXISTS community_post_report_queue_idx
  ON community.post_report (status, created_at DESC) WHERE NOT soft_delete;
CREATE INDEX IF NOT EXISTS community_reply_report_queue_idx
  ON community.reply_report (status, created_at DESC) WHERE NOT soft_delete;

INSERT INTO community.category (code, name, description, display_order)
VALUES
  ('GENERAL', 'General Discussion', 'General questions and conversations.', 1),
  ('COURSE_HELP', 'Course Help', 'Questions about course lessons and assignments.', 2),
  ('CAREER', 'Career & Projects', 'Share projects, portfolios, and career questions.', 3)
ON CONFLICT (code) DO NOTHING;
