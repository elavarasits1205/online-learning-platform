import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import api from "../../service/Api";
import CourseCard from "./CourseCard";
import "./RelatedCourses.scss";

function extractCourses(response) {
  const payload = response?.data?.data ?? response?.data ?? {};
  return Array.isArray(payload.courses) ? payload.courses : [];
}

export default function RelatedCourses({
  categoryId,
  excludeCourseIds = [],
  limit = 4,
  title = "Related courses",
  description = "Keep building your skills with these courses.",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const excludedIds = excludeCourseIds.map(String).sort().join(",");

  useEffect(() => {
    const controller = new AbortController();
    const excluded = new Set(excludedIds.split(",").filter(Boolean));

    async function loadSuggestions() {
      setLoading(true);

      try {
        const params = { page: 1, limit: Math.max(limit * 4, 16) };
        if (categoryId !== null && categoryId !== undefined && categoryId !== "") {
          params.category = categoryId;
        }

        const relatedResponse = await api.get("/public/catalog", {
          params,
          signal: controller.signal,
        });
        let candidates = extractCourses(relatedResponse);

        if (candidates.filter((course) => !excluded.has(String(course.id))).length < limit) {
          const catalogResponse = await api.get("/public/catalog", {
            params: { page: 1, limit: Math.max(limit * 6, 24) },
            signal: controller.signal,
          });
          const existing = new Set(candidates.map((course) => String(course.id)));
          candidates = [
            ...candidates,
            ...extractCourses(catalogResponse).filter((course) => !existing.has(String(course.id))),
          ];
        }

        if (!controller.signal.aborted) {
          setCourses(
            candidates
              .filter((course) => course?.id != null && !excluded.has(String(course.id)))
              .slice(0, limit),
          );
        }
      } catch {
        if (!controller.signal.aborted) setCourses([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadSuggestions();
    return () => controller.abort();
  }, [categoryId, excludedIds, limit]);

  if (!loading && courses.length === 0) return null;

  return (
    <section className="related-courses" aria-label={title}>
      <header className="related-courses__heading">
        <div>
          <span>KEEP LEARNING</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      {loading ? (
        <div className="related-courses__loading" role="status" aria-label="Loading course suggestions">
          <CircularProgress size={24} />
        </div>
      ) : (
        <div className="related-courses__grid">
          {courses.map((course, index) => (
            <CourseCard
              course={course}
              index={index}
              key={course.id}
              onOpen={(selectedCourse) => navigate(`/courses/${encodeURIComponent(selectedCourse.id)}`, {
                state: { from: `${location.pathname}${location.search}` },
              })}
            />
          ))}
        </div>
      )}
    </section>
  );
}
