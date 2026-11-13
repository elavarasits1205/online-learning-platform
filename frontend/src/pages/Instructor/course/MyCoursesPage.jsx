
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import instructorApi from "../../../service/InstructorApi";

import Button from "../../../component/buttons/Button";
import InputField from "../../../component/fields/InputField";
import DataTable from "../../../component/tables/DataTable";

import "./InstructorCourses.scss";

function normalizeCourses(response) {
  const body = response?.data ?? response;

  const payload = body?.data ?? body;
  const list = Array.isArray(payload)
    ? payload
    : payload?.courses ??
      payload?.items ??
      payload?.results ??
      body?.courses ??
      body?.items ??
      [];

  return Array.isArray(list) ? list : [];
}

function getCourseId(course) {
  return course?.id ?? course?.course_id ?? course?.courseId;
}

function getStatus(course) {
  return String(
    course.approval_status ?? course.status ?? "draft"
  ).toLowerCase();
}

function getStatusColor(status) {
  if (["published", "approved"].includes(status)) return "success";
  if (["pending", "submitted", "in_review"].includes(status)) {
    return "warning";
  }
  if (status === "rejected") return "error";
  return "default";
}

function formatStatus(status) {
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MyCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

 const loadCourses = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const response = await instructorApi.getMyCourses();
    setCourses(normalizeCourses(response));
  } catch (err) {
    setError(
      err.response?.data?.message ??
        err.message ??
        "Unable to load your courses."
    );
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return courses;

    return courses.filter((course) => {
      const title = String(course.title ?? "").toLowerCase();
      const code = String(course.course_code ?? "").toLowerCase();
      const description = String(course.description ?? "").toLowerCase();

      return (
        title.includes(query) ||
        code.includes(query) ||
        description.includes(query)
      );
    });
  }, [courses, search]);

  async function handleSubmitCourse(course) {
    const id = getCourseId(course);

    if (id == null) {
      setActionError("This course has no valid ID.");
      return;
    }

    const status = getStatus(course);

    if (["pending", "submitted", "in_review", "published", "approved"].includes(status)) {
      setActionError("This course has already been submitted or approved.");
      return;
    }

    if (!window.confirm(`Submit "${course.title}" for review?`)) {
      return;
    }

    setActionLoading(id);
    setActionError("");

    try {
      await instructorApi.submitCourse(id);
      await loadCourses();
    } catch (err) {
      setActionError(
        err.response?.data?.message ??
          err.message ??
          "Unable to submit the course."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteCourse(course) {
    const id = getCourseId(course);

    if (id == null) {
      setActionError("This course has no valid ID.");
      return;
    }

    if (!window.confirm(`Delete "${course.title}"? This may not be reversible.`)) {
      return;
    }

    setActionLoading(id);
    setActionError("");

    try {
      await instructorApi.deleteCourse(id);
      await loadCourses();
    } catch (err) {
      setActionError(
        err.response?.data?.message ??
          err.message ??
          "Unable to delete the course."
      );
    } finally {
      setActionLoading(null);
    }
  }

  const columns = useMemo(
    () => [
      {
        id: "title",
        label: "Course",
        minWidth: 190,
        render: (value, course) => (
          <Box className="course-title-cell">
            <Typography variant="body2" fontWeight={700}>
              {value || "Untitled course"}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              className="course-description"
            >
              {course.description || "No description added"}
            </Typography>
          </Box>
        ),
      },
      {
        id: "course_code",
        label: "Course Code",
        render: (value) => value || "—",
      },
      {
        id: "status",
        label: "Status",
        render: (_value, course) => {
          const status = getStatus(course);

          return (
            <Chip
              size="small"
              label={formatStatus(status)}
              color={getStatusColor(status)}
              variant="outlined"
            />
          );
        },
      },
      {
        id: "manage",
        label: "Manage",
        minWidth: 300,
        exportable: false,
        searchable: false,
        render: (_value, course) => {
          const id = getCourseId(course);
          const busy = actionLoading === id;
          const status = getStatus(course);

          if (id == null) return "Unavailable";

          return (
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              className="course-actions"
            >
              <Button
                component={Link}
                to={`/instructor/courses/${id}/edit`}
                variant="outlined"
                size="small"
                disabled={busy}
              >
                Edit
              </Button>

              <Button
                component={Link}
                to={`/instructor/courses/${id}/curriculum`}
                variant="outlined"
                size="small"
                disabled={busy}
              >
                Curriculum
              </Button>

              {![
                "pending",
                "submitted",
                "in_review",
                "published",
                "approved",
              ].includes(status) && (
                <Button
                  size="small"
                  loading={busy}
                  disabled={actionLoading !== null && !busy}
                  onClick={() => handleSubmitCourse(course)}
                >
                  Submit
                </Button>
              )}

              <Button
                size="small"
                color="error"
                variant="text"
                loading={busy}
                disabled={actionLoading !== null && !busy}
                onClick={() => handleDeleteCourse(course)}
              >
                Delete
              </Button>
            </Stack>
          );
        },
      },
    ],
    [actionLoading]
  );

  return (
    <section className="instructor-courses">
      <header className="instructor-courses__heading">
        <div>
          <span className="instructor-courses__eyebrow">
            LEARNOVA INSTRUCTOR PORTAL
          </span>

          <Typography component="h1" variant="h4" fontWeight={800}>
            My Courses
          </Typography>

          <Typography color="text.secondary">
            Create, organize, and manage your learning content.
          </Typography>
        </div>

        <Stack direction="row" spacing={1}>
          <Button
            component={Link}
            to="/instructor/dashboard"
            variant="outlined"
          >
            Dashboard
          </Button>

          <Button
            component={Link}
            to="/instructor/courses/create"
            variant="contained"
          >
            + Create Course
          </Button>
        </Stack>
      </header>

      <div className="instructor-courses__summary">
        <div className="course-summary-card">
          <span>Total Courses</span>
          <strong>{loading ? "—" : courses.length}</strong>
        </div>

        <div className="course-summary-card">
          <span>Drafts</span>
          <strong>
            {loading
              ? "—"
              : courses.filter((course) => getStatus(course) === "draft").length}
          </strong>
        </div>

        <div className="course-summary-card">
          <span>Published</span>
          <strong>
            {loading
              ? "—"
              : courses.filter((course) =>
                  ["published", "approved"].includes(getStatus(course))
                ).length}
          </strong>
        </div>
      </div>

      {error && (
        <Alert
          severity="error"
          className="instructor-courses__alert"
          action={
            <Button size="small" onClick={loadCourses}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {actionError && (
        <Alert
          severity="error"
          onClose={() => setActionError("")}
          className="instructor-courses__alert"
        >
          {actionError}
        </Alert>
      )}

      <section className="instructor-courses__panel">
        <div className="instructor-courses__toolbar">
          <div>
            <Typography variant="h6" fontWeight={700}>
              Course Library
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {loading
                ? "Loading your courses..."
                : `${filteredCourses.length} course(s) found`}
            </Typography>
          </div>

          <div className="instructor-courses__search">
            <InputField
              name="courseSearch"
              label="Search courses"
              placeholder="Search title, code or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              size="small"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filteredCourses}
          loading={loading}
          emptyMessage={
            search
              ? "No courses match your search."
              : "You haven't created any courses yet."
          }
          getRowId={(course) =>
            getCourseId(course) ?? course.title
          }
          actions={false}
          pagination
          initialRowsPerPage={4}
          rowsPerPageOptions={[4]}
          minWidth={850}
        />

        {!loading && !error && courses.length === 0 && (
          <div className="instructor-courses__empty">
            <Typography variant="h6" fontWeight={700}>
              Start creating your first course
            </Typography>

            <Typography color="text.secondary">
              Add your course details, then organize the curriculum into
              modules and lessons.
            </Typography>

            <Button
              component={Link}
              to="/instructor/courses/create"
              variant="contained"
            >
              Create Your First Course
            </Button>
          </div>
        )}
      </section>
    </section>
  );
}
