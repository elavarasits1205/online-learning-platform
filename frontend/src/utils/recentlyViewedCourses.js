import { useEffect, useState } from "react";
import { getAuthUser } from "./authCookie";

const RECENT_COURSES_EVENT = "olp:recent-courses-updated";
const MAX_RECENT_COURSES = 8;

function getRecentCoursesKey() {
  const user = getAuthUser();
  const userId =
    user?.id ??
    user?.user_id ??
    user?.userId ??
    user?.user?.id ??
    user?.email ??
    user?.username ??
    "student";

  return `olp:recent-courses:${encodeURIComponent(String(userId))}`;
}

function readRecentlyViewedCourses() {
  if (typeof window === "undefined") return [];

  try {
    const saved = JSON.parse(
      window.localStorage.getItem(getRecentCoursesKey()) || "[]",
    );
    return Array.isArray(saved)
      ? saved.filter((course) => course?.id != null).slice(0, MAX_RECENT_COURSES)
      : [];
  } catch {
    return [];
  }
}

function notifyRecentlyViewedChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RECENT_COURSES_EVENT));
  }
}

export function recordRecentlyViewedCourse(course) {
  if (typeof window === "undefined") return;

  const id = course?.id ?? course?.course_id;
  if (id == null || id === "") return;

  const summary = {
    id,
    title: course.title ?? course.course_name ?? course.name ?? "Untitled course",
    thumbnail_url:
      course.thumbnail_url ??
      course.thumbnailUrl ??
      course.thumbnail ??
      course.image_url ??
      course.imageUrl ??
      course.course_thumbnail ??
      "",
    category_name:
      course.category_name ??
      course.categoryName ??
      course.category?.name ??
      "Online course",
    instructor_name:
      course.instructors?.[0]?.name ??
      course.instructor_name ??
      course.instructorName ??
      course.instructor?.name ??
      "Learnova instructor",
    price: course.price ?? course.price_amount ?? course.course_price ?? null,
    currency_code: course.currency_code ?? "INR",
    course_type: course.course_type ?? "",
    duration_hours:
      course.duration_hours ?? course.durationHours ?? course.duration ?? null,
    lesson_count:
      course.lesson_count ?? course.lessonCount ?? course.lessons_count ?? null,
    rating: course.rating ?? null,
    review_count: course.review_count ?? null,
    viewedAt: new Date().toISOString(),
  };

  try {
    const courses = readRecentlyViewedCourses().filter(
      (item) => String(item.id) !== String(id),
    );
    window.localStorage.setItem(
      getRecentCoursesKey(),
      JSON.stringify([summary, ...courses].slice(0, MAX_RECENT_COURSES)),
    );
    notifyRecentlyViewedChange();
  } catch {
    // Keep course browsing available if storage is full or restricted.
  }
}

export function clearRecentlyViewedCourses() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getRecentCoursesKey());
    notifyRecentlyViewedChange();
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export function useRecentlyViewedCourses() {
  const [courses, setCourses] = useState(readRecentlyViewedCourses);

  useEffect(() => {
    const refresh = () => setCourses(readRecentlyViewedCourses());
    window.addEventListener(RECENT_COURSES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(RECENT_COURSES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return courses;
}
