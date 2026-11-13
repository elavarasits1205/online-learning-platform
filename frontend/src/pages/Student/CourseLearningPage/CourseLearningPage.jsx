import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import api from "../../../service/Api";
import { getAuthUser } from "../../../utils/authCookie";
import { calculateCourseProgress } from "../../../utils/courseProgress";
import LearnovaBackNavigation from "../../../component/LearnovaBackNavigation";
import "./CourseLearningPage.scss";

function getLessonResources(lesson) {
  const raw = lesson?.resources ?? lesson?.lesson_resources ?? lesson?.attachments ?? lesson?.materials ?? lesson?.lesson_materials ?? lesson?.resource_links ?? lesson?.resource_urls ?? lesson?.content?.resources;
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.map((resource, index) => {
    if (typeof resource === "string") {
      return { title: resource.split(/[\\/]/).pop() || `Resource ${index + 1}`, url: resource };
    }
    if (!resource || typeof resource !== "object") return null;
    return {
      title: resource.title ?? resource.name ?? resource.file_name ?? resource.label ?? `Resource ${index + 1}`,
      url: resource.url ?? resource.file_url ?? resource.resource_url ?? resource.download_url ?? resource.href,
      description: resource.description ?? resource.type ?? resource.mime_type,
    };
  }).filter((resource) => {
    const url = String(resource?.url ?? "");
    return url.startsWith("https://") || url.startsWith("http://") || (url.startsWith("/") && !url.startsWith("//"));
  });
}

function getLessonNoteStorageKey(courseId, lessonId) {
  const user = getAuthUser();
  const studentId =
    user?.id ??
    user?.user_id ??
    user?.userId ??
    user?.user?.id ??
    user?.user?.user_id ??
    user?.email ??
    user?.username ??
    "student";

  return ["olp", "lesson-note", studentId, courseId, lessonId]
    .map((part) => encodeURIComponent(String(part)))
    .join(":");
}

export default function CourseLearningPage() {
  const { courseId } = useParams();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [courseProgressSummary, setCourseProgressSummary] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assessmentLoading, setAssessmentLoading] = useState(true);

  const [error, setError] = useState("");
  const [assessmentError, setAssessmentError] = useState("");
  const [videoError, setVideoError] = useState(false);
  const [completingLesson, setCompletingLesson] = useState(false);
  const [progressError, setProgressError] = useState("");
  const lastProgressSentByLesson = useRef({});
  const [lessonNote, setLessonNote] = useState({ key: "", value: "" });
  const [noteSaveError, setNoteSaveError] = useState(false);
  const [noteSavedConfirmation, setNoteSavedConfirmation] = useState(false);

  // --------------------------------------------------
  // LOAD COURSE, MODULES AND LESSONS
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(
          `/student/learning/courses/${encodeURIComponent(courseId)}`,
        );

        const result = response.data?.data ?? response.data;
        const courseData = result?.course;

        const moduleData = Array.isArray(result?.modules) ? result.modules : [];

        if (!courseData) {
          throw new Error("Course details were not returned by the API.");
        }

        if (cancelled) return;

        setCourse(courseData);
        setModules(moduleData);
        setCourseProgressSummary(result?.course_progress ?? null);
        lastProgressSentByLesson.current = {};
        setProgressError("");

        const firstUnlockedModule = moduleData.find(
          (module) => module.is_unlocked === true,
        );

        setExpandedModules(
          firstUnlockedModule ? { [firstUnlockedModule.id]: true } : {},
        );

        const firstLesson = moduleData
          .filter((module) => module.is_unlocked === true)
          .flatMap((module) => module.lessons || [])
          .find(
            (lesson) => lesson.is_active !== false && lesson.is_locked !== true,
          );

        setSelectedLesson(firstLesson || null);
        setVideoError(false);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Unable to load this course.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (courseId) {
      loadCourse();
    }

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // --------------------------------------------------
  // LOAD AVAILABLE ASSESSMENTS FROM DATABASE API
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadAssessments() {
      setAssessmentLoading(true);
      setAssessmentError("");
      setAssessments([]);

      try {
        // Use the student assessment endpoint supported by the backend.
        const response = await api.get("/student/assessments");

        const result = response.data?.data ?? response.data;
        const availableAssessments = Array.isArray(result)
          ? result
          : Array.isArray(result?.assessments)
            ? result.assessments
            : [];
        const assessmentData = availableAssessments
          .filter(
            (assessment) => String(assessment.course_id) === String(courseId),
          )
          .map((assessment) => ({
            ...assessment,
            id: assessment.id ?? assessment.assessment_id,
          }));

        if (!cancelled) {
          setAssessments(assessmentData);
        }
      } catch (err) {
        if (!cancelled) {
          setAssessmentError(
            err.response?.data?.message ||
              "Unable to load assessments. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setAssessmentLoading(false);
        }
      }
    }

    if (courseId) {
      loadAssessments();
    }

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // --------------------------------------------------
  // DERIVED DATA
  // --------------------------------------------------

  const allLessons = useMemo(
    () => modules.flatMap((module) => module.lessons || []),
    [modules],
  );

  const progressData = useMemo(
    () =>
      calculateCourseProgress({
        modules,
        course_progress: courseProgressSummary,
      }),
    [modules, courseProgressSummary],
  );
  const {
    completedLessons,
    totalAssessments,
    completedAssessments,
    percentage: courseProgress,
  } = progressData;

  const selectedLessonCompleted =
    String(selectedLesson?.progress_status || "").toUpperCase() === "COMPLETED";

  const totalDuration = allLessons.reduce(
    (total, lesson) => total + Number(lesson.duration_minutes || 0),
    0,
  );

  const videoUrl = selectedLesson?.video_url?.trim() || "";
  const noteStorageKey = selectedLesson?.id
    ? getLessonNoteStorageKey(courseId, selectedLesson.id)
    : "";
  const currentNote = lessonNote.key === noteStorageKey ? lessonNote.value : "";
  const lessonResources = getLessonResources(selectedLesson);

  useEffect(() => {
    setNoteSavedConfirmation(false);

    if (!noteStorageKey) {
      setLessonNote({ key: "", value: "" });
      setNoteSaveError(false);
      return;
    }

    try {
      setLessonNote({
        key: noteStorageKey,
        value: window.localStorage.getItem(noteStorageKey) || "",
      });
      setNoteSaveError(false);
    } catch {
      setLessonNote({ key: noteStorageKey, value: "" });
      setNoteSaveError(true);
    }
  }, [noteStorageKey]);

  // Course-level assessments have no module_id.
  const courseAssessments = assessments.filter(
    (assessment) =>
      assessment.module_id === null || assessment.module_id === undefined,
  );

  // --------------------------------------------------
  // YOUTUBE URL CONVERSION
  // --------------------------------------------------

  const youtubeEmbedUrl = useMemo(() => {
    if (!videoUrl) return "";

    try {
      const url = new URL(videoUrl);
      let videoId = "";

      if (url.hostname === "youtu.be") {
        videoId = url.pathname.slice(1);
      } else if (
        url.hostname.includes("youtube.com") ||
        url.hostname.includes("youtube-nocookie.com")
      ) {
        if (url.pathname === "/watch") {
          videoId = url.searchParams.get("v") || "";
        } else if (url.pathname.startsWith("/embed/")) {
          videoId = url.pathname.split("/")[2] || "";
        } else if (url.pathname.startsWith("/shorts/")) {
          videoId = url.pathname.split("/")[2] || "";
        }
      }

      return videoId
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
            videoId,
          )}`
        : "";
    } catch {
      return "";
    }
  }, [videoUrl]);

  // --------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------

  const toggleModule = (moduleId) => {
    const targetModule = modules.find(
      (module) => String(module.id) === String(moduleId),
    );

    if (!targetModule || targetModule.is_unlocked !== true) {
      return;
    }

    setExpandedModules((previous) => ({
      ...previous,
      [moduleId]: !previous[moduleId],
    }));
  };

  const chooseLesson = (lesson) => {
    if (lesson.is_locked === true) {
      return;
    }

    setSelectedLesson(lesson);
    setVideoError(false);
    setProgressError("");
  };

  const handleLessonNoteChange = (event) => {
    const value = event.target.value;
    setLessonNote({ key: noteStorageKey, value });
    setNoteSavedConfirmation(false);

    if (!noteStorageKey) return;

    try {
      if (value) {
        window.localStorage.setItem(noteStorageKey, value);
      } else {
        window.localStorage.removeItem(noteStorageKey);
      }
      setNoteSaveError(false);
    } catch {
      setNoteSaveError(true);
    }
  };

  const handleSaveLessonNote = () => {
    if (!noteStorageKey || !selectedLesson) return;

    try {
      if (currentNote) {
        window.localStorage.setItem(noteStorageKey, currentNote);
      } else {
        window.localStorage.removeItem(noteStorageKey);
      }
      setNoteSaveError(false);
      setNoteSavedConfirmation(true);
    } catch {
      setNoteSaveError(true);
      setNoteSavedConfirmation(false);
    }
  };

  async function handleVideoProgress(event) {
    const lesson = selectedLesson;
    const duration = Number(event.currentTarget.duration);
    const currentTime = Number(event.currentTarget.currentTime);

    if (!lesson?.id || !Number.isFinite(duration) || duration <= 0) return;

    const progress = Math.min(99, Math.floor((currentTime / duration) * 100));
    if (progress <= 0) return;

    const lessonKey = String(lesson.id);
    const savedProgress = Number(lesson.lesson_progress_percentage ?? 0);
    const displayedProgress = Math.max(
      Number.isFinite(savedProgress) ? savedProgress : 0,
      progress,
    );

    // Reflect playback immediately; the API saves a checkpoint every 5%.
    setSelectedLesson((current) =>
      String(current?.id) === lessonKey
        ? {
            ...current,
            progress_status:
              String(current.progress_status || "").toUpperCase() ===
              "COMPLETED"
                ? "COMPLETED"
                : "IN_PROGRESS",
            lesson_progress_percentage: displayedProgress,
          }
        : current,
    );
    setModules((current) =>
      current.map((module) => ({
        ...module,
        lessons: (module.lessons || []).map((item) =>
          String(item.id) === lessonKey
            ? {
                ...item,
                progress_status:
                  String(item.progress_status || "").toUpperCase() ===
                  "COMPLETED"
                    ? "COMPLETED"
                    : "IN_PROGRESS",
                lesson_progress_percentage: Math.max(
                  Number(item.lesson_progress_percentage || 0),
                  displayedProgress,
                ),
              }
            : item,
        ),
      })),
    );

    const lastSent = Math.max(
      Number.isFinite(savedProgress) ? savedProgress : 0,
      Number(lastProgressSentByLesson.current[lessonKey] ?? 0),
    );
    if (progress - lastSent < 5) return;

    lastProgressSentByLesson.current[lessonKey] = progress;

    try {
      const response = await api.post(
        `/student/learning/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lesson.id)}/progress`,
        { progress_percentage: progress },
      );
      const result = response.data?.data ?? response.data;
      const lessonProgress = result?.lesson_progress ?? {};
      const savedPercentage = Number(
        lessonProgress.progress_percentage ?? progress,
      );
      const savedStatus = lessonProgress.status || "IN_PROGRESS";

      setSelectedLesson((current) =>
        String(current?.id) === lessonKey
          ? {
              ...current,
              progress_status:
                String(current.progress_status || "").toUpperCase() ===
                "COMPLETED"
                  ? "COMPLETED"
                  : savedStatus,
              lesson_progress_percentage: Math.max(
                Number(current.lesson_progress_percentage || 0),
                savedPercentage,
              ),
            }
          : current,
      );
      setModules((current) =>
        current.map((module) => ({
          ...module,
          lessons: (module.lessons || []).map((item) =>
            String(item.id) === lessonKey
              ? {
                  ...item,
                  progress_status:
                    String(item.progress_status || "").toUpperCase() ===
                    "COMPLETED"
                      ? "COMPLETED"
                      : savedStatus,
                  lesson_progress_percentage: Math.max(
                    Number(item.lesson_progress_percentage || 0),
                    savedPercentage,
                  ),
                }
              : item,
          ),
        })),
      );
      setProgressError("");
    } catch (err) {
      if (lastProgressSentByLesson.current[lessonKey] === progress) {
        lastProgressSentByLesson.current[lessonKey] = lastSent;
      }
      setProgressError(
        err.response?.data?.message ||
          "Unable to save video progress. Please try again.",
      );
    }
  }

  // Selected lesson-ah backend API moolama complete pannitu UI update pannum.
  async function handleMarkLessonComplete() {
    if (
      !selectedLesson ||
      String(selectedLesson.progress_status || "").toUpperCase() ===
        "COMPLETED" ||
      completingLesson
    ) {
      return;
    }

    setCompletingLesson(true);
    setProgressError("");

    try {
      const completionResponse = await api.post(
        `/student/learning/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(selectedLesson.id)}/complete`,
      );
      const completionResult =
        completionResponse.data?.data ?? completionResponse.data;

      lastProgressSentByLesson.current[String(selectedLesson.id)] = 100;

      // Reload the learning payload so module unlock decisions always come from the backend.
      const refreshedResponse = await api.get(
        `/student/learning/courses/${encodeURIComponent(courseId)}`,
      );

      const refreshedData =
        refreshedResponse.data?.data ?? refreshedResponse.data;
      const refreshedModules = Array.isArray(refreshedData?.modules)
        ? refreshedData.modules
        : [];
      const progressSnapshots = [
        completionResult?.course_progress,
        refreshedData?.course_progress,
      ].filter(Boolean);
      const latestCourseProgress = progressSnapshots.reduce(
        (latest, snapshot) =>
          !latest ||
          Number(snapshot.progress_percentage ?? 0) >=
            Number(latest.progress_percentage ?? 0)
            ? snapshot
            : latest,
        null,
      );

      setCourse(refreshedData?.course || course);
      setModules(refreshedModules);
      setCourseProgressSummary(latestCourseProgress);

      const refreshedSelectedLesson = refreshedModules
        .flatMap((module) => module.lessons || [])
        .find(
          (lesson) =>
            String(lesson.id) === String(selectedLesson.id) &&
            lesson.is_locked !== true,
        );

      if (refreshedSelectedLesson) {
        setSelectedLesson(refreshedSelectedLesson);
      }

      // Automatically expand a module that has just become unlocked.
      const newlyUnlockedModule = refreshedModules.find(
        (module) =>
          module.is_unlocked === true &&
          !modules.some(
            (previousModule) =>
              String(previousModule.id) === String(module.id) &&
              previousModule.is_unlocked === true,
          ),
      );

      if (newlyUnlockedModule) {
        setExpandedModules((previous) => ({
          ...previous,
          [newlyUnlockedModule.id]: true,
        }));
      }
    } catch (err) {
      setProgressError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update lesson progress. Please try again.",
      );
    } finally {
      setCompletingLesson(false);
    }
  }

  // --------------------------------------------------
  // LOADING AND ERROR STATES
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="clp-state student-page student-page--inset">
        <div className="clp-spinner" />
        <p>Loading course...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="clp-state student-page student-page--inset">
        <LearnovaBackNavigation
          to="/student/my-learning"
          brandTo="/student/dashboard"
          label="Back to My Learning"
        />
        <h2>Couldn&apos;t open this course</h2>
        <p>{error}</p>
      </main>
    );
  }

  // --------------------------------------------------
  // MAIN LEARNING PAGE
  // --------------------------------------------------

  return (
    <main className="clp-page student-page">
      <header className="clp-header">
        <LearnovaBackNavigation
          className="clp-header-navigation"
          to="/student/my-learning"
          brandTo="/student/dashboard"
          label="Back to My Learning"
        />

        <span className="clp-header-title">{course?.title || "Course"}</span>
      </header>

      <section
        className="clp-top-progress"
        aria-label="Course progress summary"
      >
        <div className="clp-course-progress">
          <div className="clp-course-progress-label">
            <strong>Your course progress</strong>
            <span>{courseProgress}%</span>
          </div>
          <div
            className="clp-progress-track"
            role="progressbar"
            aria-label="Course progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={courseProgress}
          >
            <span style={{ width: `${courseProgress}%` }} />
          </div>
          <small>
            {completedLessons} of {allLessons.length} lessons completed
            {totalAssessments > 0
              ? ` · ${completedAssessments} of ${totalAssessments} required assessments passed`
              : ""}
          </small>
          {String(courseProgressSummary?.status || "").toUpperCase() === "COMPLETED" && (
            <div className="clp-completion-notice" role="status">
              <strong>Course completed</strong>
              <span>Your course is now available in Completed Courses.</span>
              <Link to="/student/completed-courses">View completed courses</Link>
            </div>
          )}
        </div>
      </section>

      <div className="clp-layout">
        {/* LEFT: VIDEO PLAYER AND LESSON DETAILS */}

        <section className="clp-content">
          <div className="clp-player-shell">
            <div className="clp-player-topbar">
              <span className="clp-player-brand">
                <span className="clp-player-brand-mark" aria-hidden="true">
                  ▶
                </span>
                <span>Course player</span>
              </span>
              <span className="clp-player-context">
                {selectedLesson ? "Lesson video" : "Choose a lesson to begin"}
              </span>
            </div>
            <div className="clp-player">
              {videoUrl && !videoError ? (
                youtubeEmbedUrl ? (
                  <iframe
                    key={selectedLesson?.id}
                    src={`${youtubeEmbedUrl}?controls=1&rel=0&modestbranding=1`}
                    title={selectedLesson?.title || "Course lesson"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <video
                    key={selectedLesson?.id}
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    onTimeUpdate={handleVideoProgress}
                    onEnded={handleMarkLessonComplete}
                    onError={() => setVideoError(true)}
                  >
                    Your browser does not support video playback.
                  </video>
                )
              ) : (
                <div className="clp-player-empty">
                  <span className="clp-empty-play">▶</span>

                  <h2>
                    {videoError
                      ? "Video unavailable"
                      : selectedLesson?.title || "Start learning"}
                  </h2>

                  <p>
                    {videoError
                      ? "Check the video URL and its access permissions."
                      : selectedLesson
                        ? "No video is available for this lesson yet."
                        : "Choose a lesson from the course curriculum."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <section className="clp-lesson-info">
            <span className="clp-eyebrow">
              {selectedLesson ? "NOW PLAYING" : "COURSE"}
            </span>

            <h1>{selectedLesson?.title || course?.title}</h1>

            {selectedLesson?.description && <p>{selectedLesson.description}</p>}

            <div className="clp-meta">
              <span>{modules.length} modules</span>
              <span>{allLessons.length} lessons</span>

              {selectedLesson?.duration_minutes ? (
                <span>{selectedLesson.duration_minutes} min</span>
              ) : null}
            </div>

            <div className="clp-progress-actions">
              <button
                type="button"
                className={`clp-complete-button ${
                  selectedLessonCompleted ? "is-completed" : ""
                }`}
                onClick={handleMarkLessonComplete}
                disabled={
                  !selectedLesson || selectedLessonCompleted || completingLesson
                }
              >
                {completingLesson
                  ? "Saving..."
                  : selectedLessonCompleted
                    ? "✓ Lesson Completed"
                    : "Mark as Complete"}
              </button>

              {progressError && (
                <p className="clp-progress-error" role="alert">
                  {progressError}
                </p>
              )}
            </div>
          </section>

          <section className="clp-notes-card" aria-labelledby="clp-notes-title">
            <div className="clp-notes-heading">
              <span className="clp-notes-icon" aria-hidden="true">
                ✎
              </span>
              <div>
                <span className="clp-eyebrow">YOUR STUDY SPACE</span>
                <h2 id="clp-notes-title">Lesson notes</h2>
                <p>Capture ideas and reminders as you learn.</p>
              </div>
              <span
                className={`clp-notes-save-state ${noteSaveError ? "is-error" : ""}`}
              >
                <span aria-hidden="true">{noteSaveError ? "!" : "✓"}</span>
                {noteSaveError
                  ? "Could not save"
                  : noteSavedConfirmation
                    ? "Saved on this device"
                    : selectedLesson
                      ? "Auto-saves on this device"
                      : "Select a lesson"}
              </span>
            </div>
            <label className="clp-notes-label" htmlFor="clp-lesson-notes">
              {selectedLesson
                ? `Notes for ${selectedLesson.title}`
                : "Choose a lesson to start taking notes"}
            </label>
            <textarea
              id="clp-lesson-notes"
              className="clp-notes-input"
              value={currentNote}
              onChange={handleLessonNoteChange}
              disabled={!selectedLesson}
              maxLength={10000}
              placeholder={
                selectedLesson
                  ? "Write a note, key takeaway, or question…"
                  : "Select a lesson from the curriculum to take notes."
              }
              rows={5}
            />
            <div className="clp-notes-footer">
              <span>
                Notes are stored in this browser for your account and lesson.
              </span>
              <div className="clp-notes-footer-actions">
                <span>{currentNote.length}/10,000</span>
                <button
                  type="button"
                  className="clp-notes-save-button"
                  onClick={handleSaveLessonNote}
                  disabled={!selectedLesson}
                >
                  {noteSavedConfirmation ? "Saved" : "Save note"}
                </button>
              </div>
            </div>
          </section>

          {selectedLesson?.content && (
            <section className="clp-description">
              <h2>Lesson details</h2>
              <p>{selectedLesson.content}</p>
            </section>
          )}

          {lessonResources.length > 0 && (
            <section className="clp-resources" aria-labelledby="clp-resources-title">
              <div>
                <span className="clp-eyebrow">KEEP FOR LATER</span>
                <h2 id="clp-resources-title">Lesson resources</h2>
                <p>Files and links shared for this lesson.</p>
              </div>
              <ul>
                {lessonResources.map((resource, index) => (
                  <li key={`${resource.url}-${index}`}>
                    <a href={resource.url} target="_blank" rel="noreferrer">
                      <span aria-hidden="true">↗</span>
                      <span><strong>{resource.title}</strong>{resource.description && <small>{resource.description}</small>}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* COURSE-LEVEL ASSESSMENTS */}

          <section className="clp-assessment-section">
            <div className="clp-assessment-heading">
              <div>
                <span className="clp-eyebrow">TEST YOUR KNOWLEDGE</span>
                <h2>Course Assessments</h2>
                <p>Assessments for the complete course.</p>
              </div>

              <span className="clp-assessment-count">
                {assessmentLoading
                  ? "Loading..."
                  : `${courseAssessments.length} available`}
              </span>
            </div>

            {assessmentError ? (
              <div className="clp-assessment-empty clp-assessment-error">
                <h3>Unable to load assessments</h3>
                <p>{assessmentError}</p>
              </div>
            ) : assessmentLoading ? (
              <div className="clp-assessment-empty">
                <div className="clp-spinner" />
                <p>Loading assessments...</p>
              </div>
            ) : courseAssessments.length > 0 ? (
              <div className="clp-assessment-list">
                {courseAssessments.map((assessment) => (
                  <AssessmentCard
                    key={assessment.id}
                    assessment={assessment}
                    courseId={courseId}
                  />
                ))}
              </div>
            ) : (
              <div className="clp-assessment-empty">
                <span className="clp-assessment-icon" aria-hidden="true">
                  A
                </span>
                <h3>No course assessments available yet</h3>
                <p>
                  Course assessments will appear here when they are published.
                </p>
              </div>
            )}
          </section>
        </section>

        {/* RIGHT: COURSE CURRICULUM */}

        <aside className="clp-curriculum">
          <div className="clp-curriculum-heading">
            <div>
              <h2>Course content</h2>
              <p>
                {modules.length} modules · {allLessons.length} lessons
              </p>
            </div>
          </div>

          {modules.length === 0 ? (
            <div className="clp-empty-curriculum">
              <span>▤</span>
              <h3>No lessons yet</h3>
              <p>Course content will appear here when it is added.</p>
            </div>
          ) : (
            <div className="clp-module-list">
              {modules.map((module, index) => {
                const expanded = Boolean(expandedModules[module.id]);
                const lessons = module.lessons || [];
                const moduleCompleted = module.is_completed === true;
                const moduleUnlocked = module.is_unlocked === true;

                const moduleAssessments = assessments.filter(
                  (assessment) =>
                    assessment.module_id !== null &&
                    assessment.module_id !== undefined &&
                    String(assessment.module_id) === String(module.id),
                );

                return (
                  <section className="clp-module" key={module.id}>
                    <button
                      type="button"
                      className={`clp-module-toggle ${
                        !moduleUnlocked ? "is-locked" : ""
                      }`}
                      onClick={() => toggleModule(module.id)}
                      aria-expanded={expanded}
                      disabled={!moduleUnlocked}
                    >
                      <span className="clp-module-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <span className="clp-module-title">
                        <strong>{module.title}</strong>
                        <small>
                          {lessons.length}{" "}
                          {lessons.length === 1 ? "lesson" : "lessons"}
                        </small>
                        {!moduleUnlocked && (
                          <small
                            className="clp-locked-reason"
                            title={
                              module.locked_reason ||
                              "Complete the previous module to unlock this module."
                            }
                          >
                            Locked ·{" "}
                            {module.locked_reason ||
                              "Complete the previous module to unlock this module."}
                          </small>
                        )}
                      </span>

                      {moduleCompleted && (
                        <span
                          className="clp-module-completed"
                          aria-label="Module completed"
                          title="Module completed"
                        >
                          <CheckRoundedIcon aria-hidden="true" />
                        </span>
                      )}

                      <span
                        className={`clp-chevron ${
                          !moduleUnlocked ? "is-locked" : ""
                        } ${expanded ? "is-expanded" : ""}`}
                        aria-hidden="true"
                      />
                    </button>

                    {expanded && (
                      <div className="clp-module-body">
                        {/* LESSONS */}

                        <div className="clp-lesson-list">
                          {lessons.length === 0 ? (
                            <p className="clp-no-lessons">
                              No lessons in this module.
                            </p>
                          ) : (
                            lessons.map((lesson, lessonIndex) => {
                              const active =
                                String(selectedLesson?.id) ===
                                String(lesson.id);
                              const completed =
                                String(
                                  lesson.progress_status || "",
                                ).toUpperCase() === "COMPLETED";

                              return (
                                <button
                                  type="button"
                                  key={lesson.id}
                                  className={`clp-lesson ${
                                    active ? "is-active" : ""
                                  } ${lesson.is_locked ? "is-locked" : ""}`}
                                  onClick={() => chooseLesson(lesson)}
                                  disabled={lesson.is_locked === true}
                                >
                                  <span
                                    className={`clp-lesson-icon ${
                                      completed ? "is-completed" : ""
                                    } ${active ? "is-active" : ""} ${
                                      lesson.is_locked ? "is-locked" : ""
                                    }`}
                                    aria-label={
                                      lesson.is_locked
                                        ? "Lesson locked"
                                        : completed
                                          ? "Lesson completed"
                                          : "Lesson not completed"
                                    }
                                  >
                                    {completed && (
                                      <CheckRoundedIcon aria-hidden="true" />
                                    )}
                                  </span>

                                  <span className="clp-lesson-text">
                                    <strong>{lesson.title}</strong>
                                    <small>
                                      {lesson.duration_minutes
                                        ? `${lesson.duration_minutes} min`
                                        : `Lesson ${lessonIndex + 1}`}
                                    </small>
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* MODULE ASSESSMENTS */}

                        <div className="clp-module-assessments">
                          <div className="clp-module-assessment-heading">
                            <span
                              className="clp-assessment-icon"
                              aria-hidden="true"
                            >
                              A
                            </span>
                            <strong>Module Assessment</strong>
                          </div>

                          {assessmentError ? (
                            <p className="clp-no-assessments">
                              Assessments could not be loaded.
                            </p>
                          ) : assessmentLoading ? (
                            <p className="clp-no-assessments">
                              Loading assessments...
                            </p>
                          ) : !moduleUnlocked ? (
                            <p className="clp-no-assessments">
                              Unlock this module to access its assessments.
                            </p>
                          ) : moduleAssessments.length > 0 ? (
                            <div className="clp-assessment-list">
                              {moduleAssessments.map((assessment) => (
                                <AssessmentCard
                                  key={assessment.id}
                                  assessment={assessment}
                                  courseId={courseId}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="clp-no-assessments">
                              No assessments available yet.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {totalDuration > 0 && (
            <div className="clp-total-duration">
              Total course duration
              <strong>
                {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
              </strong>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

// --------------------------------------------------
// REUSABLE ASSESSMENT CARD
// --------------------------------------------------

function AssessmentCard({ assessment, courseId }) {
  const questionCount = Number(assessment.question_count || 0);
  const totalMarks = Number(assessment.total_marks || 0);
  const duration = assessment.duration_minutes;
  const latestStatus = String(assessment.latest_status ?? "").toUpperCase();
  const hasPassed =
    assessment.has_passed === true ||
    String(assessment.has_passed).toLowerCase() === "true" ||
    (latestStatus === "EVALUATED" &&
      (assessment.latest_passed === true ||
        String(assessment.latest_passed).toLowerCase() === "true"));
  const resultLabel = hasPassed
    ? "Passed"
    : latestStatus === "SUBMITTED"
      ? "Result pending"
      : latestStatus === "IN_PROGRESS"
        ? "In progress"
        : latestStatus === "EVALUATED"
          ? "Not passed"
          : "Not started";
  const resultIcon = hasPassed
    ? "✓"
    : latestStatus === "EVALUATED"
      ? "×"
      : latestStatus === "SUBMITTED"
        ? "…"
        : "•";

  return (
    <article className="clp-assessment-card">
      <div
        className={`clp-assessment-card-icon ${hasPassed ? "is-completed" : latestStatus === "EVALUATED" ? "is-failed" : ""}`}
        role="img"
        aria-label={resultLabel}
        title={resultLabel}
      >
        <span>{resultIcon}</span>
      </div>

      <div className="clp-assessment-card-content">
        <div className="clp-assessment-title-row">
          <h3>{assessment.title}</h3>
          <span
            className={`clp-assessment-status ${hasPassed ? "is-passed" : latestStatus === "EVALUATED" ? "is-failed" : ""}`}
          >
            {resultLabel}
          </span>
        </div>

        {assessment.description && (
          <p className="clp-assessment-description">{assessment.description}</p>
        )}

        <div className="clp-assessment-meta">
          {questionCount > 0 && (
            <span>
              {questionCount} {questionCount === 1 ? "question" : "questions"}
            </span>
          )}

          <span>{totalMarks} marks</span>

          {duration != null && <span>{duration} minutes</span>}
        </div>

        {assessment.instructions && (
          <p className="clp-assessment-instructions">
            {assessment.instructions}
          </p>
        )}

        <Link
          className="clp-assessment-button"
          to={`/student/learning/${encodeURIComponent(courseId)}/assessments/${encodeURIComponent(assessment.id)}`}
        >
          View Assessment <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
