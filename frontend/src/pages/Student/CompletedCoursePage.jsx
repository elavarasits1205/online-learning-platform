import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../service/Api";
import "../shared/LearningManagementPage.scss";

export default function CompletedCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCompletedCourses() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/student/enrollments");
        const body = response.data?.data ?? response.data;
        const enrollments = Array.isArray(body?.enrollments) ? body.enrollments : [];
        const completed = enrollments.filter((enrollment) =>
          String(enrollment.enrollment_status ?? enrollment.status ?? "").toUpperCase() === "COMPLETED"
        );
        if (active) setCourses(completed);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message || "Unable to load completed courses.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCompletedCourses();
    return () => { active = false; };
  }, []);

  return (
    <main className="learning-page learning-page--all-courses">
      <header className="page-heading">
        <div>
          <h1>Completed Courses</h1>
          <p>Review the courses you have successfully completed.</p>
        </div>
      </header>

      {loading ? (
        <div className="empty-state"><p>Loading completed courses...</p></div>
      ) : error ? (
        <div className="empty-state" role="alert"><p>{error}</p></div>
      ) : courses.length ? (
        <div className="learning-grid">
          {courses.map((course) => {
            const courseId = course.course_id ?? course.id;
            const title = course.title || course.course_title || "Completed course";
            return (
              <article className="learning-card" key={course.enrollment_id ?? courseId}>
                {course.thumbnail_url ? (
                  <img className="course-art-image" src={course.thumbnail_url} alt={title} loading="lazy" />
                ) : (
                  <div className="course-art" aria-hidden="true">✓</div>
                )}
                <div className="course-meta">
                  <span className="status-pill">Completed</span>
                  <span>{course.level || "All levels"}</span>
                </div>
                <h2>{title}</h2>
                <p>{course.short_description || "You have completed this course."}</p>
                <Link className="learning-button" to={"/student/learning/" + encodeURIComponent(courseId)}>
                  Review Course
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No completed courses yet</h2>
          <p>Courses you complete will be listed here.</p>
        </div>
      )}
    </main>
  );
}
