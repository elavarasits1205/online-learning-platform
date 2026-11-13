
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../service/Api";
import "../shared/LearningManagementPage.scss";

export default function LearningCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/student/enrollments");
        const payload = response.data?.data ?? response.data;
        const rows = Array.isArray(payload)
          ? payload
          : payload?.enrollments ?? payload?.items ?? [];

        if (!cancelled) {
          setCourses(Array.isArray(rows) ? rows : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              "Unable to load your enrolled courses. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  function continueLearning(courseId) {
    if (courseId === null || courseId === undefined || courseId === "") return;
    navigate(`/student/learning/${encodeURIComponent(courseId)}`);
  }

  return (
    <main className="learning-page">
      <header className="page-heading">
        <div>
          <h1>Learning Courses</h1>
          <p>Continue learning from your enrolled courses.</p>
        </div>
      </header>

      {loading ? (
        <div className="empty-state" role="status">
          <p>Loading your courses...</p>
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <h2>Couldn't load your courses</h2>
          <p>{error}</p>
        </div>
      ) : courses.length ? (
        <div className="learning-grid">
          {courses.map((enrollment, index) => {
            const course = enrollment.course ?? enrollment;
            const courseId =
              enrollment.course_id ?? enrollment.courseId ?? course.id;
            const title =
              enrollment.course_title ??
              enrollment.title ??
              course.title ??
              "Enrolled course";
            const image =
              course.thumbnail_url ??
              course.thumbnailUrl ??
              course.thumbnail ??
              course.image_url ??
              course.imageUrl;
            const progress = Number(
              enrollment.progress_percentage ??
                enrollment.progress ??
                enrollment.completion_percentage ??
                0
            );
            const safeProgress = Number.isFinite(progress)
              ? Math.min(100, Math.max(0, progress))
              : 0;

            return (
              <article
                className="learning-card"
                key={enrollment.enrollment_id ?? courseId ?? index}
              >
                {image ? (
                  <img className="course-art-image" src={image} alt={title} />
                ) : (
                  <div className="course-art" aria-hidden="true">LEARN</div>
                )}
                <h2>{title}</h2>
                <p>
                  {enrollment.description ?? course.description ??
                    "Continue where you left off in this course."}
                </p>
                <div className="course-meta">
                  <span>Progress</span>
                  <span>{safeProgress}%</span>
                </div>
                <button
                  className="learning-button"
                  type="button"
                  disabled={!courseId}
                  onClick={() => continueLearning(courseId)}
                >
                  Continue Learning
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No courses in progress yet</h2>
          <p>Your enrolled courses will appear here when available.</p>
        </div>
      )}
    </main>
  );
}
