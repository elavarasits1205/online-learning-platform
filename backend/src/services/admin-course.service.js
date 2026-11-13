
const pool = require("../config/database");
const repo = require("../repositories/admin-course.repository");
const notificationRepository =
    require("../repositories/notification.repository");

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function validateId(value, label = "ID") {
    const id = String(value ?? "").trim();

    if (!/^[1-9]\d*$/.test(id)) {
        throw createError(`Invalid ${label}`, 400);
    }

    return id;
}

async function listPending() {
    return repo.listPendingCourses(pool);
}

async function listAllCourses() {
    return repo.listAllCourses(pool);
}

async function getReviewBundle(courseId) {
    const id = validateId(courseId, "course ID");
    const course = await repo.getCourseBundle(pool, id);

    if (!course) {
        throw createError("Course not found", 404);
    }

    if (
        course.status !== "DRAFT" ||
        course.approval_status !== "PENDING"
    ) {
        throw createError(
            `Course is not pending approval. Current status: ${course.status}, approval status: ${course.approval_status}`,
            409
        );
    }

    return course;
}

async function submitForApproval(courseId, instructorId) {
    const id = validateId(courseId, "course ID");
    const actorId = validateId(instructorId, "instructor user ID");

    const course = await repo.submitCourseForApproval(
        pool,
        id,
        actorId
    );

    if (!course) {
        throw createError(
            "Submission failed. Check that the course exists, is a DRAFT, has approval_status NOT_SUBMITTED or REJECTED, and belongs to the logged-in instructor.",
            409
        );
    }

    return course;
}

async function decide(courseId, adminUserId, decision, reason) {
    const id = validateId(courseId, "course ID");
    const adminId = validateId(adminUserId, "admin user ID");

    if (!["APPROVE", "REJECT"].includes(decision)) {
        throw createError("Invalid review decision", 400);
    }

    let rejectionReason;

    if (decision === "REJECT") {
        if (typeof reason !== "string" || !reason.trim()) {
            throw createError("A rejection reason is required", 400);
        }

        rejectionReason = reason.trim();

        if (rejectionReason.length > 5000) {
            throw createError(
                "Rejection reason must not exceed 5000 characters",
                400
            );
        }
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        const pendingResult = await client.query(
            `
            SELECT id::text AS id, status, approval_status
            FROM learning.course
            WHERE id = $1
              AND soft_delete = FALSE
            FOR UPDATE
            `,
            [id]
        );

        if (pendingResult.rowCount === 0) {
            throw createError(
                "Course not found or it has been deleted",
                404
            );
        }

        const currentCourse = pendingResult.rows[0];

        if (
            currentCourse.status !== "DRAFT" ||
            currentCourse.approval_status !== "PENDING"
        ) {
            throw createError(
                `Cannot review this course. Current status: ${currentCourse.status}, approval status: ${currentCourse.approval_status}`,
                409
            );
        }

        const updatedCourse =
            decision === "APPROVE"
                ? await repo.approveCourse(client, id, adminId)
                : await repo.rejectCourse(
                    client,
                    id,
                    adminId,
                    rejectionReason
                );

        if (!updatedCourse) {
            throw createError(
                "Course update affected no rows. Verify the course status and approval status.",
                409
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        if (decision === "APPROVE") {
            try {
                await notificationRepository.notifyAllActiveStudents(
                    {
                        notificationType: "NEW_COURSE",
                        title: "New course available",
                        message: `${updatedCourse.title} is now available to explore.`,
                        preferenceKey: "newCourses",
                        createdBy: adminId
                    },
                    client
                );
            } catch (notificationError) {
                console.error(
                    "Failed to notify students about the new course:",
                    notificationError
                );
            }
        }

        return updatedCourse;
    } catch (error) {
        if (transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Admin course rollback failed:",
                    rollbackError.message
                );
            }
        }

        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    listPending,
    listAllCourses,
    getReviewBundle,
    submitForApproval,
    decide
};
