const pool = require("../config/database");

async function createForUser(
    {
        userId,
        notificationType,
        title,
        message,
        preferenceKey,
        createdBy = userId
    },
    client = pool
) {
    if (!userId || !preferenceKey) return null;

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
        SELECT $1, NULL, NULL, $2, $3, $4, FALSE, NOW(), $5, FALSE
        WHERE COALESCE(
            (
                SELECT preferences ->> $6
                FROM olp_auth.notification_preference
                WHERE user_id = $1
            ),
            'true'
        ) <> 'false'
        RETURNING *`,
        [userId, notificationType, title, message, createdBy, preferenceKey]
    );

    return result.rows[0] || null;
}

async function findCourseStudentUserIds(courseId, client = pool) {
    const result = await client.query(
        `SELECT DISTINCT s.user_id
         FROM learning.enrollment e
         JOIN learning.student s
           ON s.id = e.student_id
         JOIN olp_auth."user" u
           ON u.id = s.user_id
         WHERE e.course_id = $1
           AND e.status IN ('ACTIVE', 'COMPLETED')
           AND COALESCE(e.soft_delete, FALSE) = FALSE
           AND s.is_active = TRUE
           AND COALESCE(s.soft_delete, FALSE) = FALSE
           AND u.is_active = TRUE
           AND COALESCE(u.soft_delete, FALSE) = FALSE`,
        [courseId]
    );

    return result.rows.map((row) => row.user_id);
}

async function findActiveStudentUserIds(client = pool) {
    const result = await client.query(
        `SELECT DISTINCT s.user_id
         FROM learning.student s
         JOIN olp_auth."user" u
           ON u.id = s.user_id
         WHERE s.is_active = TRUE
           AND COALESCE(s.soft_delete, FALSE) = FALSE
           AND u.is_active = TRUE
           AND COALESCE(u.soft_delete, FALSE) = FALSE`
    );

    return result.rows.map((row) => row.user_id);
}

async function createForUsers(
    userIds,
    {
        notificationType,
        title,
        message,
        preferenceKey,
        createdBy
    },
    client = pool
) {
    const uniqueUserIds = [...new Set((userIds || []).map(String).filter(Boolean))];
    if (!uniqueUserIds.length || !preferenceKey) return [];

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
        SELECT recipients.user_id, NULL, NULL, $2, $3, $4, FALSE, NOW(), $5, FALSE
        FROM unnest($1::bigint[]) AS recipients(user_id)
        LEFT JOIN olp_auth.notification_preference preferences
          ON preferences.user_id = recipients.user_id
        WHERE COALESCE(preferences.preferences ->> $6, 'true') <> 'false'
        RETURNING id, user_id`,
        [uniqueUserIds, notificationType, title, message, createdBy, preferenceKey]
    );

    return result.rows;
}

async function notifyCourseStudents(courseId, notification, client = pool) {
    const userIds = await findCourseStudentUserIds(courseId, client);
    return createForUsers(userIds, notification, client);
}

async function notifyAllActiveStudents(notification, client = pool) {
    const userIds = await findActiveStudentUserIds(client);
    return createForUsers(userIds, notification, client);
}

module.exports = {
    createForUser,
    createForUsers,
    findCourseStudentUserIds,
    notifyCourseStudents,
    notifyAllActiveStudents
};
