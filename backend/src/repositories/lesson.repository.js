// src/repositories/lesson.repository.js

async function create(client, instructorId, data) {
    const owned = await client.query(
        `SELECT 1
         FROM learning.module AS m
         JOIN learning.course AS c ON c.id = m.course_id
         JOIN learning.course_instructor AS ci ON ci.course_id = c.id
         WHERE m.id = $1
           AND m.soft_delete = FALSE
           AND c.soft_delete = FALSE
           AND ci.instructor_id = $2
           AND ci.is_active = TRUE`,
        [data.module_id, instructorId]
    );

    if (!owned.rowCount) return null;

    const result = await client.query(
        `INSERT INTO learning.lesson (
            module_id, lesson_code, lesson_number, title, description,
            lesson_type, content, video_url, duration_minutes, sort_order,
            is_preview, is_mandatory, is_active, soft_delete
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, TRUE, FALSE
        )
        RETURNING *`,
        [
            data.module_id,
            data.lesson_code ?? null,
            data.lesson_number,
            data.title,
            data.description ?? null,
            data.lesson_type ?? "VIDEO",
            data.content ?? null,
            data.video_url ?? null,
            data.duration_minutes ?? null,
            data.sort_order ?? 0,
            data.is_preview ?? false,
            data.is_mandatory ?? true
        ]
    );

    return result.rows[0];
}

async function listByModule(client, instructorId, moduleId) {
    const result = await client.query(
        `SELECT l.*
         FROM learning.lesson AS l
         JOIN learning.module AS m ON m.id = l.module_id
         JOIN learning.course AS c ON c.id = m.course_id
         JOIN learning.course_instructor AS ci ON ci.course_id = c.id
         WHERE m.id = $1
           AND ci.instructor_id = $2
           AND ci.is_active = TRUE
          
           AND c.soft_delete = FALSE
           AND m.soft_delete = FALSE
           AND l.soft_delete = FALSE
         ORDER BY l.sort_order, l.lesson_number, l.id`,
        [moduleId, instructorId]
    );

    return result.rows;
}

async function update(client, instructorId, lessonId, data) {
    const result = await client.query(
        `UPDATE learning.lesson AS l
         SET lesson_code = COALESCE($3, l.lesson_code),
             lesson_number = COALESCE($4, l.lesson_number),
             title = COALESCE($5, l.title),
             description = COALESCE($6, l.description),
             lesson_type = COALESCE($7, l.lesson_type),
             content = COALESCE($8, l.content),
             video_url = COALESCE($9, l.video_url),
             duration_minutes = COALESCE($10, l.duration_minutes),
             sort_order = COALESCE($11, l.sort_order),
             is_preview = COALESCE($12, l.is_preview),
             is_mandatory = COALESCE($13, l.is_mandatory)
         WHERE l.id = $1
           AND l.soft_delete = FALSE
           AND EXISTS (
               SELECT 1
               FROM learning.module AS m
               JOIN learning.course AS c ON c.id = m.course_id
               JOIN learning.course_instructor AS ci ON ci.course_id = c.id
               WHERE m.id = l.module_id
                 AND m.soft_delete = FALSE
                 AND c.soft_delete = FALSE
                 AND ci.instructor_id = $2
                 AND ci.is_active = TRUE
           )
         RETURNING l.*`,
        [
            lessonId,
            instructorId,
            data.lesson_code ?? null,
            data.lesson_number ?? null,
            data.title ?? null,
            data.description ?? null,
            data.lesson_type ?? null,
            data.content ?? null,
            data.video_url ?? null,
            data.duration_minutes ?? null,
            data.sort_order ?? null,
            data.is_preview ?? null,
            data.is_mandatory ?? null
        ]
    );

    return result.rows[0] || null;
}



module.exports = { create, listByModule, update };