
const pool = require("../config/database");
const repo = require("../repositories/course.repository");
const storageService = require("./storage.service");

const crypto = require("crypto");

const {
    createError,
    validateId,
    getInstructorId
} = require("../utils/instructor-content.helper");

async function create(data, userId) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw createError("Course data is required", 400);
    }

    if (!data.title || !String(data.title).trim()) {
        throw createError("Course title is required", 400);
    }

    const categoryId = Number(data.category_id);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
        throw createError("A valid category_id is required", 400);
    }

    const type = data.course_type ?? "PAID";

    if (!["FREE", "PAID"].includes(type)) {
        throw createError("course_type must be FREE or PAID", 400);
    }

    const price = Number(data.price ?? 0);

    if (
        !Number.isFinite(price) ||
        price < 0 ||
        (type === "FREE" && price !== 0) ||
        (type === "PAID" && price <= 0)
    ) {
        throw createError("Invalid price for course_type", 400);
    }

    const instructorId = await getInstructorId(userId);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Verify that the selected category is active.
        const categoryResult = await client.query(
            `SELECT code
             FROM public.course_category
             WHERE id = $1
               AND is_active = TRUE
               AND soft_delete = FALSE`,
            [categoryId]
        );

        if (!categoryResult.rowCount) {
            throw createError(
                "Selected category does not exist or is inactive",
                400
            );
        }

        // Generate a unique-looking course code on the server.
        const categoryPrefix = String(categoryResult.rows[0].code)
            .replace(/[^a-z0-9]/gi, "")
            .toUpperCase()
            .slice(0, 12);

        const randomSuffix = crypto
            .randomBytes(5)
            .toString("hex")
            .toUpperCase();

        const generatedCourseCode =
            `OLP-${categoryPrefix}-${randomSuffix}`;

        const courseData = {
            ...data,
            title: String(data.title).trim(),
            category_id: categoryId,
            course_code: generatedCourseCode,
            course_type: type,
            price,
            created_by: userId
        };

        const course = await repo.createCourse(
            client,
            instructorId,
            courseData
        );

        await client.query("COMMIT");

        return course;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function listMy(userId) {
    const instructorId = await getInstructorId(userId);

    return repo.listMyCourses(pool, instructorId);
}

async function update(courseId, data, userId) {
    const id = validateId(courseId, "course ID");
    const instructorId = await getInstructorId(userId);

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.keys(data).length === 0
    ) {
        throw createError(
            "Provide at least one field to update",
            400
        );
    }

    const course = await repo.updateCourse(
        pool,
        instructorId,
        id,
        data
    );

    if (!course) {
        // The update query deliberately only permits editable drafts. Since
        // getCourseById also checks ownership, use it to distinguish a course
        // that is locked by its workflow state from one the instructor cannot
        // access. This prevents a valid owned course from looking "missing".
        const existingCourse = await repo.getCourseById(
            pool,
            instructorId,
            id
        );

        if (existingCourse) {
            throw createError(
                `This course cannot be edited while its status is ${existingCourse.status} and approval status is ${existingCourse.approval_status}. Only draft courses that have not been submitted or were rejected can be edited.`,
                409
            );
        }

        throw createError(
            "Course not found or not owned by you",
            404
        );
    }

    return course;
}

async function submit(courseId, userId) {
    const id = validateId(courseId, "course ID");
    const instructorId = await getInstructorId(userId);

    const course = await repo.submitCourse(
        pool,
        instructorId,
        id
    );

    if (!course) {
        throw createError(
            "Course not found or not owned by you",
            404
        );
    }

    return course;
}
async function uploadThumbnail(courseId, file, userId) {
    const id = validateId(courseId, "course ID");

    if (!file) {
        throw createError("Please select a thumbnail image", 400);
    }

    const instructorId = await getInstructorId(userId);

    // Upload the image to Supabase Storage.
    const uploaded = await storageService.uploadCourseThumbnail(
        file,
        id
    );

    try {
        // Save the public URL only if the instructor owns
        // an editable course.
        const course = await repo.updateCourseThumbnail(
            pool,
            instructorId,
            id,
            uploaded.publicUrl,
            userId
        );

        if (!course) {
            throw createError(
                "Course not found, not owned by you, or not editable",
                404
            );
        }

        return course;
    } catch (error) {
        // Clean up the newly uploaded image if the DB update fails.
        await storageService.removeCourseThumbnail(uploaded.path);
        throw error;
    }
}


async function getCourse(courseId, userId) {
    const id = validateId(courseId, "course ID");
    const instructorId = await getInstructorId(userId);

    const course = await repo.getCourseById(
        pool,
        instructorId,
        id
    );

    if (!course) {
        throw createError(
            "Course not found or not owned by you",
            404
        );
    }

    return course;
}





async function getCategories() {
    return repo.getActiveCategories(pool);
}


module.exports = {
    create,
    listMy,
    update,
    submit,
    uploadThumbnail,
    getCourse,
    getCategories
};
