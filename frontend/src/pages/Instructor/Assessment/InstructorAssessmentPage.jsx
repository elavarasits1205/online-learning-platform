
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import PublishRoundedIcon from "@mui/icons-material/PublishRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";

import {
  instructorAssessmentApi,
  unwrapAssessmentResponse,
  getAssessmentError,
} from "../../../service/AssessmentApi";

import { instructorApi } from "../../../service/InstructorApi";
import "./Assessment.scss";

const initialForm = {
  course_id: "",
  module_id: "",
  title: "",
  description: "",
  assessment_type: "COURSE",
  instructions: "",
  duration_minutes: 30,
  pass_percentage: 40,
  max_attempts: 1,
  passing_required: true,
};

function rowsFrom(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.assessments)) return value.assessments;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;

  return [];
}

function idOf(item) {
  return item?.id ?? item?.assessment_id ?? item?.assessmentId;
}

function statusColor(status) {
  if (status === "PUBLISHED") return "success";
  if (status === "CLOSED" || status === "ARCHIVED") return "warning";

  return "default";
}

export default function InstructorAssessmentsPage() {
  const [assessments, setAssessments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);

  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Load instructor assessments.
  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await instructorAssessmentApi.list();
      const data = unwrapAssessmentResponse(response);

      setAssessments(rowsFrom(data));
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load assessments when the page opens.
  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  // Load courses assigned to the instructor.
  useEffect(() => {
    let active = true;

    async function loadCourses() {
      try {
        const response = await instructorApi.getMyCourses();
        const data = unwrapAssessmentResponse(response);

        if (active) {
          setCourses(
            Array.isArray(data)
              ? data
              : data?.courses || data?.items || []
          );
        }
      } catch {
        if (active) {
          setCourses([]);
        }
      }
    }

    loadCourses();

    return () => {
      active = false;
    };
  }, []);

  // Load modules whenever the selected course changes.
  useEffect(() => {
    let active = true;

    async function loadModules() {
      if (!form.course_id) {
        setModules([]);
        setModulesLoading(false);
        return;
      }

      setModulesLoading(true);

      try {
        const response = await instructorApi.getModules(form.course_id);
        const data = unwrapAssessmentResponse(response);

        if (active) {
          setModules(
            Array.isArray(data)
              ? data
              : data?.modules || data?.items || []
          );
        }
      } catch {
        if (active) {
          setModules([]);
        }
      } finally {
        if (active) {
          setModulesLoading(false);
        }
      }
    }

    loadModules();

    return () => {
      active = false;
    };
  }, [form.course_id]);

  // Assessment statistics.
  const stats = useMemo(
    () => ({
      total: assessments.length,
      published: assessments.filter(
        (assessment) =>
          String(assessment.status || "").toUpperCase() === "PUBLISHED"
      ).length,
      drafts: assessments.filter(
        (assessment) =>
          String(assessment.status || "").toUpperCase() === "DRAFT"
      ).length,
    }),
    [assessments]
  );

  // Handle normal form fields.
  const change = (key) => (event) => {
    setForm((prev) => ({
      ...prev,
      [key]: event.target.value,
    }));
  };

  // Handle course selection.
  function changeCourse(event) {
    setForm((prev) => ({
      ...prev,
      course_id: event.target.value,
      module_id: "",
    }));
  }

  // Handle assessment type selection.
  function changeType(event) {
    const value = event.target.value;

    setForm((prev) => ({
      ...prev,
      assessment_type: value,
      module_id: value === "COURSE" ? "" : prev.module_id,
    }));
  }

  // Create a new assessment.
  async function createAssessment(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (!form.course_id) {
        throw new Error("Select a course.");
      }

      if (form.assessment_type === "MODULE" && !form.module_id) {
        throw new Error("Select a module for a module assessment.");
      }

      const payload = {
        ...form,
        course_id: Number(form.course_id),

        module_id:
          form.assessment_type === "MODULE" && form.module_id
            ? Number(form.module_id)
            : null,

        duration_minutes:
          form.duration_minutes === ""
            ? null
            : Number(form.duration_minutes),

        pass_percentage: Number(form.pass_percentage),

        max_attempts:
          form.max_attempts === ""
            ? null
            : Number(form.max_attempts),

        passing_required: Boolean(form.passing_required),
      };

      const response = await instructorAssessmentApi.create(payload);
      const created = unwrapAssessmentResponse(response);

      setNotice(
        "Assessment created. Open it below to add questions and publish."
      );

      setForm(initialForm);
      await loadAssessments();

      const newId = idOf(created);

      if (newId) {
        setNotice(
          `Assessment #${newId} created successfully. Add questions from its workspace.`
        );
      }
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setSaving(false);
    }
  }

  // Publish an assessment.
  async function publishAssessment(id) {
    const confirmed = window.confirm(
      "Publish this assessment? Students may be able to access it immediately."
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await instructorAssessmentApi.publish(id);

      setNotice("Assessment published successfully.");

      await loadAssessments();
    } catch (err) {
      setError(getAssessmentError(err));
    }
  }

  return (
    <Box className="assessment-page">
      {/* Page heading */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Assessments
          </Typography>

          <Typography color="text.secondary">
            Create assessments, manage questions, grade answers and publish
            final results.
          </Typography>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {notice && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}

      {/* Assessment statistics */}
      <Grid container spacing={2} mb={3}>
        {[
          ["Total assessments", stats.total, "All your assessments"],
          ["Published", stats.published, "Visible to eligible students"],
          ["Drafts", stats.drafts, "Not published yet"],
        ].map(([label, value, helper]) => (
          <Grid item xs={12} sm={4} key={label}>
            <Card className="assessment-stat">
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  {label}
                </Typography>

                <Typography variant="h4" fontWeight={800}>
                  {value}
                </Typography>

                <Typography color="text.secondary" variant="caption">
                  {helper}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create assessment form */}
      <Card className="assessment-panel">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <AddRoundedIcon color="primary" />

            <Typography variant="h6" fontWeight={800}>
              Create assessment
            </Typography>
          </Stack>

          <Box component="form" onSubmit={createAssessment}>
            <Grid container spacing={2}>
              {/* Course selection */}
              <Grid item xs={12} md={6}>
                {courses.length > 0 ? (
                  <TextField
                    select
                    fullWidth
                    label="Course"
                    value={form.course_id}
                    onChange={changeCourse}
                    required
                  >
                    {courses.map((course) => {
                      const courseId = course.id ?? course.course_id;

                      return (
                        <MenuItem key={courseId} value={courseId}>
                          {course.title ??
                            course.course_name ??
                            `Course #${courseId}`}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                ) : (
                  <TextField
                    fullWidth
                    type="number"
                    label="Course ID"
                    value={form.course_id}
                    onChange={changeCourse}
                    required
                    helperText="Your course list could not be loaded; enter an existing course ID."
                  />
                )}
              </Grid>

              {/* Assessment type */}
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Assessment type"
                  value={form.assessment_type}
                  onChange={changeType}
                >
                  <MenuItem value="COURSE">
                    COURSE (final assessment)
                  </MenuItem>

                  <MenuItem value="MODULE">MODULE</MenuItem>
                </TextField>
              </Grid>

              {/* Module selection */}
              {form.assessment_type === "MODULE" && (
                <Grid item xs={12} md={6}>
                  {modules.length > 0 ? (
                    <TextField
                      select
                      fullWidth
                      label="Module"
                      value={form.module_id}
                      onChange={change("module_id")}
                      required
                    >
                      {modules.map((module) => {
                        const moduleId = module.id ?? module.module_id;

                        return (
                          <MenuItem key={moduleId} value={moduleId}>
                            {module.title ?? `Module #${moduleId}`}
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  ) : (
                    <TextField
                      fullWidth
                      type="number"
                      label="Module ID"
                      value={form.module_id}
                      onChange={change("module_id")}
                      required
                      disabled={modulesLoading}
                      helperText={
                        modulesLoading
                          ? "Loading modules..."
                          : "Select the course first or enter an existing module ID."
                      }
                    />
                  )}
                </Grid>
              )}

              {/* Assessment title */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Assessment title"
                  value={form.title}
                  onChange={change("title")}
                  required
                />
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Description"
                  value={form.description}
                  onChange={change("description")}
                />
              </Grid>

              {/* Instructions */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Instructions"
                  value={form.instructions}
                  onChange={change("instructions")}
                />
              </Grid>

              {/* Duration */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Duration (minutes)"
                  value={form.duration_minutes}
                  onChange={change("duration_minutes")}
                  inputProps={{ min: 1 }}
                />
              </Grid>

              {/* Pass percentage */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Pass percentage"
                  value={form.pass_percentage}
                  onChange={change("pass_percentage")}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>

              {/* Maximum attempts */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maximum attempts"
                  value={form.max_attempts}
                  onChange={change("max_attempts")}
                  inputProps={{ min: 1 }}
                  helperText="Leave empty for unlimited attempts"
                />
              </Grid>

              {/* Certificate requirement */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.passing_required}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          passing_required: event.target.checked,
                        }))
                      }
                    />
                  }
                  label="Passing is required before the course certificate is issued"
                />
              </Grid>

              {/* Submit button */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || !form.course_id}
                  startIcon={
                    saving ? (
                      <CircularProgress size={18} />
                    ) : (
                      <AddRoundedIcon />
                    )
                  }
                >
                  {saving ? "Creating..." : "Create draft assessment"}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Assessment list heading */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mt={4}
        mb={2}
      >
        <Typography variant="h6" fontWeight={800}>
          Your assessments
        </Typography>

        <Button onClick={loadAssessments} size="small">
          Refresh
        </Button>
      </Stack>

      {/* Assessment list */}
      {loading ? (
        <Box className="assessment-loading">
          <CircularProgress />
        </Box>
      ) : assessments.length === 0 ? (
        <Alert severity="info">
          No assessments found. Create your first assessment above.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {assessments.map((assessment, index) => {
            const id = idOf(assessment);
            const status = String(
              assessment.status || "DRAFT"
            ).toUpperCase();

            return (
              <Grid item xs={12} md={6} key={id ?? index}>
                <Card className="assessment-card">
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={1}
                    >
                      <Box>
                        <Typography variant="h6" fontWeight={800}>
                          {assessment.title || `Assessment #${id}`}
                        </Typography>

                        <Typography color="text.secondary" variant="body2">
                          {assessment.course_title ||
                            assessment.course_name ||
                            `Course ID: ${assessment.course_id ?? "—"}`}
                        </Typography>

                        {assessment.module_title && (
                          <Typography
                            color="text.secondary"
                            variant="caption"
                          >
                            Module: {assessment.module_title}
                          </Typography>
                        )}
                      </Box>

                      <Chip
                        size="small"
                        label={status}
                        color={statusColor(status)}
                      />
                    </Stack>

                    <Typography
                      color="text.secondary"
                      variant="body2"
                      mt={1}
                    >
                      {assessment.description || "No description added."}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        size="small"
                        label={`${assessment.question_count ?? 0} questions`}
                      />

                      <Chip
                        size="small"
                        label={`${assessment.total_marks ?? 0} marks`}
                      />

                      <Chip
                        size="small"
                        label={`${assessment.duration_minutes ?? "—"} min`}
                      />

                      <Chip
                        size="small"
                        label={`Pass ${assessment.pass_percentage ?? "—"}%`}
                      />

                      <Chip
                        size="small"
                        label={`${assessment.max_attempts ?? "Unlimited"} attempts`}
                      />

                      <Chip
                        size="small"
                        label={`${assessment.attempt_count ?? 0} taken`}
                      />

                      <Chip
                        size="small"
                        label={assessment.assessment_type || "ASSESSMENT"}
                      />
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={1}
                      mt={2}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Button
                        size="small"
                        component={Link}
                        to={`/instructor/assessments/${id}/manage`}
                        startIcon={<VisibilityRoundedIcon />}
                        disabled={!id}
                      >
                        Manage questions
                      </Button>

                      <Button
                        size="small"
                        component={Link}
                        to={`/instructor/assessments/${id}/results`}
                        startIcon={<AssessmentRoundedIcon />}
                        disabled={!id}
                      >
                        Results & grading
                      </Button>

                      {status === "DRAFT" && id && (
                        <Button
                          size="small"
                          color="success"
                          onClick={() => publishAssessment(id)}
                          startIcon={<PublishRoundedIcon />}
                        >
                          Publish
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
