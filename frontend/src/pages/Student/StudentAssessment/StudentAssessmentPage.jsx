import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import {
  studentAssessmentApi,
  unwrapAssessmentResponse,
  getAssessmentError,
} from "../../../service/AssessmentApi";
import "../../Instructor/Assessment/Assessment.scss";

function getRows(value) {
  if (Array.isArray(value)) return value;
  return value?.assessments || value?.items || value?.results || [];
}

function statusChip(item) {
  const latest = String(item.latest_status || "").toUpperCase();
  const hasPassed =
    item.has_passed === true ||
    String(item.has_passed).toLowerCase() === "true" ||
    (latest === "EVALUATED" &&
      (item.latest_passed === true ||
        String(item.latest_passed).toLowerCase() === "true"));
  if (hasPassed) return <Chip size="small" color="success" label="Passed" />;
  if (latest === "EVALUATED") {
    return <Chip size="small" color="error" label="Failed" />;
  }
  if (latest === "SUBMITTED")
    return <Chip size="small" color="warning" label="Awaiting grading" />;
  if (latest === "IN_PROGRESS")
    return <Chip size="small" color="info" label="In progress" />;
  if (item.certificate_id)
    return <Chip size="small" color="success" label="Certificate issued" />;
  return <Chip size="small" label="Not started" />;
}

export default function StudentAssessmentsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timerId;

    async function loadAssessments() {
      try {
        const response = await studentAssessmentApi.list();
        const rows = getRows(unwrapAssessmentResponse(response));
        if (!active) return;

        setItems(rows);
        setError("");

        if (
          rows.some(
            (row) =>
              String(row.latest_status || "").toUpperCase() === "SUBMITTED",
          )
        ) {
          timerId = window.setTimeout(loadAssessments, 5000);
        }
      } catch (err) {
        if (active) setError(getAssessmentError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAssessments();

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const key = item.course_id ?? item.course_title ?? "course";
      if (!map.has(key)) {
        map.set(key, {
          course_title: item.course_title || `Course #${item.course_id}`,
          items: [],
        });
      }
      map.get(key).items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  if (loading)
    return (
      <Box className="assessment-loading student-page student-page--inset">
        <CircularProgress />
      </Box>
    );

  return (
    <Box className="assessment-page student-page student-page--inset">
      <Typography variant="h4" fontWeight={800}>
        Assessments
      </Typography>
      <Typography color="text.secondary" mb={3}>
        Assessments are grouped by course. Track attempts, scores and
        certificates here.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {grouped.length === 0 ? (
        <Alert severity="info">No assessments are currently available.</Alert>
      ) : (
        <Stack spacing={3}>
          {grouped.map((group) => (
            <Box key={group.course_title}>
              <Typography variant="h6" fontWeight={800} mb={1.5}>
                {group.course_title}
              </Typography>
              <Grid container spacing={2}>
                {group.items.map((item, i) => {
                  const id = item.id ?? item.assessment_id ?? item.assessmentId;
                  const courseId =
                    item.course_id ?? item.courseId ?? item.course?.id;
                  const viewAssessmentPath =
                    courseId != null
                      ? `/student/learning/${encodeURIComponent(courseId)}/assessments/${encodeURIComponent(id)}`
                      : `/student/assessments/${encodeURIComponent(id)}`;
                  const latestStatus = String(
                    item.latest_status || "",
                  ).toUpperCase();
                  const maxAttempts = item.max_attempts;
                  const attemptCount = Number(item.attempt_count || 0);
                  const attemptsLabel =
                    maxAttempts === null || maxAttempts === undefined
                      ? `${attemptCount} attempt(s) · unlimited`
                      : `${attemptCount} of ${maxAttempts} attempt(s) used`;
                  const canStart =
                    !["IN_PROGRESS", "SUBMITTED"].includes(latestStatus) &&
                    (maxAttempts === null ||
                      maxAttempts === undefined ||
                      attemptCount < Number(maxAttempts));

                  return (
                    <Grid item xs={12} md={6} lg={4} key={id ?? i}>
                      <Card className="assessment-card">
                        <CardContent>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            gap={1}
                          >
                            <Typography variant="h6" fontWeight={800}>
                              {item.title || `Assessment #${id}`}
                            </Typography>
                            {statusChip(item)}
                          </Stack>
                          <Typography
                            color="text.secondary"
                            variant="body2"
                            mt={1}
                          >
                            {item.description ||
                              "Test your understanding of this course."}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={1}
                            mt={2}
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Chip
                              size="small"
                              label={`${item.duration_minutes ?? "—"} min`}
                            />
                            <Chip
                              size="small"
                              label={`Pass ${item.pass_percentage ?? "—"}%`}
                            />
                            <Chip size="small" label={attemptsLabel} />
                            {item.module_title && (
                              <Chip size="small" label={item.module_title} />
                            )}
                            {latestStatus === "EVALUATED" &&
                              item.latest_percentage != null && (
                                <Chip
                                  size="small"
                                  color={
                                    item.latest_passed ? "success" : "default"
                                  }
                                  label={`Latest ${item.latest_percentage}%`}
                                />
                              )}
                          </Stack>
                          {item.certificate_number && (
                            <Alert
                              severity="success"
                              icon={<VerifiedRoundedIcon />}
                              sx={{ mt: 2 }}
                            >
                              Certificate: {item.certificate_number}
                            </Alert>
                          )}
                          <Stack
                            direction="row"
                            spacing={1}
                            mt={2}
                            flexWrap="wrap"
                            useFlexGap
                          >
                            {latestStatus === "IN_PROGRESS" &&
                            item.latest_attempt_id ? (
                              <Button
                                component={Link}
                                to={`/student/assessments/attempts/${item.latest_attempt_id}`}
                                variant="contained"
                                startIcon={<ReplayRoundedIcon />}
                              >
                                Resume attempt
                              </Button>
                            ) : canStart ? (
                              <Button
                                component={Link}
                                to={viewAssessmentPath}
                                variant="contained"
                                startIcon={<PlayArrowRoundedIcon />}
                              >
                                View assessment
                              </Button>
                            ) : (
                              <Button
                                component={Link}
                                to={`/student/assessments/${id}`}
                                variant="outlined"
                              >
                                View details
                              </Button>
                            )}
                            {item.latest_attempt_id &&
                              ["EVALUATED", "SUBMITTED"].includes(
                                latestStatus,
                              ) && (
                                <Button
                                  component={Link}
                                  to={`/student/assessments/attempts/${item.latest_attempt_id}/result`}
                                  startIcon={<FactCheckRoundedIcon />}
                                >
                                  View result
                                </Button>
                              )}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
