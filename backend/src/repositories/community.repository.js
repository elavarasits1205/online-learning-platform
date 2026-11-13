
const pool = require("../config/database");

// ============================================================
// CREATE COMMUNITY NOTIFICATION (IN THE CURRENT TRANSACTION)
// ============================================================

async function createNotification(client, {
    userId,
    postId,
    replyId = null,
    notificationType,
    title,
    message,
    createdBy
}) {
    // Do not notify a user about their own action.
    if (!userId || Number(userId) === Number(createdBy)) {
        return null;
    }

    const preferenceResult = await client.query(
        `SELECT preferences ->> 'community' AS enabled
         FROM olp_auth.notification_preference
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
    );
    if (preferenceResult.rows[0]?.enabled === "false") return null;

    const result = await client.query(
        `INSERT INTO community.notification (
            user_id,
            post_id,
            reply_id,
            notification_type,
            title,
            message,
            is_read,
            created_at,
            created_by,
            soft_delete
        )
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW(), $7, FALSE)
        RETURNING *`,
        [userId, postId, replyId, notificationType, title, message, createdBy]
    );

    return result.rows[0];
}

// ============================================================
// GET ACTIVE COMMUNITY CATEGORIES
// ============================================================

async function getCategories() {
    const result = await pool.query(
        `SELECT
            c.id,
            c.code,
            c.name,
            c.description,
            c.parent_category_id,
            c.display_order
         FROM community.category c
         WHERE c.is_active = TRUE
           AND c.soft_delete = FALSE
         ORDER BY c.display_order ASC, c.name ASC`
    );

    return result.rows;
}

async function searchMentionSuggestions(query, requesterId) {
    const result = await pool.query(
        `SELECT
            u.id::text AS id,
            u.username,
            CONCAT_WS(' ', u.first_name, u.last_name) AS display_name,
            ARRAY_AGG(DISTINCT UPPER(BTRIM(r.code))) AS roles
         FROM olp_auth."user" u
         JOIN olp_auth.user_role ur
           ON ur.user_id = u.id
          AND ur.is_active = TRUE
          AND ur.soft_delete = FALSE
         JOIN olp_auth.role r
           ON r.id = ur.role_id
          AND r.is_active = TRUE
          AND r.soft_delete = FALSE
         WHERE u.id <> $3::bigint
           AND u.is_active = TRUE
           AND u.is_locked = FALSE
           AND u.approval_status = 'APPROVED'
           AND u.soft_delete = FALSE
           AND UPPER(BTRIM(r.code)) IN ('STUDENT', 'INSTRUCTOR', 'ADMIN')
           AND (
                u.username ILIKE $1
                OR u.first_name ILIKE $2
                OR COALESCE(u.last_name, '') ILIKE $2
           )
         GROUP BY u.id, u.username, u.first_name, u.last_name
         ORDER BY
            CASE WHEN u.username ILIKE $1 THEN 0 ELSE 1 END,
            u.username ASC
         LIMIT 10`,
        [`${query}%`, `%${query}%`, requesterId]
    );

    return result.rows;
}

async function findMentionedUsers(usernames, requesterId) {
    if (!Array.isArray(usernames) || usernames.length === 0) return [];

    const result = await pool.query(
        `SELECT DISTINCT u.id::text AS id, u.username
         FROM olp_auth."user" u
         JOIN olp_auth.user_role ur
           ON ur.user_id = u.id
          AND ur.is_active = TRUE
          AND ur.soft_delete = FALSE
         JOIN olp_auth.role r
           ON r.id = ur.role_id
          AND r.is_active = TRUE
          AND r.soft_delete = FALSE
         WHERE LOWER(u.username) = ANY($1::text[])
           AND u.id <> $2::bigint
           AND u.is_active = TRUE
           AND u.is_locked = FALSE
           AND u.approval_status = 'APPROVED'
           AND u.soft_delete = FALSE
           AND UPPER(BTRIM(r.code)) IN ('STUDENT', 'INSTRUCTOR', 'ADMIN')`,
        [usernames, requesterId]
    );

    return result.rows;
}

// ============================================================
// GET COMMUNITY POSTS
// ============================================================
async function getPosts({
    conditions,
    values,
    limit,
    offset,
    userId
}) {
    const where = conditions.join(" AND ");

    // COUNT POSTS
    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM community.post p

         JOIN community.category c
           ON c.id = p.category_id

         WHERE ${where}`,
        values
    );

    const queryValues = [...values, userId, limit, offset];

    // FETCH POSTS
    const result = await pool.query(
        `SELECT
            p.id,
            p.post_number,
            p.category_id,
            p.author_user_id,
            p.course_id,
            p.title,
            p.content,
            p.post_type,
            p.status,
            p.is_pinned,
            p.is_locked,
            p.is_anonymous,
            p.view_count,
            p.reply_count,
            p.reaction_count,
            p.bookmark_count,
            p.last_replied_at,
            p.published_at,
            p.created_at,

            c.name AS category_name,
            c.code AS category_code,

            CASE
                WHEN p.is_anonymous = TRUE THEN 'Anonymous'
                ELSE CONCAT_WS(' ', u.first_name, u.last_name)
            END AS author_name,

            EXISTS (
                SELECT 1
                FROM community.post_reaction pr
                WHERE pr.post_id = p.id
                  AND pr.user_id = $${values.length + 1}
                  AND pr.soft_delete = FALSE
            ) AS is_reacted,

            EXISTS (
                SELECT 1
                FROM community.post_bookmark pb
                WHERE pb.post_id = p.id
                  AND pb.user_id = $${values.length + 1}
                  AND pb.soft_delete = FALSE
            ) AS is_bookmarked

         FROM community.post p

         JOIN community.category c
           ON c.id = p.category_id

         LEFT JOIN olp_auth."user" u
           ON u.id = p.author_user_id

         WHERE ${where}

         ORDER BY
            p.is_pinned DESC,
            p.created_at DESC

         LIMIT $${values.length + 2}
         OFFSET $${values.length + 3}`,
        queryValues
    );

    return {
        posts: result.rows,
        total: countResult.rows[0].total
    };
}

// ============================================================
// FIND POST BY ID
// ============================================================

async function findPostById(postId, userId = null) {
    const result = await pool.query(
        `SELECT
            p.id,
            p.post_number,
            p.category_id,
            p.author_user_id,
            p.course_id,
            p.title,
            p.content,
            p.post_type,
            p.status,
            p.is_pinned,
            p.is_locked,
            p.is_anonymous,
            p.view_count,
            p.reply_count,
            p.reaction_count,
            p.bookmark_count,
            p.created_at,
            p.updated_at,

            c.name AS category_name,

            EXISTS (
                SELECT 1 FROM community.post_reaction pr
                WHERE pr.post_id = p.id AND pr.user_id = $2
                  AND pr.soft_delete = FALSE
            ) AS is_reacted,

            CASE
                WHEN p.is_anonymous = TRUE THEN 'Anonymous'
                ELSE CONCAT_WS(' ', u.first_name, u.last_name)
            END AS author_name

         FROM community.post p

         JOIN community.category c
           ON c.id = p.category_id

         LEFT JOIN olp_auth."user" u
           ON u.id = p.author_user_id

         WHERE p.id = $1
           AND p.soft_delete = FALSE
           AND p.is_active = TRUE
           AND p.status IN ('PUBLISHED', 'CLOSED')
         LIMIT 1`,
        [postId, userId]
    );

    return result.rows[0] || null;
}

// ============================================================
// CHECK CATEGORY
// ============================================================

async function findActiveCategory(categoryId) {
    const result = await pool.query(
        `SELECT id, code, name
         FROM community.category
         WHERE id = $1
           AND is_active = TRUE
           AND soft_delete = FALSE
         LIMIT 1`,
        [categoryId]
    );

    return result.rows[0] || null;
}

// ============================================================
// CREATE POST
// ============================================================

async function createPost({
    categoryId,
    userId,
    courseId,
    title,
    content,
    postType,
    isAnonymous,
    mentionedUserIds = []
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Unique post number generated by backend.
        const postNumber =
            `COM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const result = await client.query(
            `INSERT INTO community.post (
                post_number,
                category_id,
                author_user_id,
                course_id,
                title,
                content,
                post_type,
                status,
                is_anonymous,
                created_at,
                created_by,
                soft_delete,
                is_active,
                published_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                'PUBLISHED', $8, NOW(), $3, FALSE, TRUE, NOW()
            )
            RETURNING
                id,
                post_number,
                category_id,
                author_user_id,
                course_id,
                title,
                content,
                post_type,
                status,
                is_anonymous,
                created_at`,
            [
                postNumber,
                categoryId,
                userId,
                courseId,
                title,
                content,
                postType,
                isAnonymous
            ]
        );

        const post = result.rows[0];
        for (const mentionedUserId of mentionedUserIds) {
            await createNotification(client, {
                userId: mentionedUserId,
                postId: post.id,
                notificationType: "MENTION",
                title: "You were mentioned in a community post",
                message: "Someone mentioned you in a community post: " + title,
                createdBy: userId
            });
        }

        await client.query("COMMIT");

        return post;

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
// ============================================================
// GET POST REPLIES
// ============================================================

async function getReplies(postId) {
    const result = await pool.query(
        `SELECT
            r.id,
            r.post_id,
            r.parent_reply_id,
            r.author_user_id,
            r.content,
            r.status,
            r.is_accepted,
            r.is_anonymous,
            r.reaction_count,
            r.reply_count,
            r.created_at,

            CASE
                WHEN r.is_anonymous = TRUE THEN 'Anonymous'
                ELSE CONCAT_WS(' ', u.first_name, u.last_name)
            END AS author_name

         FROM community.reply r

         LEFT JOIN olp_auth."user" u
            ON u.id = r.author_user_id

         WHERE r.post_id = $1
           AND r.status IN ('PUBLISHED', 'EDITED')
           AND r.soft_delete = FALSE
           AND r.is_active = TRUE

         ORDER BY
            r.parent_reply_id NULLS FIRST,
            r.created_at ASC`,
        [postId]
    );

    return result.rows;
}

// ============================================================
// FIND ACTIVE POST
// ============================================================

async function findActivePost(postId) {
    const result = await pool.query(
        `SELECT id, is_locked
         FROM community.post
         WHERE id = $1
           AND status = 'PUBLISHED'
           AND is_active = TRUE
           AND soft_delete = FALSE
         LIMIT 1`,
        [postId]
    );

    return result.rows[0] || null;
}

// ============================================================
// CREATE REPLY
// ============================================================

async function createReply({
    postId,
    parentReplyId,
    userId,
    content,
    isAnonymous,
    mentionedUserIds = []
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Normal reply -> notify post author.
        // Nested reply -> notify parent reply author.
        const recipientResult = parentReplyId
            ? await client.query(
                `SELECT author_user_id
                 FROM community.reply
                 WHERE id = $1
                   AND post_id = $2
                   AND soft_delete = FALSE
                   AND is_active = TRUE`,
                [parentReplyId, postId]
            )
            : await client.query(
                `SELECT author_user_id
                 FROM community.post
                 WHERE id = $1
                   AND soft_delete = FALSE
                   AND is_active = TRUE`,
                [postId]
            );

        const recipientId = recipientResult.rows[0]?.author_user_id;

        const result = await client.query(
            `INSERT INTO community.reply (
                post_id,
                parent_reply_id,
                author_user_id,
                content,
                status,
                is_anonymous,
                created_at,
                created_by,
                soft_delete,
                is_active
            )
            VALUES (
                $1, $2, $3, $4,
                'PUBLISHED', $5, NOW(), $3, FALSE, TRUE
            )
            RETURNING *`,
            [
                postId,
                parentReplyId,
                userId,
                content,
                isAnonymous
            ]
        );

        // Update post reply count
        await client.query(
            `UPDATE community.post
             SET reply_count = reply_count + 1,
                 last_replied_at = NOW(),
                 updated_at = NOW(),
                 updated_by = $2
             WHERE id = $1`,
            [postId, userId]
        );

        // Update parent reply count for nested reply
        if (parentReplyId) {
            await client.query(
                `UPDATE community.reply
                 SET reply_count = reply_count + 1,
                     updated_at = NOW(),
                     updated_by = $2
                 WHERE id = $1`,
                [parentReplyId, userId]
            );
        }

        // Save the notification in the same transaction as the reply.
        await createNotification(client, {
            userId: recipientId,
            postId,
            replyId: result.rows[0].id,
            notificationType: parentReplyId
                ? "REPLY_TO_REPLY"
                : "POST_REPLY",
            title: parentReplyId
                ? "New reply to your comment"
                : "New reply on your post",
            message: parentReplyId
                ? "Someone replied to your comment."
                : "Someone replied to your post.",
            createdBy: userId
        });

        for (const mentionedUserId of mentionedUserIds) {
            await createNotification(client, {
                userId: mentionedUserId,
                postId,
                replyId: result.rows[0].id,
                notificationType: "MENTION",
                title: "You were mentioned in a community reply",
                message: "Someone mentioned you in a community comment.",
                createdBy: userId
            });
        }

        await client.query("COMMIT");

        return result.rows[0];

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
// ============================================================
// ADD POST REACTION
// ============================================================

async function addPostReaction({
    postId,
    userId,
    reactionType
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const postResult = await client.query(
            `SELECT id, author_user_id, title
             FROM community.post
             WHERE id = $1
               AND status = 'PUBLISHED'
               AND is_active = TRUE
               AND soft_delete = FALSE
             FOR UPDATE`,
            [postId]
        );

        const post = postResult.rows[0];

        if (!post) {
            throw Object.assign(
                new Error("Community post not found."),
                { statusCode: 404 }
            );
        }

        const result = await client.query(
            `INSERT INTO community.post_reaction (
                post_id,
                user_id,
                reaction_type,
                created_at,
                created_by,
                soft_delete
            )
            VALUES ($1, $2, $3, NOW(), $2, FALSE)
            ON CONFLICT (post_id, user_id)
            DO UPDATE SET
                reaction_type = EXCLUDED.reaction_type,
                soft_delete = FALSE,
                updated_at = NOW(),
                updated_by = EXCLUDED.user_id
            WHERE community.post_reaction.soft_delete = TRUE
            RETURNING id, post_id, user_id, reaction_type`,
            [postId, userId, reactionType]
        );

        let isNewReaction = result.rowCount > 0;

        if (!isNewReaction) {
            const existing = await client.query(
                `SELECT id, reaction_type
                 FROM community.post_reaction
                 WHERE post_id = $1
                   AND user_id = $2
                   AND soft_delete = FALSE
                 FOR UPDATE`,
                [postId, userId]
            );

            if (
                existing.rows[0]?.reaction_type === reactionType
            ) {
                throw Object.assign(
                    new Error("You have already added this reaction."),
                    { statusCode: 409 }
                );
            }

            const updated = await client.query(
                `UPDATE community.post_reaction
                 SET reaction_type = $3,
                     updated_at = NOW(),
                     updated_by = $2
                 WHERE post_id = $1
                   AND user_id = $2
                   AND soft_delete = FALSE
                 RETURNING id, post_id, user_id, reaction_type`,
                [postId, userId, reactionType]
            );

            await client.query("COMMIT");

            return updated.rows[0];
        }

        await client.query(
            `UPDATE community.post
             SET reaction_count = reaction_count + 1
             WHERE id = $1`,
            [postId]
        );

        await createNotification(client, {
            userId: post.author_user_id,
            postId,
            notificationType: "POST_REACTION",
            title: "New reaction on your post",
            message: "Someone reacted to your post.",
            createdBy: userId
        });

        await client.query("COMMIT");

        return result.rows[0];

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// ============================================================
// REMOVE POST REACTION
// ============================================================

async function removePostReaction(postId, userId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `UPDATE community.post_reaction
             SET soft_delete = TRUE,
                 updated_at = NOW(),
                 updated_by = $2
             WHERE post_id = $1
               AND user_id = $2
               AND soft_delete = FALSE
             RETURNING id`,
            [postId, userId]
        );

        if (result.rowCount > 0) {
            await client.query(
                `UPDATE community.post
                 SET reaction_count = GREATEST(reaction_count - 1, 0)
                 WHERE id = $1`,
                [postId]
            );
        }

        await client.query("COMMIT");

        return result.rowCount > 0;

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// ============================================================
// ADD REPLY REACTION
// ============================================================

async function addReplyReaction({
    replyId,
    userId,
    reactionType
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const replyResult = await client.query(
            `SELECT
                r.id,
                r.post_id,
                r.author_user_id
             FROM community.reply r
             WHERE r.id = $1
               AND r.status IN ('PUBLISHED', 'EDITED')
               AND r.soft_delete = FALSE
               AND r.is_active = TRUE
             FOR UPDATE`,
            [replyId]
        );

        const reply = replyResult.rows[0];

        if (!reply) {
            throw Object.assign(
                new Error("Community reply not found."),
                { statusCode: 404 }
            );
        }

        const result = await client.query(
            `INSERT INTO community.reply_reaction (
                reply_id,
                user_id,
                reaction_type,
                created_at,
                created_by,
                soft_delete
            )
            VALUES ($1, $2, $3, NOW(), $2, FALSE)
            ON CONFLICT (reply_id, user_id)
            DO UPDATE SET
                reaction_type = EXCLUDED.reaction_type,
                soft_delete = FALSE,
                updated_at = NOW(),
                updated_by = EXCLUDED.user_id
            WHERE community.reply_reaction.soft_delete = TRUE
            RETURNING id, reply_id, user_id, reaction_type`,
            [replyId, userId, reactionType]
        );

        if (result.rowCount === 0) {
            const existing = await client.query(
                `SELECT id, reaction_type
                 FROM community.reply_reaction
                 WHERE reply_id = $1
                   AND user_id = $2
                   AND soft_delete = FALSE
                 FOR UPDATE`,
                [replyId, userId]
            );

            if (
                existing.rows[0]?.reaction_type === reactionType
            ) {
                throw Object.assign(
                    new Error("You have already added this reaction."),
                    { statusCode: 409 }
                );
            }

            const updated = await client.query(
                `UPDATE community.reply_reaction
                 SET reaction_type = $3,
                     updated_at = NOW(),
                     updated_by = $2
                 WHERE reply_id = $1
                   AND user_id = $2
                   AND soft_delete = FALSE
                 RETURNING id, reply_id, user_id, reaction_type`,
                [replyId, userId, reactionType]
            );

            await client.query("COMMIT");

            return updated.rows[0];
        }

        await client.query(
            `UPDATE community.reply
             SET reaction_count = reaction_count + 1
             WHERE id = $1`,
            [replyId]
        );

        await createNotification(client, {
            userId: reply.author_user_id,
            postId: reply.post_id,
            replyId,
            notificationType: "REPLY_REACTION",
            title: "New reaction on your reply",
            message: "Someone reacted to your reply.",
            createdBy: userId
        });

        await client.query("COMMIT");

        return result.rows[0];

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
// ============================================================
// REMOVE REPLY REACTION
// ============================================================

async function removeReplyReaction(replyId, userId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `UPDATE community.reply_reaction
             SET soft_delete = TRUE,
                 updated_at = NOW(),
                 updated_by = $2
             WHERE reply_id = $1
               AND user_id = $2
               AND soft_delete = FALSE
             RETURNING id`,
            [replyId, userId]
        );

        if (result.rowCount > 0) {
            await client.query(
                `UPDATE community.reply
                 SET reaction_count = GREATEST(reaction_count - 1, 0)
                 WHERE id = $1`,
                [replyId]
            );
        }

        await client.query("COMMIT");

        return result.rowCount > 0;

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
async function findActiveReply(replyId) {
    const result = await pool.query(
        `SELECT id, post_id
         FROM community.reply
         WHERE id = $1
           AND status IN ('PUBLISHED', 'EDITED')
           AND soft_delete = FALSE
           AND is_active = TRUE
         LIMIT 1`,
        [replyId]
    );

    return result.rows[0] || null;
}
// ============================================================
// ADD BOOKMARK
// ============================================================

async function addBookmark({ postId, userId }) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `INSERT INTO community.post_bookmark (
                post_id,
                user_id,
                created_at,
                created_by,
                soft_delete
            )
            VALUES ($1, $2, NOW(), $2, FALSE)

            ON CONFLICT (post_id, user_id)
            DO UPDATE SET
                soft_delete = FALSE,
                updated_at = NOW(),
                updated_by = EXCLUDED.user_id

            WHERE community.post_bookmark.soft_delete = TRUE

            RETURNING id, post_id, user_id, created_at`,
            [postId, userId]
        );

        if (result.rowCount === 0) {
            const existing = await client.query(
                `SELECT id, post_id, user_id, created_at
                 FROM community.post_bookmark
                 WHERE post_id = $1
                   AND user_id = $2
                   AND soft_delete = FALSE`,
                [postId, userId]
            );

            await client.query("COMMIT");

            return {
                bookmark: existing.rows[0],
                alreadyBookmarked: true
            };
        }

        await client.query(
            `UPDATE community.post
             SET bookmark_count = bookmark_count + 1
             WHERE id = $1`,
            [postId]
        );

        await client.query("COMMIT");

        return {
            bookmark: result.rows[0],
            alreadyBookmarked: false
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// ============================================================
// REMOVE BOOKMARK
// ============================================================

async function removeBookmark(postId, userId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `UPDATE community.post_bookmark
             SET soft_delete = TRUE,
                 updated_at = NOW(),
                 updated_by = $2
             WHERE post_id = $1
               AND user_id = $2
               AND soft_delete = FALSE
             RETURNING id`,
            [postId, userId]
        );

        if (result.rowCount > 0) {
            await client.query(
                `UPDATE community.post
                 SET bookmark_count = GREATEST(bookmark_count - 1, 0)
                 WHERE id = $1`,
                [postId]
            );
        }

        await client.query("COMMIT");

        return result.rowCount > 0;

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// ============================================================
// GET USER BOOKMARKS
// ============================================================

async function getBookmarks(userId, limit, offset, authorRole = null) {
    const result = await pool.query(
        `SELECT
            p.id,
            p.post_number,
            p.author_user_id,
            p.category_id,
            p.course_id,
            p.title,
            p.content,
            p.post_type,
            p.status,
            p.is_anonymous,
            p.reply_count,
            p.reaction_count,
            p.bookmark_count,
            p.created_at,
            c.name AS category_name,
            pb.created_at AS bookmarked_at,
            TRUE AS is_bookmarked,
            EXISTS (
                SELECT 1
                FROM community.post_reaction pr
                WHERE pr.post_id = p.id
                  AND pr.user_id = $1
                  AND pr.soft_delete = FALSE
            ) AS is_reacted,
            CASE
                WHEN p.is_anonymous = TRUE THEN 'Anonymous'
                ELSE CONCAT_WS(' ', u.first_name, u.last_name)
            END AS author_name

         FROM community.post_bookmark pb

         JOIN community.post p
           ON p.id = pb.post_id

         JOIN community.category c
           ON c.id = p.category_id

         LEFT JOIN olp_auth."user" u
           ON u.id = p.author_user_id

         WHERE pb.user_id = $1
           AND pb.soft_delete = FALSE
           AND p.soft_delete = FALSE
           AND p.is_active = TRUE
           AND p.status = 'PUBLISHED'
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE
           AND (
                $4::text IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM olp_auth.user_role ur
                    JOIN olp_auth.role r ON r.id = ur.role_id
                    WHERE ur.user_id = p.author_user_id
                      AND ur.is_active = TRUE
                      AND ur.soft_delete = FALSE
                      AND r.is_active = TRUE
                      AND r.soft_delete = FALSE
                      AND UPPER(BTRIM(r.code)) = $4::text
                )
           )

         ORDER BY pb.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset, authorRole]
    );

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM community.post_bookmark pb
         JOIN community.post p
           ON p.id = pb.post_id
         JOIN community.category c
           ON c.id = p.category_id
         WHERE pb.user_id = $1
           AND pb.soft_delete = FALSE
           AND p.soft_delete = FALSE
           AND p.is_active = TRUE
           AND p.status = 'PUBLISHED'
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE
           AND (
                $2::text IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM olp_auth.user_role ur
                    JOIN olp_auth.role r ON r.id = ur.role_id
                    WHERE ur.user_id = p.author_user_id
                      AND ur.is_active = TRUE
                      AND ur.soft_delete = FALSE
                      AND r.is_active = TRUE
                      AND r.soft_delete = FALSE
                      AND UPPER(BTRIM(r.code)) = $2::text
                )
           )`,
        [userId, authorRole]
    );

    return {
        bookmarks: result.rows,
        total: countResult.rows[0].total
    };
}
// ============================================================
// GET USER NOTIFICATIONS
// ============================================================

async function getNotifications(userId, limit, offset) {

    const result = await pool.query(
        `SELECT
            n.id,
            n.user_id,
            n.post_id,
            n.reply_id,
            n.notification_type,
            n.title,
            n.message,
            n.is_read,
            n.created_at

         FROM community.notification n

         WHERE n.user_id = $1
           AND n.soft_delete = FALSE

         ORDER BY n.created_at DESC

         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
    );

    const countResult = await pool.query(
        `SELECT
            COUNT(*)::int AS total

         FROM community.notification

         WHERE user_id = $1
           AND soft_delete = FALSE`,
        [userId]
    );

    return {
        notifications: result.rows,
        total: countResult.rows[0].total
    };
}


// ============================================================
// GET UNREAD NOTIFICATION COUNT
// ============================================================

async function getUnreadNotificationCount(userId) {

    const result = await pool.query(
        `SELECT
            COUNT(*)::int AS unread_count

         FROM community.notification

         WHERE user_id = $1
           AND is_read = FALSE
           AND soft_delete = FALSE`,
        [userId]
    );

    return result.rows[0].unread_count;
}


// ============================================================
// MARK SINGLE NOTIFICATION AS READ
// ============================================================

async function markNotificationAsRead(
    notificationId,
    userId
) {

    const result = await pool.query(
        `UPDATE community.notification

         SET
            is_read = TRUE

         WHERE id = $1
           AND user_id = $2
           AND is_read = FALSE
           AND soft_delete = FALSE

         RETURNING *`,
        [notificationId, userId]
    );

    return result.rows[0] || null;
}


// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================

async function markAllNotificationsAsRead(userId) {

    const result = await pool.query(
        `UPDATE community.notification

         SET
            is_read = TRUE

         WHERE user_id = $1
           AND is_read = FALSE
           AND soft_delete = FALSE

         RETURNING id`,
        [userId]
    );

    return result.rowCount;
}
// ============================================================
// CREATE POST REPORT
// ============================================================

async function createPostReport({
    postId,
    userId,
    reportType,
    reason
}) {
    const result = await pool.query(
        `INSERT INTO community.post_report (
            post_id,
            reported_by,
            report_type,
            reason,
            status,
            created_at,
            created_by,
            soft_delete
        )
        VALUES ($1, $2, $3, $4, 'PENDING', NOW(), $2, FALSE)

        ON CONFLICT (post_id, reported_by)
        DO UPDATE SET
            report_type = EXCLUDED.report_type,
            reason = EXCLUDED.reason,
            status = 'PENDING',
            reviewed_by = NULL,
            reviewed_at = NULL,
            review_comment = NULL,
            updated_at = NOW(),
            updated_by = EXCLUDED.reported_by,
            soft_delete = FALSE

        WHERE community.post_report.soft_delete = TRUE

        RETURNING *`,
        [postId, userId, reportType, reason]
    );

    if (result.rowCount === 0) {
        const error = new Error(
            "You have already reported this post."
        );
        error.statusCode = 409;
        throw error;
    }

    return result.rows[0];
}


// ============================================================
// CREATE REPLY REPORT
// ============================================================

async function createReplyReport({
    replyId,
    userId,
    reportType,
    reason
}) {
    const result = await pool.query(
        `INSERT INTO community.reply_report (
            reply_id,
            reported_by,
            report_type,
            reason,
            status,
            created_at,
            created_by,
            soft_delete
        )
        VALUES ($1, $2, $3, $4, 'PENDING', NOW(), $2, FALSE)

        ON CONFLICT (reply_id, reported_by)
        DO UPDATE SET
            report_type = EXCLUDED.report_type,
            reason = EXCLUDED.reason,
            status = 'PENDING',
            reviewed_by = NULL,
            reviewed_at = NULL,
            review_comment = NULL,
            updated_at = NOW(),
            updated_by = EXCLUDED.reported_by,
            soft_delete = FALSE

        WHERE community.reply_report.soft_delete = TRUE

        RETURNING *`,
        [replyId, userId, reportType, reason]
    );

    if (result.rowCount === 0) {
        const error = new Error(
            "You have already reported this reply."
        );
        error.statusCode = 409;
        throw error;
    }

    return result.rows[0];
}


// ============================================================
// GET POST REPORTS
// ============================================================

async function getPostReports(limit, offset) {
    const result = await pool.query(
        `SELECT
            pr.*,
            p.title AS post_title
         FROM community.post_report pr
         JOIN community.post p ON p.id = pr.post_id
         WHERE pr.soft_delete = FALSE
         ORDER BY pr.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    const count = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM community.post_report
         WHERE soft_delete = FALSE`
    );

    return {
        reports: result.rows,
        total: count.rows[0].total
    };
}


// ============================================================
// GET REPLY REPORTS
// ============================================================

async function getReplyReports(limit, offset) {
    const result = await pool.query(
        `SELECT
            rr.*,
            r.content AS reply_content,
            r.post_id
         FROM community.reply_report rr
         JOIN community.reply r ON r.id = rr.reply_id
         WHERE rr.soft_delete = FALSE
         ORDER BY rr.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    const count = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM community.reply_report
         WHERE soft_delete = FALSE`
    );

    return {
        reports: result.rows,
        total: count.rows[0].total
    };
}


// ============================================================
// GET SINGLE POST REPORT
// ============================================================

async function getPostReportById(reportId) {
    const result = await pool.query(
        `SELECT
            pr.*,
            p.title AS post_title,
            p.content AS post_content
         FROM community.post_report pr
         JOIN community.post p ON p.id = pr.post_id
         WHERE pr.id = $1
           AND pr.soft_delete = FALSE
         LIMIT 1`,
        [reportId]
    );

    return result.rows[0] || null;
}


// ============================================================
// GET SINGLE REPLY REPORT
// ============================================================

async function getReplyReportById(reportId) {
    const result = await pool.query(
        `SELECT
            rr.*,
            r.content AS reply_content,
            r.post_id
         FROM community.reply_report rr
         JOIN community.reply r ON r.id = rr.reply_id
         WHERE rr.id = $1
           AND rr.soft_delete = FALSE
         LIMIT 1`,
        [reportId]
    );

    return result.rows[0] || null;
}


// ============================================================
// UPDATE POST REPORT STATUS
// ============================================================

async function updatePostReportStatus({
    reportId,
    adminId,
    status,
    reviewComment
}) {
    const result = await pool.query(
        `UPDATE community.post_report
         SET
            status = $2,
            reviewed_by = $3,
            reviewed_at = NOW(),
            review_comment = $4,
            updated_at = NOW(),
            updated_by = $3
         WHERE id = $1
           AND soft_delete = FALSE
         RETURNING *`,
        [reportId, status, adminId, reviewComment]
    );

    return result.rows[0] || null;
}


// ============================================================
// UPDATE REPLY REPORT STATUS
// ============================================================

async function updateReplyReportStatus({
    reportId,
    adminId,
    status,
    reviewComment
}) {
    const result = await pool.query(
        `UPDATE community.reply_report
         SET
            status = $2,
            reviewed_by = $3,
            reviewed_at = NOW(),
            review_comment = $4,
            updated_at = NOW(),
            updated_by = $3
         WHERE id = $1
           AND soft_delete = FALSE
         RETURNING *`,
        [reportId, status, adminId, reviewComment]
    );

    return result.rows[0] || null;
}

async function findPostAttachmentTarget(postId) {
    const result = await pool.query(
        `SELECT id, author_user_id::text AS author_user_id
         FROM community.post
         WHERE id = $1
           AND soft_delete = FALSE
           AND is_active = TRUE
           AND status = 'PUBLISHED'
         LIMIT 1`,
        [postId]
    );

    return result.rows[0] || null;
}

async function getPostAttachments(postIds) {
    const ids = [...new Set((postIds || []).map((id) => String(id)))];
    if (!ids.length) return [];

    const result = await pool.query(
        `SELECT
            id,
            post_id,
            file_name,
            file_url,
            file_type,
            file_size_bytes,
            display_order,
            created_at
         FROM community.post_attachment
         WHERE post_id = ANY($1::bigint[])
           AND soft_delete = FALSE
           AND is_active = TRUE
         ORDER BY post_id ASC, display_order ASC, created_at ASC, id ASC`,
        [ids]
    );

    return result.rows;
}

async function createPostAttachments({ postId, userId, attachments }) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const postResult = await client.query(
            `SELECT id
             FROM community.post
             WHERE id = $1
               AND author_user_id = $2
               AND soft_delete = FALSE
               AND is_active = TRUE
               AND status = 'PUBLISHED'
             FOR UPDATE`,
            [postId, userId]
        );
        if (!postResult.rowCount) {
            const error = new Error("Community post not found.");
            error.statusCode = 404;
            throw error;
        }

        const orderResult = await client.query(
            `SELECT COALESCE(MAX(display_order), 0)::int AS max_order
             FROM community.post_attachment
             WHERE post_id = $1
               AND soft_delete = FALSE
               AND is_active = TRUE`,
            [postId]
        );
        let displayOrder = Number(orderResult.rows[0]?.max_order || 0);
        const inserted = [];

        for (const attachment of attachments) {
            const result = await client.query(
                `INSERT INTO community.post_attachment (
                    post_id,
                    file_name,
                    file_url,
                    file_type,
                    file_size_bytes,
                    display_order,
                    uploaded_by,
                    created_by,
                    soft_delete,
                    is_active
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $7, FALSE, TRUE)
                 RETURNING
                    id,
                    post_id,
                    file_name,
                    file_url,
                    file_type,
                    file_size_bytes,
                    display_order,
                    created_at`,
                [
                    postId,
                    attachment.fileName,
                    attachment.publicUrl,
                    attachment.mimeType,
                    attachment.size,
                    ++displayOrder,
                    userId
                ]
            );
            inserted.push(result.rows[0]);
        }

        await client.query("COMMIT");
        return inserted;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
module.exports = {
    getCategories,
    searchMentionSuggestions,
    findMentionedUsers,
    getPosts,
    findPostById,
    findActiveCategory,
    createPost,
    getReplies,
    findActivePost,
    createReply,
    addPostReaction,
    removePostReaction,
    addReplyReaction,
    removeReplyReaction,
    findActiveReply,
    addBookmark,
    removeBookmark,
    getBookmarks,
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    createPostReport,
createReplyReport,
getPostReports,
getReplyReports,
getPostReportById,
getReplyReportById,
updatePostReportStatus,
    updateReplyReportStatus,
    getPostAttachments,
    findPostAttachmentTarget,
    createPostAttachments

};
