import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import {
  studentAssessmentApi,
  unwrapAssessmentResponse,
  getAssessmentError,
} from "../../../service/AssessmentApi";
import "../../Instructor/Assessment/Assessment.scss";

function attemptStatus(row) {
  if (row.status === "EVALUATED") return row.passed ? "Passed" : "Failed";
  if (row.status === "SUBMITTED") return "Awaiting grading";
  if (row.status === "IN_PROGRESS") return "In progress";
  return row.status || "—";
}

export default function StudentAssessmentDetailsPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timerId;

    async function loadDetails() {
      try {
        const response = await studentAssessmentApi.details(assessmentId);
        const nextData = unwrapAssessmentResponse(response);
        if (!active) return;

        setData(nextData);
        setError("");

        if (
          String(nextData?.latest_attempt?.status || "").toUpperCase() ===
          "SUBMITTED"
        ) {
          timerId = window.setTimeout(loadDetails, 5000);
        }
      } catch (err) {
        if (active) setError(getAssessmentError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDetails();

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [assessmentId]);

  const assessment = data?.assessment || data;
  const courseId =
    location.state?.courseId ?? assessment?.course_id ?? assessment?.course?.id;
  const backPath = courseId
    ? `/student/learning/${encodeURIComponent(courseId)}`
    : "/student/assessments";
  const backLabel = courseId ? "Back to course" : "All assessments";
  const attempts = data?.attempts || [];
  const inProgressAttempt = data?.in_progress_attempt;
  const canStart = data?.can_start !== false;

  async function start() {
    setStarting(true);
    setError("");
    try {
      const response = await studentAssessmentApi.start(assessmentId);
      const result = unwrapAssessmentResponse(response);
      const attemptId = result?.attempt_id ?? result?.attemptId ?? result?.id;
      if (!attemptId)
        throw new Error("Assessment started, but no attempt ID was returned.");
      sessionStorage.setItem(`assessment:${attemptId}`, String(assessmentId));
      sessionStorage.setItem(`attempt:${attemptId}`, JSON.stringify(result));
      navigate(`/student/assessments/attempts/${attemptId}`, {
        state: { assessmentId },
      });
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setStarting(false);
    }
  }

  if (loading)
    return (
      <Box className="assessment-loading student-page student-page--inset">
        <CircularProgress />
      </Box>
    );

  return (
    <Box className="assessment-page student-page student-page--inset">
      <Button
        component={Link}
        to={backPath}
        startIcon={<ArrowBackRoundedIcon />}
        sx={{ mb: 2 }}
      >
        {backLabel}
      </Button>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Card className="assessment-panel">
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ sm: "flex-start" }}
            gap={2}
          >
            <Box>
              <Typography variant="h4" fontWeight={800}>
                {assessment?.title || `Assessment #${assessmentId}`}
              </Typography>
              <Typography color="text.secondary" mt={1}>
                {assessment?.course_title || ""}
                {assessment?.module_title
                  ? ` · ${assessment.module_title}`
                  : ""}
              </Typography>
            </Box>
            <Chip label={assessment?.assessment_type || "ASSESSMENT"} />
          </Stack>
          <Typography color="text.secondary" mt={2}>
            {assessment?.description ||
              "Review the instructions before starting."}
          </Typography>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" fontWeight={800}>
            Instructions
          </Typography>
          <Typography
            sx={{ whiteSpace: "pre-wrap" }}
            color="text.secondary"
            mt={1}
          >
            {assessment?.instructions ||
              "Answer all required questions and submit before the time limit."}
          </Typography>
          <Stack direction="row" spacing={2} mt={3} flexWrap="wrap" useFlexGap>
            <Chip
              label={`Duration: ${assessment?.duration_minutes ?? "Unlimited"} min`}
            />
            <Chip label={`Pass mark: ${assessment?.pass_percentage ?? "—"}%`} />
            <Chip
              label={`Attempts: ${data?.attempt_count ?? 0}${assessment?.max_attempts != null ? ` / ${assessment.max_attempts}` : " (unlimited)"}`}
            />
            <Chip label={`Total marks: ${assessment?.total_marks ?? 0}`} />
            {data?.attempts_remaining != null && (
              <Chip
                color={data.attempts_remaining > 0 ? "success" : "error"}
                label={`${data.attempts_remaining} attempt(s) remaining`}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} mt={3} flexWrap="wrap" useFlexGap>
            {inProgressAttempt ? (
              <Button
                variant="contained"
                component={Link}
                to={`/student/assessments/attempts/${inProgressAttempt.attempt_id}`}
                startIcon={<ReplayRoundedIcon />}
              >
                Resume attempt #{inProgressAttempt.attempt_number}
              </Button>
            ) : canStart ? (
              <Button
                variant="contained"
                onClick={start}
                disabled={starting}
                startIcon={
                  starting ? (
                    <CircularProgress size={18} />
                  ) : (
                    <PlayArrowRoundedIcon />
                  )
                }
              >
                {starting
                  ? "Starting..."
                  : attempts.length
                    ? "Start new attempt"
                    : "Start assessment"}
              </Button>
            ) : (
              <Alert severity="info" sx={{ width: "100%" }}>
                {data?.latest_attempt?.status === "SUBMITTED"
                  ? "Your latest attempt is awaiting instructor evaluation."
                  : "You have used all available attempts for this assessment."}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card className="assessment-panel" sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={800} mb={2}>
            Your attempts
          </Typography>
          {attempts.length === 0 ? (
            <Alert severity="info">
              You have not started this assessment yet.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Attempt</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Percentage</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow key={attempt.attempt_id}>
                      <TableCell>#{attempt.attempt_number}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            attempt.status === "EVALUATED"
                              ? attempt.passed
                                ? "success"
                                : "error"
                              : attempt.status === "SUBMITTED"
                                ? "warning"
                                : "info"
                          }
                          label={attemptStatus(attempt)}
                        />
                      </TableCell>
                      <TableCell>
                        {attempt.status === "EVALUATED"
                          ? `${attempt.obtained_marks ?? "—"} / ${attempt.total_marks ?? "—"}`
                          : attempt.status === "SUBMITTED"
                            ? "Pending"
                            : "—"}
                      </TableCell>
                      <TableCell>
                        {attempt.status === "EVALUATED" &&
                        attempt.percentage != null
                          ? `${attempt.percentage}%`
                          : attempt.status === "SUBMITTED"
                            ? "Pending"
                            : "—"}
                      </TableCell>
                      <TableCell>
                        {attempt.submitted_at
                          ? new Date(attempt.submitted_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        {["EVALUATED", "SUBMITTED"].includes(attempt.status) ? (
                          <Button
                            size="small"
                            component={Link}
                            to={`/student/assessments/attempts/${attempt.attempt_id}/result`}
                            startIcon={<FactCheckRoundedIcon />}
                          >
                            View result
                          </Button>
                        ) : attempt.status === "IN_PROGRESS" ? (
                          <Button
                            size="small"
                            component={Link}
                            to={`/student/assessments/attempts/${attempt.attempt_id}`}
                            startIcon={<ReplayRoundedIcon />}
                          >
                            Resume
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
