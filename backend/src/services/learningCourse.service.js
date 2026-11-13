
const learningCourseRepository =
    require("../repositories/learningCourse.repository");
const { getLessonVideoPlaybackUrl } = require("./storage.service");

function buildCourseProgress(lessons, assessmentTotals, totalModules, completedModules) {
    const totalLessons = lessons.length;
    const completedLessons = lessons.filter(
        lesson => String(lesson.progress_status || "").toUpperCase() === "COMPLETED"
    ).length;
    const lessonProgressTotal = lessons.reduce((total, lesson) => {
        const progress = String(lesson.progress_status || "").toUpperCase() === "COMPLETED"
            ? 100
            : Number(lesson.lesson_progress_percentage ?? 0);
        return total + Math.min(100, Math.max(0, Number.isFinite(progress) ? progress : 0));
    }, 0);
    const totalAssessments = Number(assessmentTotals?.total_assessments ?? 0);
    const completedAssessments = Number(assessmentTotals?.completed_assessments ?? 0);
    const totalRequiredAssessments = Number(assessmentTotals?.total_required_assessments ?? 0);
    const completedRequiredAssessments = Number(assessmentTotals?.completed_required_assessments ?? 0);
    const totalActivities = totalLessons + totalRequiredAssessments;
    const completedActivities = completedLessons + completedRequiredAssessments;
    const completionRequirementsMet = totalActivities > 0 &&
        completedLessons === totalLessons &&
        completedRequiredAssessments === totalRequiredAssessments;
    const calculatedPercentage = totalActivities > 0
        ? Number(((lessonProgressTotal + completedRequiredAssessments * 100) / totalActivities).toFixed(2))
        : 0;
    const percentage = completionRequirementsMet
        ? Math.min(100, calculatedPercentage)
        : Math.min(99, calculatedPercentage);

    return {
        total_modules: totalModules,
        completed_modules: completedModules,
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        total_assessments: totalAssessments,
        completed_assessments: completedAssessments,
        total_required_assessments: totalRequiredAssessments,
        completed_required_assessments: completedRequiredAssessments,
        total_activities: totalActivities,
        completed_activities: completedActivities,
        progress_percentage: percentage,
        status: completionRequirementsMet && percentage >= 100
            ? "COMPLETED"
            : percentage > 0
                ? "IN_PROGRESS"
                : "NOT_STARTED"
    };
}

// ============================================================
// GET ENROLLED COURSE LEARNING CONTENT
// ============================================================

async function getEnrolledCourseLearningContent(
    userId,
    courseId
) {

    // STEP 1: Verify student enrollment.

    const course =
        await learningCourseRepository.getEnrolledCourse(
            userId,
            courseId
        );

    if (!course) {
        return null;
    }

    // STEP 2: Fetch active modules.

    const modules =
        await learningCourseRepository.getActiveModulesByCourseId(
            courseId
        );

    const courseAssessmentProgress =
        await learningCourseRepository.getCourseAssessmentProgress(
            courseId,
            course.enrollment_id
        );

    if (modules.length === 0) {
        return {
            course,
            modules: [],
            course_progress: buildCourseProgress(
                [],
                courseAssessmentProgress,
                0,
                0
            )
        };
    }

    // STEP 3: Fetch lessons and student progress.

    const lessons =
        await learningCourseRepository.getActiveLessonsByCourseId(
            courseId,
            course.enrollment_id
        );

    // STEP 4: Fetch required module assessment statuses.

    const assessmentStatuses =
        await learningCourseRepository.getModuleAssessmentStatuses(
            courseId,
            course.enrollment_id
        );

    // STEP 5: Group lessons by module.

    const lessonsByModule = new Map();

    for (const lesson of lessons) {
        const moduleKey = String(lesson.module_id);

        if (!lessonsByModule.has(moduleKey)) {
            lessonsByModule.set(moduleKey, []);
        }

        lessonsByModule.get(moduleKey).push(lesson);
    }

    // STEP 6: Group required assessments by module.

    const assessmentsByModule = new Map();

    for (const assessment of assessmentStatuses) {
        const moduleKey = String(assessment.module_id);

        if (!assessmentsByModule.has(moduleKey)) {
            assessmentsByModule.set(moduleKey, []);
        }

        assessmentsByModule.get(moduleKey).push(assessment);
    }

    // STEP 7: Calculate module completion and unlock status.

    const modulesWithUnlockStatus = [];

    for (let index = 0; index < modules.length; index++) {

        const module = modules[index];

        const moduleLessons =
            lessonsByModule.get(String(module.id)) || [];

        const requiredAssessments =
            assessmentsByModule.get(String(module.id)) || [];

        // All lessons must be completed.
        const allLessonsCompleted =
            moduleLessons.length > 0 &&
            moduleLessons.every(
                lesson => lesson.progress_status === "COMPLETED"
            );

        // All required assessments must be passed.
        const allRequiredAssessmentsPassed =
            requiredAssessments.every(
                assessment => assessment.has_passed === true
            );

        // A module is complete only when both conditions pass.
        const isCompleted =
            allLessonsCompleted &&
            allRequiredAssessmentsPassed;

        // First module is unlocked automatically.
        // Other modules unlock only when the previous module
        // has been completed.
        const previousModule =
            index > 0
                ? modulesWithUnlockStatus[index - 1]
                : null;

        const isUnlocked =
            index === 0 ||
            previousModule?.is_completed === true;

        // STEP 8: Hide protected content for locked modules.

        const protectedLessons = await Promise.all(moduleLessons.map(async lesson => {

            if (isUnlocked) {
                return {
                    ...lesson,
                    video_url: await getLessonVideoPlaybackUrl(lesson.video_url),
                    is_locked: false
                };
            }

            return {
                ...lesson,
                video_url: null,
                content: null,
                resources: null,
                lesson_resources: null,
                attachments: null,
                materials: null,
                lesson_materials: null,
                resource_links: null,
                resource_urls: null,
                is_locked: true
            };
        }));

        modulesWithUnlockStatus.push({

            ...module,

            lessons: protectedLessons,

            is_unlocked: isUnlocked,

            is_completed: isCompleted,

            locked_reason: isUnlocked
                ? null
                : "Complete the previous module to unlock this module.",

            required_assessments: requiredAssessments.map(
                assessment => ({
                    assessment_id: assessment.assessment_id,
                    title: assessment.title,
                    has_passed: assessment.has_passed
                })
            )
        });
    }

    // STEP 9: Return course learning content.

    return {
        course,
        modules: modulesWithUnlockStatus,
        course_progress: buildCourseProgress(
            lessons,
            courseAssessmentProgress,
            modules.length,
            modulesWithUnlockStatus.filter(module => module.is_completed).length
        )
    };
}

module.exports = {
    async getLearningActivity(userId) {
        const activityDates = await learningCourseRepository.getLearningActivityDates(userId);
        return { activity_dates: activityDates };
    },
    getEnrolledCourseLearningContent
};
