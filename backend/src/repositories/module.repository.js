// src/repositories/module.repository.js

async function create(client, instructorId, data) {
    try {
        console.log("MODULE CREATE DATA:", {
            instructorId,
            course_id: data.course_id,
            module_number: data.module_number,
            title: data.title
        });

        const owned = await client.query(
            `SELECT 1
             FROM learning.course AS c
             JOIN learning.course_instructor AS ci
               ON ci.course_id = c.id
             WHERE c.id = $1
               AND c.soft_delete = FALSE
               AND ci.instructor_id = $2
               AND ci.is_active = TRUE`,
            [data.course_id, instructorId]
        );

        if (!owned.rowCount) return null;

        const result = await client.query(
            `INSERT INTO learning.module (
                course_id, module_code, module_number,
                title, description, sort_order, soft_delete
             )
             VALUES ($1, $2, $3, $4, $5, $6, FALSE)
             RETURNING *`,
            [
                data.course_id,
                data.module_code ?? null,
                data.module_number,
                data.title,
                data.description ?? null,
                data.sort_order ?? 0
            ]
        );

        return result.rows[0];
    } catch (error) {
        console.error("MODULE DATABASE ERROR:", {
            message: error.message,
            code: error.code,
            detail: error.detail,
            constraint: error.constraint,
            table: error.table,
            column: error.column
        });

        throw error;
    }
}

async function listByCourse(client, instructorId, courseId) {
    const result = await client.query(
        `SELECT m.*
         FROM learning.module AS m
         JOIN learning.course AS c ON c.id = m.course_id
         JOIN learning.course_instructor AS ci ON ci.course_id = c.id
         WHERE c.id = $1
           AND ci.instructor_id = $2
           AND ci.is_active = TRUE
           AND c.soft_delete = FALSE
           AND m.soft_delete = FALSE
         ORDER BY m.sort_order, m.module_number, m.id`,
        [courseId, instructorId]
    );

    return result.rows;
}

async function update(client, instructorId, moduleId, data) {
    const result = await client.query(
        `UPDATE learning.module AS m
         SET module_code = COALESCE($3, m.module_code),
             module_number = COALESCE($4, m.module_number),
             title = COALESCE($5, m.title),
             description = COALESCE($6, m.description),
             sort_order = COALESCE($7, m.sort_order)
         WHERE m.id = $1
           AND m.soft_delete = FALSE
           AND EXISTS (
               SELECT 1
               FROM learning.course AS c
               JOIN learning.course_instructor AS ci
                 ON ci.course_id = c.id
               WHERE c.id = m.course_id
                 AND c.soft_delete = FALSE
                 AND ci.instructor_id = $2
                 AND ci.is_active = TRUE
                 
           )
         RETURNING m.*`,
        [
            moduleId,
            instructorId,
            data.module_code ?? null,
            data.module_number ?? null,
            data.title ?? null,
            data.description ?? null,
            data.sort_order ?? null
        ]
    );

    return result.rows[0] || null;
}

module.exports = { create, listByCourse, update };