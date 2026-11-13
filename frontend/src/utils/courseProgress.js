function count(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function calculateCourseProgress(payload) {
  const modules = Array.isArray(payload?.modules) ? payload.modules : [];
  const lessons = modules.flatMap((module) =>
    Array.isArray(module.lessons) ? module.lessons : []
  );
  const courseProgress = payload?.course_progress ?? {};

  const totalRequiredAssessments = count(
    courseProgress.total_required_assessments ?? courseProgress.total_assessments
  );
  const completedRequiredAssessments = Math.min(
    totalRequiredAssessments,
    count(
      courseProgress.completed_required_assessments ??
        courseProgress.completed_assessments
    )
  );

  const totalLessons = count(courseProgress.total_lessons ?? lessons.length);
  const completedLessons = Math.min(
    totalLessons,
    count(
      courseProgress.completed_lessons ??
        lessons.filter(
          (lesson) => String(lesson.progress_status ?? "").toUpperCase() === "COMPLETED"
        ).length
    )
  );
  const lessonProgressTotal = lessons.reduce((total, lesson) => {
    const completed = String(lesson.progress_status ?? "").toUpperCase() === "COMPLETED";
    const value = completed ? 100 : Number(lesson.lesson_progress_percentage ?? 0);
    return total + Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  }, 0);

  const totalActivities = totalLessons + totalRequiredAssessments;
  const allRequirementsMet = totalActivities > 0 &&
    completedLessons === totalLessons &&
    completedRequiredAssessments === totalRequiredAssessments;
  const savedPercentage = Number(courseProgress.progress_percentage ?? 0);
  const calculatedPercentage = totalActivities > 0 && (lessons.length > 0 || totalLessons === 0)
    ? Math.round(
        (lessonProgressTotal + completedRequiredAssessments * 100) / totalActivities
      )
    : Number.isFinite(savedPercentage) ? Math.round(savedPercentage) : 0;
  const percentage = allRequirementsMet
    ? 100
    : Math.min(99, calculatedPercentage);

  return {
    totalLessons,
    completedLessons,
    totalAssessments: totalRequiredAssessments,
    completedAssessments: completedRequiredAssessments,
    percentage,
    status: allRequirementsMet
      ? "COMPLETED"
      : percentage > 0
        ? "IN_PROGRESS"
        : "NOT_STARTED",
  };
}
