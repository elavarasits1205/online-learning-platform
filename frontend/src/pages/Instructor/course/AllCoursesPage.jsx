import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "@mui/material/Pagination";
import instructorApi from "../../../service/InstructorApi";
import "../../shared/LearningManagementPage.scss";

function unwrap(response) {
  const body = response?.data ?? response;
  return body?.data ?? body;
}

function extractCourses(response) {
  const result = unwrap(response);
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.courses)) return result.courses;
  if (Array.isArray(result?.items)) return result.items;
  return [];
}

function courseCategory(course) {
  return course?.category_name || course?.category || course?.category_title || "Course";
}

function priceLabel(course) {
  const price = Number(course?.price ?? 0);
  if (course?.course_type === "FREE" || price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}`;
}

const COURSES_PER_PAGE = 3;

export default function AllCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCourses() {
      setLoading(true);
      setError("");
      try {
        // This endpoint already exists in your backend and is protected by COURSE_VIEW.
        const response = await instructorApi.getMyCourses();
        const data = extractCourses(response);
        if (active) setCourses(data);
      } catch (err) {
        if (active) {
          setError(
            err?.response?.data?.message ||
              "Could not load courses. Check your login session and COURSE_VIEW permission."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCourses();
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => [
    "All",
    ...new Set(courses.map(courseCategory)),
  ], [courses]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => {
      const title = String(course?.title || "").toLowerCase();
      const instructor = String(course?.instructor_name || course?.instructor || "").toLowerCase();
      const matchesSearch = !query || title.includes(query) || instructor.includes(query);
      const matchesCategory = category === "All" || courseCategory(course) === category;
      return matchesSearch && matchesCategory;
    });
  }, [courses, search, category]);

  const pageCount = Math.ceil(filteredCourses.length / COURSES_PER_PAGE);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const visibleCourses = filteredCourses.slice(
    (currentPage - 1) * COURSES_PER_PAGE,
    currentPage * COURSES_PER_PAGE
  );

  function handleViewCourse(course) {
    const courseId = course?.id ?? course?.course_id;
    if (courseId == null) {
      setError("This course record does not contain a course ID.");
      return;
    }
    navigate(`/instructor/courses/${courseId}`);
  }

  return (
    <main className="learning-page learning-page--all-courses">
      <header className="page-heading">
        <div>
          <h1>All Courses</h1>
          <p>View course details, modules and lessons.</p>
        </div>
      </header>

      <div className="learning-toolbar">
        <input
          type="search"
          placeholder="Search courses..."
          aria-label="Search courses"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        />
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(event) => { setCategory(event.target.value); setPage(1); }}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item === "All" ? "All categories" : item}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="empty-state" role="alert"><p>{error}</p></div>}
      {loading ? (
        <div className="empty-state"><p>Loading courses...</p></div>
      ) : filteredCourses.length ? (
        <>
          <div className="learning-grid">
            {visibleCourses.map((course) => {
            const id = course.id ?? course.course_id;
            const title = course.title || "Untitled course";
            const thumbnail = course.thumbnail_url || course.thumbnailUrl || course.thumbnail;
            return (
              <article className="learning-card" key={id}>
                {thumbnail ? (
                  <img className="course-art-image" src={thumbnail} alt={`${title} thumbnail`} loading="lazy" />
                ) : (
                  <div className="course-art" aria-hidden="true">{title.slice(0, 2).toUpperCase()}</div>
                )}
                <div className="course-meta course-meta--identity">
                  <span className="status-pill">{courseCategory(course)}</span>
                  <span>{course.level || "All levels"}</span>
                </div>
                <h2>{title}</h2>
                <p>Instructor: {course.instructor_name || course.instructor || "You"}</p>
                <div className="course-meta course-meta--details">
                  <span>{priceLabel(course)}</span>
                  <span>{course.approval_status || course.status || "Course"}</span>
                </div>
                <button
                  type="button"
                  className="learning-button"
                  onClick={() => handleViewCourse(course)}
                >
                  View Course
                </button>
              </article>
            );
            })}
          </div>
          {pageCount > 1 && (
            <nav className="learning-pagination" aria-label="Course pages">
              <span>
                Showing {(currentPage - 1) * COURSES_PER_PAGE + 1}–{Math.min(currentPage * COURSES_PER_PAGE, filteredCourses.length)} of {filteredCourses.length} courses
              </span>
              <Pagination
                count={pageCount}
                page={currentPage}
                onChange={(_, nextPage) => setPage(nextPage)}
                color="primary"
                shape="rounded"
                aria-label="Course pages"
              />
            </nav>
          )}
        </>
      ) : (
        <div className="empty-state">
          <h2>No courses found</h2>
          <p>{courses.length ? "Try another search term or category." : "No courses are assigned to your instructor account yet."}</p>
        </div>
      )}
    </main>
  );
}
