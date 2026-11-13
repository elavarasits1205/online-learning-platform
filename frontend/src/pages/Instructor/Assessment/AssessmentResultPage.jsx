import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";

import {
  instructorAssessmentApi,
  unwrapAssessmentResponse,
  getAssessmentError
} from "../../../service/AssessmentApi";

import "./Assessment.scss";

// ============================================================
// RESPONSE HELPERS
// ============================================================

function asRows(data) {
  if (Array.isArray(data)) return data;

  const rows =
    data?.results ??
    data?.attempts ??
    data?.students ??
    data?.items ??
    [];

  return Array.isArray(rows) ? rows : [];
}

function asAssessments(data) {
  if (Array.isArray(data)) return data;

  const rows =
    data?.assessments ??
    data?.items ??
    data?.results ??
    [];

  return Array.isArray(rows) ? rows : [];
}

function getPassed(row) {
  return row.passed ?? row.is_passed;
}

function getPercentage(row) {
  return (
    row.percentage ??
    row.score_percentage ??
    row.percentage_score ??
    null
  );
}

function getAttemptId(row) {
  return row.attempt_id ?? row.id;
}

function statusLabel(row) {
  const status = String(row.status || "").toUpperCase();
  const passed = getPassed(row);

  if (status === "EVALUATED") {
    if (passed === true) return "Passed";
    if (passed === false) return "Failed";
    return "Evaluated";
  }

  if (status === "SUBMITTED") return "Awaiting grading";
  if (status === "IN_PROGRESS") return "In progress";

  return status || "—";
}

function statusColor(row) {
  const status = String(row.status || "").toUpperCase();
  const passed = getPassed(row);

  if (status === "EVALUATED") {
    if (passed === true) return "success";
    if (passed === false) return "error";
  }

  if (status === "SUBMITTED") return "warning";

  return "default";
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AssessmentResultsPage() {
  const { assessmentId } = useParams();

  const [data, setData] = useState(null);
  const [assessments, setAssessments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // LOAD ASSESSMENT LIST OR INDIVIDUAL RESULTS
  // ==========================================================

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (assessmentId) {
        // Load results for one assessment.
        const response =
          await instructorAssessmentApi.results(assessmentId);

        setData(unwrapAssessmentResponse(response));
      } else {
        // Load instructor's assessment list.
        const response =
          await instructorAssessmentApi.list();

        const result = unwrapAssessmentResponse(response);

        setAssessments(asAssessments(result));
      }
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  // ==========================================================
  // INITIAL API CALL
  // ==========================================================

  useEffect(() => {
    load();
  }, [load]);

  // ==========================================================
  // NORMALIZE RESULT DATA
  // ==========================================================

  const rows = useMemo(
    () => asRows(data),
    [data]
  );

  const assessment = data?.assessment ?? null;

  // ==========================================================
  // RESULT STATISTICS
  // ==========================================================

  const stats = useMemo(() => {
    const evaluated = rows.filter(
      row => String(row.status || "").toUpperCase() === "EVALUATED"
    );

    const passed = evaluated.filter(
      row => getPassed(row) === true
    ).length;

    const pending = rows.filter(
      row => String(row.status || "").toUpperCase() === "SUBMITTED"
    ).length;

    const percentages = evaluated
      .map(getPercentage)
      .filter(value => value !== null && value !== "")
      .map(Number)
      .filter(Number.isFinite);

    const average = percentages.length
      ? Number(
          (
            percentages.reduce((sum, value) => sum + value, 0) /
            percentages.length
          ).toFixed(1)
        )
      : 0;

    return {
      total: rows.length,
      evaluated: evaluated.length,
      passed,
      pending,
      average
    };
  }, [rows]);

  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (loading) {
    return (
      <Box className="assessment-loading">
        <CircularProgress />
      </Box>
    );
  }

  // ==========================================================
  // INSTRUCTOR ASSESSMENT LIST
  // ==========================================================

  if (!assessmentId) {
    return (
      <Box className="assessment-page">

        <Typography variant="h4" fontWeight={800}>
          My Assessment Results
        </Typography>

        <Typography color="text.secondary" mb={3}>
          Choose an assessment to review student attempts and scores.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!error && assessments.length === 0 && (
          <Alert severity="info">
            No assessments are available yet.
          </Alert>
        )}

        <Stack spacing={2}>
          {assessments.map((item, index) => {
            const id =
              item.id ??
              item.assessment_id ??
              item.assessmentId;

            return (
              <Card
                className="assessment-panel"
                key={id ?? index}
              >
                <CardContent>

                  <Typography variant="h6" fontWeight={800}>
                    {item.title ||
                      item.assessment_title ||
                      `Assessment #${id}`}
                  </Typography>

                  <Typography color="text.secondary" mb={2}>
                    {item.course_title ||
                      item.course_name ||
                      item.assessment_type ||
                      "Assessment"}
                  </Typography>

                  <Button
                    component={Link}
                    to={`/instructor/assessments/${id}/results`}
                    variant="contained"
                    disabled={!id}
                  >
                    View Results
                  </Button>

                </CardContent>
              </Card>
            );
          })}
        </Stack>

      </Box>
    );
  }

  // ==========================================================
  // INDIVIDUAL ASSESSMENT RESULTS
  // ==========================================================

  return (
    <Box className="assessment-page">

      <Button
        component={Link}
        to="/instructor/assessments"
        startIcon={<ArrowBackRoundedIcon />}
        sx={{ mb: 2 }}
      >
        Back to Assessments
      </Button>

      <Typography variant="h4" fontWeight={800}>
        {assessment?.title || "Assessment Results"}
      </Typography>

      <Typography color="text.secondary" mb={3}>
        {assessment?.course_title
          ? `${assessment.course_title} · `
          : ""}
        Assessment ID: {assessmentId}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* RESULT STATISTICS */}

      <Grid container spacing={2} mb={3}>
        {[
          ["Total Attempts", stats.total],
          ["Evaluated", stats.evaluated],
          ["Passed", stats.passed],
          ["Awaiting Grading", stats.pending],
          ["Average Score", `${stats.average}%`]
        ].map(([label, value]) => (
          <Grid item xs={6} md={2} key={label}>
            <Card className="assessment-stat">
              <CardContent>

                <Typography
                  color="text.secondary"
                  variant="body2"
                >
                  {label}
                </Typography>

                <Typography variant="h4" fontWeight={800}>
                  {value}
                </Typography>

              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* STUDENT ATTEMPTS */}

      <Card className="assessment-panel">
        <CardContent>

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >

            <Typography variant="h6" fontWeight={800}>
              Student Attempts ({rows.length})
            </Typography>

            <Button
              size="small"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </Button>

          </Stack>

          {!rows.length ? (
            <Alert severity="info">
              No attempts have been submitted for this assessment yet.
            </Alert>
          ) : (

            <TableContainer>
              <Table>

                <TableHead>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Attempt</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Percentage</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell>Certificate</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {rows.map((row, index) => {
                    const attemptId = getAttemptId(row);
                    const percentage = getPercentage(row);

                    return (
                      <TableRow
                        key={attemptId ?? index}
                      >

                        <TableCell>
                          <Typography fontWeight={700}>
                            {row.student_name ||
                              row.full_name ||
                              row.name ||
                              row.email ||
                              "Student"}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {row.register_number ||
                              row.student_code ||
                              row.email ||
                              ""}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          #{row.attempt_number ?? "—"}
                        </TableCell>

                        <TableCell>
                          {row.obtained_marks ??
                            row.score ??
                            "—"}
                          {" / "}
                          {row.total_marks ??
                            row.max_marks ??
                            "—"}
                        </TableCell>

                        <TableCell>
                          {percentage == null
                            ? "—"
                            : `${percentage}%`}
                        </TableCell>

                        <TableCell>
                          <Chip
                            size="small"
                            color={statusColor(row)}
                            label={statusLabel(row)}
                          />
                        </TableCell>

                        <TableCell>
                          {row.submitted_at
                            ? new Date(
                                row.submitted_at
                              ).toLocaleString()
                            : "—"}
                        </TableCell>

                        <TableCell>
                          {row.certificate_number ? (
                            <Chip
                              size="small"
                              color="success"
                              label={row.certificate_number}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>

                        <TableCell align="right">
                          <Button
                            size="small"
                            component={Link}
                            disabled={!attemptId}
                            to={`/instructor/assessments/${assessmentId}/results/${attemptId}`}
                            startIcon={<RateReviewRoundedIcon />}
                          >
                            Review & Grade
                          </Button>
                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>

              </Table>
            </TableContainer>
          )}

        </CardContent>
      </Card>

    </Box>
  );
}
