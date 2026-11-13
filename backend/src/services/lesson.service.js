
const pool = require("../config/database");
const repo = require("../repositories/lesson.repository");
const notificationRepository =
    require("../repositories/notification.repository");
const {
    createError,
    validateId,
    getInstructorId
} = require("../utils/instructor-content.helper");

const {
    uploadLessonVideo: storeLessonVideo,
    getLessonVideoPlaybackUrl
} = require("./storage.service");

async function withPlayableVideo(lesson) {
    if (!lesson) return lesson;
    return {
        ...lesson,
        video_url: await getLessonVideoPlaybackUrl(lesson.video_url)
    };
}

async function create(data, userId) {
    if (!data.title || !String(data.title).trim()) {
        throw createError("Lesson title is required");
    }

    const instructorId = await getInstructorId(userId);
    const moduleId = validateId(data.module_id, "module ID");

 const lesson = await repo.create(pool, instructorId, {
    ...data,
    module_id: moduleId,
    lesson_type: data.lesson_type ?? data.content_type ?? "VIDEO",
    video_url: data.video_url ?? data.content_url ?? null,
    lesson_number:
        data.lesson_number ?? data.sequence_number ?? 1,
    sort_order:
        data.sort_order ?? data.sequence_number ?? 0,
});

    if (!lesson) {
        throw createError("Module not found or not owned by you", 404);
    }

    try {
        const courseResult = await pool.query(
            `SELECT c.id, c.title
             FROM learning.module m
             JOIN learning.course c
               ON c.id = m.course_id
             WHERE m.id = $1
               AND m.soft_delete = FALSE
               AND c.soft_delete = FALSE
             LIMIT 1`,
            [moduleId]
        );
        const course = courseResult.rows[0];

        if (course) {
            await notificationRepository.notifyCourseStudents(
                course.id,
                {
                    notificationType: "COURSE_ANNOUNCEMENT",
                    title: "New lesson available",
                    message: `A new lesson, ${lesson.title}, is available in ${course.title}.`,
                    preferenceKey: "courseAnnouncements",
                    createdBy: userId
                }
            );
        }
    } catch (notificationError) {
        console.error(
            "Failed to notify students about the new lesson:",
            notificationError
        );
    }

     return withPlayableVideo(lesson);
}

async function listByModule(moduleId, userId) {
    const id = validateId(moduleId, "module ID");
    const instructorId = await getInstructorId(userId);

    const lessons = await repo.listByModule(pool, instructorId, id);
    return Promise.all(lessons.map(withPlayableVideo));
}

async function update(lessonId, data, userId) {
    const id = validateId(lessonId, "lesson ID");
    const instructorId = await getInstructorId(userId);

    if (!Object.keys(data).length) {
        throw createError("Provide at least one field to update");
    }

    const lesson = await repo.update(pool, instructorId, id, data);

    if (!lesson) {
        throw createError("Lesson not found or not owned by you", 404);
    }

    return withPlayableVideo(lesson);
}

async function uploadVideo(moduleId, file, userId) {
    const id = validateId(moduleId, "module ID");
    const instructorId = await getInstructorId(userId);

    const owned = await pool.query(
        `SELECT 1
         FROM learning.module AS m
         JOIN learning.course AS c ON c.id = m.course_id
         JOIN learning.course_instructor AS ci
           ON ci.course_id = c.id
         WHERE m.id = $1
           AND m.soft_delete = FALSE
           AND c.soft_delete = FALSE
           AND ci.instructor_id = $2
           AND ci.is_active = TRUE`,
        [id, instructorId]
    );

    if (!owned.rowCount) {
        throw createError("Module not found or not owned by you", 404);
    }

    return storeLessonVideo(file, id);
}



module.exports = { create, listByModule, update,uploadVideo,};

