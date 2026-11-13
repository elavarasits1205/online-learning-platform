import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import instructorApi from "../../../service/InstructorApi";
import "./ViewCoursePage.scss";

function unwrap(response) {
  const body = response?.data ?? response;
  return body?.data ?? body;
}

function asArray(response, key) {
  const result = unwrap(response);
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.items)) return result.items;
  if (key && Array.isArray(result?.[key])) return result[key];
  return [];
}

function itemId(item) {
  return item?.id ?? item?.module_id ?? item?.lesson_id;
}

function priceLabel(course) {
  const price = Number(course?.price ?? 0);
  if (course?.course_type === "FREE" || price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}`;
}

function errorMessage(error) {
  const status = error?.response?.status;
  if (status === 401) return "Your session has expired. Please sign in again, then open the course.";
  if (status === 403) return error?.response?.data?.message || "Your account does not have permission to view this course or its curriculum.";
  if (status === 404) return "The course endpoint or course record was not found. Confirm the course exists in your instructor's course list.";
  return error?.response?.data?.message || error?.message || "Unable to load this course.";
}

export default function ViewCoursePage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessonsByModule, setLessonsByModule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [curriculumNotice, setCurriculumNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDetails() {
      setLoading(true);
      setError("");
      setCurriculumNotice("");
      try {
        // IMPORTANT: the uploaded backend has GET /api/courses/my, but it does NOT
        // implement GET /api/courses/:id. Fetch the existing list and select by ID.
        const listResponse = await instructorApi.getMyCourses();
        const courseList = asArray(listResponse, "courses");
        const selected = courseList.find((item) => String(item.id ?? item.course_id) === String(id));

        if (!selected) {
          throw new Error(`Course ID ${id} was not found in your instructor course list. Make sure the selected course belongs to your account.`);
        }
        if (!active) return;
        setCourse(selected);

        let moduleList = [];
        try {
          moduleList = asArray(await instructorApi.getModules(id), "modules");
        } catch (moduleError) {
          if (moduleError?.response?.status === 401) throw moduleError;
          setCurriculumNotice(moduleError?.response?.status === 403
            ? "Course details are loaded, but your account lacks MODULE_VIEW permission to display modules."
            : "Course details are loaded, but modules could not be fetched.");
        }
        if (!active) return;
        setModules(moduleList);

        const entries = await Promise.all(moduleList.map(async (module) => {
          const moduleId = itemId(module);
          if (moduleId == null) return ["missing", []];
          try {
            return [String(moduleId), asArray(await instructorApi.getLessons(moduleId), "lessons")];
          } catch (lessonError) {
            if (lessonError?.response?.status === 401) throw lessonError;
            setCurriculumNotice(lessonError?.response?.status === 403
              ? "Some lessons are hidden because your account lacks LESSON_VIEW permission."
              : "Some lesson details could not be loaded.");
            return [String(moduleId), []];
          }
        }));
        if (active) setLessonsByModule(Object.fromEntries(entries));
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDetails();
    return () => { active = false; };
  }, [id]);

  if (loading) return <main className="view-course-page"><p role="status">Loading course details...</p></main>;

  if (error || !course) {
    return (
      <main className="view-course-page">
        <Link className="view-course-back" to="/instructor/all-courses">← Back to All Courses</Link>
        <section className="view-course-alert" role="alert">
          <h1>Unable to open this course</h1>
          <p>{error || "Course details are unavailable."}</p>
        </section>
      </main>
    );
  }

  const thumbnail = course.thumbnail_url || course.thumbnailUrl || course.thumbnail || course.image_url || "";

  return (
    <main className="view-course-page">
      <header className="view-course-header">
        <Link className="view-course-back" to="/instructor/all-courses">← Back to All Courses</Link>
        <div className="view-course-header__actions">
          <Link className="view-course-button view-course-button--secondary" to={`/instructor/courses/${id}/curriculum`}>Manage Curriculum</Link>
          <Link className="view-course-button" to={`/instructor/courses/${id}/edit`}>Edit Course</Link>
        </div>
      </header>

      {curriculumNotice && <p className="view-course-muted" role="status">{curriculumNotice}</p>}

      <section className="view-course-hero">
        {thumbnail ? <img className="view-course-hero__image" src={thumbnail} alt={`${course.title || "Course"} thumbnail`} /> : <div className="view-course-hero__placeholder" aria-hidden="true">{String(course.title || "CO").slice(0, 2).toUpperCase()}</div>}
        <div className="view-course-hero__content">
          <span className="view-course-eyebrow">COURSE DETAILS</span>
          <h1>{course.title || "Untitled Course"}</h1>
          <p>{course.short_description || "No short description has been added for this course."}</p>
          <div className="view-course-tags">
            {(course.category_name || course.category) && <span>{course.category_name || course.category}</span>}
            {course.level && <span>{String(course.level).replaceAll("_", " ")}</span>}
            {(course.approval_status || course.status) && <span>Status: {String(course.approval_status || course.status).replaceAll("_", " ")}</span>}
          </div>
          <strong className="view-course-price">{priceLabel(course)}</strong>
        </div>
      </section>

      <section className="view-course-section">
        <h2>About this course</h2>
        <p className="view-course-description">{course.description || course.short_description || "No course description has been added yet."}</p>
        <dl className="view-course-facts">
          <div><dt>Course code</dt><dd>{course.course_code || "—"}</dd></div>
          <div><dt>Duration</dt><dd>{course.duration_minutes != null ? `${course.duration_minutes} minutes` : "Not specified"}</dd></div>
          <div><dt>Language</dt><dd>{course.language_code || "Not specified"}</dd></div>
          <div><dt>Course type</dt><dd>{course.course_type || "Not specified"}</dd></div>
        </dl>
      </section>

      <section className="view-course-section">
        <h2>Course curriculum</h2>
        {!modules.length ? <p className="view-course-muted">No modules are available, or your account does not have permission to view them.</p> : (
          <div className="view-course-modules">
            {modules.map((module, index) => {
              const moduleId = itemId(module);
              const lessons = lessonsByModule[String(moduleId)] || [];
              return (
                <article className="view-course-module" key={moduleId ?? index}>
                  <div className="view-course-module__heading"><div><span className="view-course-module__number">MODULE {module.sequence_number ?? index + 1}</span><h3>{module.title || `Module ${index + 1}`}</h3>{module.description && <p>{module.description}</p>}</div><span className="view-course-module__count">{lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}</span></div>
                  {lessons.length > 0 && <ul className="view-course-lessons">{lessons.map((lesson, lessonIndex) => <li key={itemId(lesson) ?? lessonIndex}><span className="view-course-lesson-icon">▶</span><span className="view-course-lesson-title">{lesson.title || `Lesson ${lessonIndex + 1}`}</span><span className="view-course-lesson-meta">{lesson.duration_minutes != null ? `${lesson.duration_minutes} min` : (lesson.content_type || "Lesson")}</span></li>)}</ul>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
