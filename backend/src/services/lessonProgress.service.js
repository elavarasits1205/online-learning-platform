
const pool = require("../config/database");

const lessonProgressRepository =
    require("../repositories/lessonProgress.repository");
const certificateRepository =
    require("../repositories/certificate.repository");
const certificateService =
    require("./certificate.service");
const notificationRepository =
    require("../repositories/notification.repository");

async function persistCourseProgress(
    client,
    enrollmentId,
    progress,
    lessonId,
    userId
) {
    const previousStatus = await lessonProgressRepository.saveCourseProgress(
        client,
        {
            enrollmentId,
            totalModules: progress.totalModules,
            completedModules: progress.completedModules,
            totalLessons: progress.totalLessons,
            completedLessons: progress.completedLessons,
            percentage: progress.percentage,
            status: progress.status,
            lessonId,
            userId
        }
    );

    if (progress.status === "COMPLETED") {
        await certificateRepository.markEnrollmentCompleted(
            client,
            enrollmentId,
            userId
        );
    }

    return previousStatus;
}

async function notifyCourseCompletion(
    userId,
    enrollment,
    progress,
    previousStatus
) {
    const wasCompleted =
        String(previousStatus || "").toUpperCase() === "COMPLETED";
    if (progress.status !== "COMPLETED" || wasCompleted) return;

    try {
        await notificationRepository.createForUser({
            userId,
            notificationType: "COURSE_COMPLETED",
            title: "Course completed",
            message: enrollment.course_title
                ? `Congratulations! You completed ${enrollment.course_title}.`
                : "Congratulations! You completed your course.",
            preferenceKey: "certificates",
            createdBy: userId
        });
    } catch (error) {
        // Progress is already committed. A notification failure must not undo
        // course completion or prevent certificate generation.
        console.error("Failed to create the course completion notification:", error);
    }
}

async function issueCertificateIfCourseCompleted(userId, enrollmentId, progress) {
    if (progress.status !== "COMPLETED") return null;

    try {
        return await certificateService.ensureCertificateForEnrollment(
            userId,
            enrollmentId
        );
    } catch (error) {
        // Course completion is already committed. Keep it successful and let
        // My Learning retry certificate/PDF preparation when the student opens it.
        console.error(
            "Failed to issue the course completion certificate:",
            error
        );
        return null;
    }
}

async function calculateCourseProgress(client, courseId, enrollmentId) {
    const totals = await lessonProgressRepository.getCourseTotals(
        client,
        courseId,
        enrollmentId
    );
    const assessmentTotals =
        await lessonProgressRepository.getCourseAssessmentTotals(
            client,
            courseId,
            enrollmentId
        );

    const totalLessons = Number(totals.total_lessons);
    const completedLessons = Number(totals.completed_lessons);
    const totalModules = Number(totals.total_modules);
    const completedModules = Number(totals.completed_modules);
    const progressTotal = Number(totals.progress_total);
    const totalAssessments = Number(assessmentTotals.total_assessments);
    const completedAssessments = Number(assessmentTotals.completed_assessments);
    const totalRequiredAssessments = Number(assessmentTotals.total_required_assessments);
    const completedRequiredAssessments = Number(assessmentTotals.completed_required_assessments);
    const totalActivities = totalLessons + totalRequiredAssessments;
    const completedActivities = completedLessons + completedRequiredAssessments;
    const completionRequirementsMet = totalActivities > 0 &&
        completedLessons === totalLessons &&
        completedRequiredAssessments === totalRequiredAssessments;
    const calculatedPercentage = totalActivities > 0
        ? Number(((progressTotal + completedRequiredAssessments * 100) / totalActivities).toFixed(2))
        : 0;
    const percentage = completionRequirementsMet
        ? Math.min(100, calculatedPercentage)
        : Math.min(99, calculatedPercentage);
    const status = completionRequirementsMet && percentage >= 100
        ? "COMPLETED"
        : percentage > 0
            ? "IN_PROGRESS"
            : "NOT_STARTED";

    return {
        totalModules,
        completedModules,
        totalLessons,
        completedLessons,
        totalAssessments,
        completedAssessments,
        totalRequiredAssessments,
        completedRequiredAssessments,
        totalActivities,
        completedActivities,
        percentage,
        status
    };
}

// ============================================================
// MARK LESSON COMPLETE
// ============================================================
// Purpose:
// Student ஒரு lesson-ஐ complete செய்தவுடன்,
// lesson progress மற்றும் overall course progress update செய்யும்.
// ============================================================

async function markLessonComplete({
    courseId,
    lessonId,
    userId
}) {

    // Convert incoming values into numbers.
    courseId = Number(courseId);
    lessonId = Number(lessonId);
    userId = Number(userId);

    // --------------------------------------------------------
    // 1. VALIDATE COURSE ID AND LESSON ID
    // --------------------------------------------------------
    // Invalid IDs இருந்தால் database operation செய்ய வேண்டாம்.

    if (
        !Number.isSafeInteger(courseId) || courseId <= 0 ||
        !Number.isSafeInteger(lessonId) || lessonId <= 0
    ) {
        const error = new Error("Invalid course or lesson ID");
        error.statusCode = 400;
        throw error;
    }

    // --------------------------------------------------------
    // 2. VALIDATE USER ID
    // --------------------------------------------------------
    // Logged-in student ID valid-ஆக இருக்க வேண்டும்.

    if (!Number.isSafeInteger(userId) || userId <= 0) {
        const error = new Error("Authentication required");
        error.statusCode = 401;
        throw error;
    }

    // Get a database client for transaction operations.
    const client = await pool.connect();

    try {

        // ----------------------------------------------------
        // 3. START DATABASE TRANSACTION
        // ----------------------------------------------------
        // All progress operations should succeed together.
        // Any failure will trigger ROLLBACK.

        await client.query("BEGIN");

        // ----------------------------------------------------
        // 4. CHECK STUDENT ENROLLMENT
        // ----------------------------------------------------
        // Student இந்த course-ல் active enrollment
        // வைத்திருக்கிறாரா என்று verify செய்கிறோம்.

        const enrollment =
            await lessonProgressRepository.findActiveEnrollment(
                client,
                courseId,
                userId
            );

        if (!enrollment) {
            const error = new Error(
                "An active enrollment is required"
            );
            error.statusCode = 403;
            throw error;
        }

        // ----------------------------------------------------
        // 5. CHECK LESSON BELONGS TO THE COURSE
        // ----------------------------------------------------
        // URL-ல் அனுப்பிய lessonId உண்மையிலேயே
        // இந்த course-க்கு சொந்தமானதா என்று check செய்கிறோம்.

        const lessonExists =
            await lessonProgressRepository.lessonBelongsToCourse(
                client,
                courseId,
                lessonId
            );

        if (!lessonExists) {
            const error = new Error("Lesson not found");
            error.statusCode = 404;
            throw error;
        }

        // ----------------------------------------------------
        // 6. SAVE LESSON COMPLETION
        // ----------------------------------------------------
        // Lesson progress table-ல் lesson status COMPLETED
        // என்றும் progress 100% என்றும் save செய்யும்.

        await lessonProgressRepository.saveLessonCompletion(
            client,
            enrollment.id,
            lessonId,
            userId
        );

        // ----------------------------------------------------
        // 7. CALCULATE COURSE TOTALS
        // ----------------------------------------------------
        // Course-ல்:
        // - Total modules
        // - Completed modules
        // - Total lessons
        // - Completed lessons
        // ஆகியவற்றை calculate செய்கிறோம்.

        const progress = await calculateCourseProgress(
            client,
            courseId,
            enrollment.id
        );

        // ----------------------------------------------------
        // 10. SAVE OVERALL COURSE PROGRESS
        // ----------------------------------------------------
        // Update the course_progress table with calculated
        // totals, percentage and course status.

        const previousStatus = await persistCourseProgress(
            client,
            enrollment.id,
            progress,
            lessonId,
            userId
        );

        // ----------------------------------------------------
        // 11. COMMIT TRANSACTION
        // ----------------------------------------------------
        // All database operations succeeded.
        // Permanently save the changes.

        await client.query("COMMIT");

        await notifyCourseCompletion(userId, enrollment, progress, previousStatus);
        await issueCertificateIfCourseCompleted(userId, enrollment.id, progress);

        // Return updated progress information to controller.
        return {
            lesson_id: lessonId,
            lesson_status: "COMPLETED",
            course_progress: {
                total_modules: progress.totalModules,
                completed_modules: progress.completedModules,
                total_lessons: progress.totalLessons,
                completed_lessons: progress.completedLessons,
                total_assessments: progress.totalAssessments,
                completed_assessments: progress.completedAssessments,
                total_required_assessments: progress.totalRequiredAssessments,
                completed_required_assessments: progress.completedRequiredAssessments,
                total_activities: progress.totalActivities,
                completed_activities: progress.completedActivities,
                progress_percentage: progress.percentage,
                status: progress.status
            }
        };

    } catch (error) {

        // ----------------------------------------------------
        // 12. ROLLBACK ON ERROR
        // ----------------------------------------------------
        // If any operation fails, undo all changes
        // made inside this transaction.

        await client.query("ROLLBACK").catch(() => {});

        throw error;

    } finally {

        // Always release the database client.
        client.release();
    }
}

async function updateLessonProgress({
    courseId,
    lessonId,
    userId,
    progressPercentage
}) {
    courseId = Number(courseId);
    lessonId = Number(lessonId);
    userId = Number(userId);
    progressPercentage = Number(progressPercentage);

    if (
        !Number.isSafeInteger(courseId) || courseId <= 0 ||
        !Number.isSafeInteger(lessonId) || lessonId <= 0
    ) {
        const error = new Error("Invalid course or lesson ID");
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isSafeInteger(userId) || userId <= 0) {
        const error = new Error("Authentication required");
        error.statusCode = 401;
        throw error;
    }

    if (
        !Number.isFinite(progressPercentage) ||
        progressPercentage < 0 ||
        progressPercentage > 100
    ) {
        const error = new Error("Progress must be between 0 and 100");
        error.statusCode = 400;
        throw error;
    }

    if (progressPercentage >= 100) {
        return markLessonComplete({ courseId, lessonId, userId });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const enrollment =
            await lessonProgressRepository.findActiveEnrollment(
                client,
                courseId,
                userId
            );

        if (!enrollment) {
            const error = new Error("An active enrollment is required");
            error.statusCode = 403;
            throw error;
        }

        const lessonExists =
            await lessonProgressRepository.lessonBelongsToCourse(
                client,
                courseId,
                lessonId
            );

        if (!lessonExists) {
            const error = new Error("Lesson not found");
            error.statusCode = 404;
            throw error;
        }

        const savedProgress =
            await lessonProgressRepository.saveLessonProgress(
                client,
                enrollment.id,
                lessonId,
                userId,
                progressPercentage
            );

        const progress = await calculateCourseProgress(
            client,
            courseId,
            enrollment.id
        );

        const previousStatus = await persistCourseProgress(
            client,
            enrollment.id,
            progress,
            lessonId,
            userId
        );

        await client.query("COMMIT");

        await notifyCourseCompletion(userId, enrollment, progress, previousStatus);
        await issueCertificateIfCourseCompleted(userId, enrollment.id, progress);

        return {
            lesson_id: lessonId,
            lesson_progress: {
                status: savedProgress.status,
                progress_percentage: Number(savedProgress.progress_percentage)
            },
            course_progress: {
                total_modules: progress.totalModules,
                completed_modules: progress.completedModules,
                total_lessons: progress.totalLessons,
                completed_lessons: progress.completedLessons,
                total_assessments: progress.totalAssessments,
                completed_assessments: progress.completedAssessments,
                total_required_assessments: progress.totalRequiredAssessments,
                completed_required_assessments: progress.completedRequiredAssessments,
                total_activities: progress.totalActivities,
                completed_activities: progress.completedActivities,
                progress_percentage: progress.percentage,
                status: progress.status
            }
        };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function refreshCourseProgressForAssessment({
    assessmentId,
    enrollmentId,
    userId,
    actorId = userId
}) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const courseId = await lessonProgressRepository.getCourseIdForAssessment(
            client,
            assessmentId
        );
        if (!courseId) {
            throw new Error("Assessment course was not found while refreshing progress.");
        }
        const courseTitle = await lessonProgressRepository.getCourseTitle(
            client,
            courseId
        );

        const progress = await calculateCourseProgress(
            client,
            courseId,
            enrollmentId
        );

        const previousStatus = await persistCourseProgress(
            client,
            enrollmentId,
            progress,
            null,
            actorId
        );

        await client.query("COMMIT");

        await notifyCourseCompletion(
            userId,
            { course_title: courseTitle },
            progress,
            previousStatus
        );
        await issueCertificateIfCourseCompleted(userId, enrollmentId, progress);
        return progress;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    markLessonComplete,
    updateLessonProgress,
    refreshCourseProgressForAssessment
};
