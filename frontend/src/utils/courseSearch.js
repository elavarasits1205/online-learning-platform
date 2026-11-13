function getCourseSearchText(course) {
  const instructorNames = Array.isArray(course?.instructors)
    ? course.instructors.map((instructor) => instructor?.name)
    : [];

  return [
    course?.title,
    course?.course_name,
    course?.short_description,
    course?.description,
    course?.category_name,
    course?.categoryName,
    course?.category?.name,
    course?.instructor_name,
    course?.instructorName,
    course?.instructor?.name,
    ...instructorNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesCourseSearch(course, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  return !normalizedQuery || getCourseSearchText(course).includes(normalizedQuery);
}
