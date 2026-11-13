import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";

import {
  studentAssessmentApi,
  unwrapAssessmentResponse,
  getAssessmentError,
} from "../../../service/AssessmentApi";

import "../../Instructor/Assessment/Assessment.scss";

const POLL_INTERVAL_MS = 5000;

export default function StudentAssessmentResultPage() {
  const { attemptId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timerId;

    async function loadResult() {
      try {
        const response = await studentAssessmentApi.result(attemptId);
        const latestResult = unwrapAssessmentResponse(response);

        if (!active) return;

        setResult(latestResult);
        setError("");

        if (String(latestResult?.status || "").toUpperCase() === "SUBMITTED") {
          timerId = window.setTimeout(loadResult, POLL_INTERVAL_MS);
        }
      } catch (requestError) {
        if (!active) return;

        setError(getAssessmentError(requestError));
        // Retry transient errors while the student remains on the result page.
        timerId = window.setTimeout(loadResult, POLL_INTERVAL_MS);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (attemptId) {
      loadResult();
    } else {
      setError("Assessment attempt ID is missing.");
      setLoading(false);
    }

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [attemptId]);

  if (loading) {
    return (
      <Box className="assessment-loading student-page student-page--inset">
        <CircularProgress />
      </Box>
    );
  }

  if (!result) {
    return (
      <Box className="assessment-page student-page student-page--inset">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || "Unable to load this assessment result."}
        </Alert>
        <Button
          component={Link}
          to="/student/assessments"
          variant="outlined"
          startIcon={<ArrowBackRoundedIcon />}
        >
          All Assessments
        </Button>
      </Box>
    );
  }

  const status = String(result.status || "").toUpperCase();
  const evaluated = status === "EVALUATED";
  const percentage = Number(result.percentage ?? 0);
  const obtainedMarks = result.obtained_marks;
  const totalMarks = result.total_marks;
  const passPercentage = Number(
    result.passing_percentage ?? result.pass_percentage ?? 70,
  );
  const passed =
    evaluated && Number.isFinite(percentage) && percentage >= passPercentage;
  const courseUrl = result.course_id
    ? `/student/learning/${encodeURIComponent(result.course_id)}`
    : "/student/assessments";

  return (
    <Box className="assessment-page student-page student-page--inset">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Assessment Result
          </Typography>
          <Typography color="text.secondary">
            {result.assessment_title || "Assessment"}
            {result.course_title ? ` · ${result.course_title}` : ""}
          </Typography>
        </Box>
        <Chip
          color={evaluated ? (passed ? "success" : "error") : "warning"}
          label={
            evaluated ? (passed ? "Passed" : "Not passed") : "Awaiting grading"
          }
        />
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error} The page will keep checking for the published result.
        </Alert>
      )}

      <Card className="assessment-panel">
        <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: "center" }}>
          {evaluated ? (
            <CheckCircleRoundedIcon
              color={passed ? "success" : "error"}
              sx={{ fontSize: 56, mb: 1 }}
            />
          ) : (
            <PendingActionsRoundedIcon
              color="warning"
              sx={{ fontSize: 56, mb: 1 }}
            />
          )}

          <Typography variant="overline" color="primary" fontWeight={800}>
            {evaluated ? "FINAL RESULT" : "AWAITING INSTRUCTOR EVALUATION"}
          </Typography>
          <Typography variant="h4" fontWeight={900} mb={1}>
            {evaluated
              ? passed
                ? "Congratulations!"
                : "Result available"
              : "Submission received"}
          </Typography>

          {evaluated ? (
            <>
              <Typography color="text.secondary" mb={3}>
                {passed
                  ? "You passed this assessment. Your instructor’s evaluation is now included in your score."
                  : "Your instructor has evaluated this attempt. Review your final score below."}
              </Typography>

              <Box
                className="assessment-score"
                sx={{ mx: "auto", maxWidth: 320 }}
              >
                <span>Final score</span>
                <strong>
                  {Number.isFinite(percentage)
                    ? `${percentage.toFixed(1)}%`
                    : "—"}
                </strong>
                <span>Required to pass: {passPercentage}%</span>
              </Box>

              {obtainedMarks != null && totalMarks != null && (
                <Typography color="text.secondary" mt={2}>
                  Marks: {obtainedMarks} / {totalMarks}
                </Typography>
              )}

              <Typography
                color={passed ? "success.main" : "error.main"}
                fontWeight={800}
                mt={2}
              >
                {passed ? "Assessment passed" : "Assessment not passed"}
              </Typography>
            </>
          ) : (
            <>
              <Typography color="text.secondary" mb={2}>
                Your written answers are waiting for instructor evaluation. This
                page refreshes automatically when the final result is published.
              </Typography>
              <Stack
                direction="row"
                justifyContent="center"
                alignItems="center"
                spacing={1}
              >
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Checking for your result…
                </Typography>
              </Stack>
            </>
          )}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="center"
            spacing={1.5}
            mt={4}
          >
            <Button component={Link} to={courseUrl} variant="contained">
              Continue Learning
            </Button>
            <Button
              component={Link}
              to="/student/assessments"
              variant="outlined"
            >
              All Assessments
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {evaluated &&
        Array.isArray(result.questions) &&
        result.questions.length > 0 && (
          <Stack spacing={2} mt={3}>
            <Typography variant="h5" fontWeight={800}>
              Evaluated answers
            </Typography>
            {result.questions.map((question, index) => (
              <Card
                className="assessment-panel"
                key={question.question_id ?? index}
              >
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    QUESTION {question.question_number ?? index + 1}
                    {question.marks != null ? ` · ${question.marks} MARKS` : ""}
                  </Typography>
                  <Typography fontWeight={700} mb={1}>
                    {question.question_text}
                  </Typography>
                  {question.answer_text && (
                    <Typography
                      color="text.secondary"
                      sx={{ whiteSpace: "pre-wrap" }}
                    >
                      Your answer: {question.answer_text}
                    </Typography>
                  )}
                  {question.marks_awarded != null && (
                    <Typography fontWeight={700} mt={1}>
                      Marks awarded: {question.marks_awarded} / {question.marks}
                    </Typography>
                  )}
                  {question.evaluation_comment && (
                    <Typography color="text.secondary" mt={1}>
                      Instructor feedback: {question.evaluation_comment}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
    </Box>
  );
}
