
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Plus,
  Pencil,
  Send,
  Video,
} from "lucide-react";

import Button from "../../../component/buttons/Button";
import InputField from "../../../component/fields/InputField";
import instructorApi from "../../../service/InstructorApi";
import "./CourseCurriculumPage.scss";

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

function unwrap(response) {
  const body = response?.data ?? response;
  return body?.data ?? body;
}

function asArray(response) {
  const result = unwrap(response);

  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.modules)) return result.modules;
  if (Array.isArray(result?.lessons)) return result.lessons;

  return [];
}

function itemId(item) {
  return item?.id ?? item?.module_id ?? item?.lesson_id;
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function createEmptyLessonForm() {
  return {
    title: "",
    description: "",
    content_type: "VIDEO",
    content_url: "",
    duration_minutes: "",
  };
}

export default function CourseCurriculumPage() {
  const { id: courseId } = useParams();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessonsByModule, setLessonsByModule] = useState({});

  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [editingModuleId, setEditingModuleId] = useState(null);

  const [lessonForms, setLessonForms] = useState({});
  const [videoFiles, setVideoFiles] = useState({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Load course, modules and lessons.
  const loadCurriculum = useCallback(async () => {
    if (!courseId) {
      setError("Course ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const courseResponse =
        await instructorApi.getCourse(courseId);

      const courseData = unwrap(courseResponse);
      setCourse(courseData?.course ?? courseData);

      const moduleResponse =
        await instructorApi.getModules(courseId);

      const moduleData = asArray(moduleResponse);
      setModules(moduleData);

      const lessonResults = await Promise.all(
        moduleData.map(async (module) => {
          const moduleId = itemId(module);

          if (moduleId == null) {
            return ["invalid-module", []];
          }

          const response =
            await instructorApi.getLessons(moduleId);

          return [
            String(moduleId),
            asArray(response),
          ];
        })
      );

      setLessonsByModule(Object.fromEntries(lessonResults));
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to load course curriculum."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCurriculum();
  }, [loadCurriculum]);

  // Add a module or save edits to the selected module.
  async function handleAddModule(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!moduleTitle.trim()) {
      setError("Enter a module title.");
      return;
    }

    setBusy(true);

    try {
      const payload = {
        title: moduleTitle.trim(),
        description: moduleDescription.trim(),
      };

      if (editingModuleId != null) {
        await instructorApi.updateModule(editingModuleId, payload);
      } else {
        const nextModuleNumber = modules.reduce((highest, module) => {
          const number = Number(module.module_number);
          return Number.isSafeInteger(number) && number > highest
            ? number
            : highest;
        }, 0) + 1;

        await instructorApi.createModule({
          course_id: Number(courseId),
          ...payload,
          module_number: nextModuleNumber,
        });
      }

      setModuleTitle("");
      setModuleDescription("");
      setNotice(editingModuleId != null ? "Module updated successfully." : "Module added successfully.");
      setEditingModuleId(null);

      await loadCurriculum();
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to add module.")
      );
    } finally {
      setBusy(false);
    }
  }

  function handleEditModule(module) {
    const moduleId = itemId(module);
    if (moduleId == null) {
      setError("Invalid module ID.");
      return;
    }
    setError("");
    setNotice("");
    setEditingModuleId(moduleId);
    setModuleTitle(module.title ?? "");
    setModuleDescription(module.description ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelModuleEdit() {
    setEditingModuleId(null);
    setModuleTitle("");
    setModuleDescription("");
    setError("");
  }

  // Update lesson form values.
  function updateLessonForm(moduleId, field, value) {
    const key = String(moduleId);

    setLessonForms((previous) => ({
      ...previous,
      [key]: {
        ...createEmptyLessonForm(),
        ...(previous[key] ?? {}),
        [field]: value,
      },
    }));
  }

  // Validate and store the selected video.
  function handleVideoSelect(moduleId, file) {
    const key = String(moduleId);

    setError("");
    setNotice("");

    if (!file) {
      setVideoFiles((previous) => ({
        ...previous,
        [key]: null,
      }));
      return;
    }

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setVideoFiles((previous) => ({
        ...previous,
        [key]: null,
      }));

      setError("Choose an MP4, WebM or MOV video.");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      setVideoFiles((previous) => ({
        ...previous,
        [key]: null,
      }));

      setError("Video size must not exceed 100 MB.");
      return;
    }

    // Important: use the same module ID key when saving and reading.
    setVideoFiles((previous) => ({
      ...previous,
      [key]: file,
    }));
  }

  // Upload video first, then create the lesson.
  async function handleAddLesson(event, module) {
    event.preventDefault();

    const moduleId = itemId(module);

    if (moduleId == null) {
      setError("Invalid module ID.");
      return;
    }

    const key = String(moduleId);

    const form = {
      ...createEmptyLessonForm(),
      ...(lessonForms[key] ?? {}),
    };

    // Read the selected file using the same key as handleVideoSelect.
    const selectedVideo = videoFiles[key];

    setError("");
    setNotice("");

    if (!form.title.trim()) {
      setError("Enter a lesson title.");
      return;
    }

    // Validate video before starting the request.
    if (
      form.content_type === "VIDEO" &&
      !selectedVideo
    ) {
      setError("Please select a lesson video.");
      return;
    }

    const duration =
      form.duration_minutes === "" ||
      form.duration_minutes == null
        ? null
        : Number(form.duration_minutes);

    if (
      duration !== null &&
      (!Number.isSafeInteger(duration) || duration < 0)
    ) {
      setError(
        "Duration must be a non-negative whole number."
      );
      return;
    }

    setBusy(true);

    try {
      let videoUrl = form.content_url.trim() || null;

      // Step 1: Upload video only for VIDEO lessons.
      if (form.content_type === "VIDEO") {
        const uploadResponse =
          await instructorApi.uploadLessonVideo(
            moduleId,
            selectedVideo
          );

        const uploadData = unwrap(uploadResponse);

        videoUrl =
          uploadData?.publicUrl ??
          uploadData?.video_url ??
          uploadData?.url ??
          null;

        if (!videoUrl) {
          throw new Error(
            "Video upload succeeded, but no video URL was returned."
          );
        }
      }

      // Step 2: Create lesson with the returned video URL.
      await instructorApi.createLesson({
        module_id: Number(moduleId),
        title: form.title.trim(),
        description: form.description.trim(),
        content_type: form.content_type,
        content_url: videoUrl,
        duration_minutes: duration,
        sequence_number:
          (lessonsByModule[key] ?? []).length + 1,
      });

      setLessonForms((previous) => ({
        ...previous,
        [key]: createEmptyLessonForm(),
      }));

      setVideoFiles((previous) => ({
        ...previous,
        [key]: null,
      }));

      setNotice("Lesson added successfully.");

      await loadCurriculum();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to upload video or create lesson."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  // Submit course for approval.
  async function handleSubmitCourse() {
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      await instructorApi.submitCourse(courseId);

      setNotice("Course submitted for approval.");

      await loadCurriculum();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to submit course for approval."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="curriculum-page">
        <p>Loading course curriculum...</p>
      </main>
    );
  }

  return (
    <main className="curriculum-page">
      <header className="curriculum-header">
        <div>
          <Button
            component={Link}
            to="/instructor/courses"
            variant="text"
            startIcon={<ArrowLeft size={17} />}
          >
            Back to My Courses
          </Button>

          <span className="curriculum-eyebrow">
            COURSE BUILDER
          </span>

          <h1>
            {course?.title ?? "Course Curriculum"}
          </h1>

          <p>
            Organize your course into modules and lessons.
          </p>

          {course?.approval_status && (
            <span className="curriculum-status">
              Status:{" "}
              {String(course.approval_status).replaceAll(
                "_",
                " "
              )}
            </span>
          )}
        </div>

        <Button
          onClick={handleSubmitCourse}
          loading={submitting}
          disabled={submitting || busy}
          startIcon={<Send size={16} />}
        >
          Submit for Approval
        </Button>
      </header>

      {error && (
        <div
          className="curriculum-alert curriculum-alert--error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="curriculum-alert curriculum-alert--success"
          role="status"
        >
          {notice}
        </div>
      )}

      <section className="curriculum-panel">
        <div className="curriculum-panel-heading">
          <div className="curriculum-icon">
            <BookOpen size={21} />
          </div>

          <div>
            <h2>Course modules</h2>
            <p>
              {modules.length}{" "}
              {modules.length === 1 ? "module" : "modules"} in
              this course
            </p>
          </div>
        </div>

        {/* Add or edit module */}
        <form
          className="curriculum-module-form"
          onSubmit={handleAddModule}
        >
          <InputField
            name="moduleTitle"
            label="Module title"
            value={moduleTitle}
            onChange={(event) =>
              setModuleTitle(event.target.value)
            }
            required
          />

          <InputField
            name="moduleDescription"
            label="Module description (optional)"
            value={moduleDescription}
            onChange={(event) =>
              setModuleDescription(event.target.value)
            }
          />

          <Button
            type="submit"
            loading={busy}
            disabled={busy || submitting}
            startIcon={<Plus size={16} />}
          >
            {editingModuleId != null ? "Save Changes" : "Add Module"}
          </Button>
          {editingModuleId != null && (
            <Button type="button" variant="text" onClick={cancelModuleEdit} disabled={busy}>
              Cancel
            </Button>
          )}
        </form>

        {modules.length === 0 ? (
          <div className="curriculum-empty">
            <BookOpen size={28} />
            <h3>Your curriculum starts here</h3>
            <p>
              Add your first module, then add lessons inside it.
            </p>
          </div>
        ) : (
          <div className="curriculum-module-list">
            {modules.map((module, index) => {
              const moduleId = itemId(module);
              const key = String(moduleId);

              const lessons = lessonsByModule[key] ?? [];

              const lessonForm = {
                ...createEmptyLessonForm(),
                ...(lessonForms[key] ?? {}),
              };

              return (
                <article
                  className="curriculum-module-card"
                  key={key}
                >
                  <div className="curriculum-module-heading">
                    <span className="curriculum-number">
                      {index + 1}
                    </span>

                    <div>
                      <h3>
                        {module.title ??
                          `Module ${index + 1}`}
                      </h3>

                      <p>
                        {module.description ||
                          "No description provided"}
                      </p>
                    </div>

                    <span className="curriculum-count">
                      {lessons.length}{" "}
                      {lessons.length === 1
                        ? "lesson"
                        : "lessons"}
                    </span>
                    <Button
                      type="button"
                      variant="text"
                      className="curriculum-edit-module"
                      aria-label={`Edit ${module.title ?? `module ${index + 1}`}`}
                      title="Edit module"
                      onClick={() => handleEditModule(module)}
                      disabled={busy || submitting}
                      startIcon={<Pencil size={16} />}
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Existing lessons */}
                  <div className="curriculum-lessons">
                    {lessons.map((lesson, lessonIndex) => (
                      <div
                        className="curriculum-lesson-row"
                        key={
                          itemId(lesson) ?? lessonIndex
                        }
                      >
                        <CheckCircle2 size={17} />

                        <div>
                          <strong>
                            {lesson.title ??
                              `Lesson ${lessonIndex + 1}`}
                          </strong>

                          <span>
                            {lesson.lesson_type ??
                              lesson.content_type ??
                              "CONTENT"}

                            {lesson.duration_minutes != null
                              ? ` · ${lesson.duration_minutes} min`
                              : ""}
                          </span>

                          {(lesson.video_url ||
                            lesson.content_url) && (
                            <a
                              href={
                                lesson.video_url ??
                                lesson.content_url
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              View lesson content
                            </a>
                          )}
                        </div>
                      </div>
                    ))}

                    {lessons.length === 0 && (
                      <p className="curriculum-no-lessons">
                        No lessons added to this module yet.
                      </p>
                    )}
                  </div>

                  {/* Add lesson */}
                  <form
                    className="curriculum-lesson-form"
                    onSubmit={(event) =>
                      handleAddLesson(event, module)
                    }
                  >
                    <InputField
                      name={`title-${key}`}
                      label="Lesson title"
                      value={lessonForm.title}
                      onChange={(event) =>
                        updateLessonForm(
                          key,
                          "title",
                          event.target.value
                        )
                      }
                      required
                    />

                    <InputField
                      name={`content_type-${key}`}
                      label="Content type"
                      select
                      value={lessonForm.content_type}
                      onChange={(event) =>
                        updateLessonForm(
                          key,
                          "content_type",
                          event.target.value
                        )
                      }
                      options={[
                        { value: "VIDEO", label: "Video" },
                        { value: "ARTICLE", label: "Article" },
                        {
                          value: "DOCUMENT",
                          label: "Document",
                        },
                        { value: "QUIZ", label: "Quiz" },
                      ]}
                    />

                    {lessonForm.content_type === "VIDEO" ? (
                      <div className="curriculum-video-upload">
                        <label
                          htmlFor={`lessonVideo-${key}`}
                        >
                          <Video size={17} />
                          Upload lesson video
                        </label>

                        <input
                          id={`lessonVideo-${key}`}
                          name={`video-${key}`}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          onChange={(event) => {
                            const file =
                              event.target.files?.[0] ?? null;

                            handleVideoSelect(key, file);
                          }}
                        />

                        <p>
                          Accepted formats: MP4, WebM, MOV.
                          Maximum size: 100 MB.
                        </p>

                        {videoFiles[key] && (
                          <p className="curriculum-selected-file">
                            Selected: {videoFiles[key].name} (
                            {(
                              videoFiles[key].size /
                              (1024 * 1024)
                            ).toFixed(1)}{" "}
                            MB)
                          </p>
                        )}
                      </div>
                    ) : (
                      <InputField
                        name={`content_url-${key}`}
                        label="Content URL (optional)"
                        value={lessonForm.content_url}
                        onChange={(event) =>
                          updateLessonForm(
                            key,
                            "content_url",
                            event.target.value
                          )
                        }
                      />
                    )}

                    <InputField
                      name={`duration-${key}`}
                      label="Duration (minutes)"
                      type="number"
                      value={lessonForm.duration_minutes}
                      onChange={(event) =>
                        updateLessonForm(
                          key,
                          "duration_minutes",
                          event.target.value
                        )
                      }
                    />

                    <InputField
                      name={`description-${key}`}
                      label="Lesson description (optional)"
                      value={lessonForm.description}
                      onChange={(event) =>
                        updateLessonForm(
                          key,
                          "description",
                          event.target.value
                        )
                      }
                    />

                    <Button
                      type="submit"
                      loading={busy}
                      disabled={busy || submitting}
                      startIcon={<Plus size={16} />}
                    >
                      Add Lesson
                    </Button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
