import { useCallback, useEffect, useState } from "react";
import { getAuthUser } from "./authCookie";

const WISHLIST_EVENT = "olp:wishlist-updated";

function getWishlistKey() {
  const user = getAuthUser();
  const userId =
    user?.id ??
    user?.user_id ??
    user?.userId ??
    user?.user?.id ??
    user?.user?.user_id ??
    user?.email ??
    user?.username ??
    "student";

  return `olp:wishlist:${encodeURIComponent(String(userId))}`;
}

function readWishlist() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(getWishlistKey()) || "[]");
    return Array.isArray(saved) ? saved.filter((course) => course?.id != null) : [];
  } catch {
    return [];
  }
}

function writeWishlist(courses) {
  try {
    window.localStorage.setItem(getWishlistKey(), JSON.stringify(courses));
    window.dispatchEvent(new Event(WISHLIST_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function useWishlist() {
  const [courses, setCourses] = useState(readWishlist);

  useEffect(() => {
    const refresh = () => setCourses(readWishlist());
    window.addEventListener(WISHLIST_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const isSaved = useCallback(
    (courseId) => courses.some((course) => String(course.id) === String(courseId)),
    [courses],
  );

  const toggle = useCallback((course) => {
    const courseId = course?.id ?? course?.course_id;
    if (courseId == null) return false;

    const current = readWishlist();
    const exists = current.some((item) => String(item.id) === String(courseId));
    const next = exists
      ? current.filter((item) => String(item.id) !== String(courseId))
      : [...current, { ...course, id: courseId }];

    writeWishlist(next);
    setCourses(next);
    return !exists;
  }, []);

  const remove = useCallback((courseId) => {
    const next = readWishlist().filter((course) => String(course.id) !== String(courseId));
    writeWishlist(next);
    setCourses(next);
  }, []);

  return { courses, isSaved, toggle, remove };
}
