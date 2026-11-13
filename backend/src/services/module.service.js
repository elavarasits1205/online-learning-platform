
const pool = require("../config/database");
const repo = require("../repositories/module.repository");
const notificationRepository =
    require("../repositories/notification.repository");
const {
    createError,
    validateId,
    getInstructorId
} = require("../utils/instructor-content.helper");

async function create(data, userId) {
    try {
        if (!data.title || !String(data.title).trim()) {
            throw createError("Module title is required", 400);
        }

        const instructorId = await getInstructorId(userId);
        const courseId = validateId(data.course_id, "course ID");
        const moduleNumber = Number(data.module_number ?? 1);

        if (!Number.isSafeInteger(moduleNumber) || moduleNumber <= 0) {
            throw createError("Module number must be a positive integer", 400);
        }

        const module = await repo.create(pool, instructorId, {
            ...data,
            course_id: courseId,
            module_number: moduleNumber,
            sort_order: Number(data.sort_order ?? 0)
        });

        if (!module) {
            throw createError(
                "Course not found or not owned by you",
                404
            );
        }

        try {
            await notificationRepository.notifyCourseStudents(
                module.course_id,
                {
                    notificationType: "COURSE_ANNOUNCEMENT",
                    title: "New module in your course",
                    message: `A new module, ${module.title}, has been added to your course.`,
                    preferenceKey: "courseAnnouncements",
                    createdBy: userId
                }
            );
        } catch (notificationError) {
            console.error(
                "Failed to notify students about the new module:",
                notificationError
            );
        }

        return module;
    } catch (error) {
        if (
            error.code === "23505" &&
            error.constraint === "uq_learning_module_number"
        ) {
            throw createError(
                "A module with this number already exists in the course",
                409
            );
        }

        console.error("Create module failed:", error);
        throw error;
    }
}

async function listByCourse(courseId, userId) {
    const id = validateId(courseId, "course ID");
    const instructorId = await getInstructorId(userId);
    const modules = await repo.listByCourse(pool, instructorId, id);

    return modules;
}

async function update(moduleId, data, userId) {
    const id = validateId(moduleId, "module ID");
    const instructorId = await getInstructorId(userId);

    if (!Object.keys(data).length) {
        throw createError("Provide at least one field to update");
    }

    const module = await repo.update(pool, instructorId, id, data);

    if (!module) {
        throw createError("Module not found or not owned by you", 404);
    }

    return module;
}

module.exports = { create, listByCourse, update };
