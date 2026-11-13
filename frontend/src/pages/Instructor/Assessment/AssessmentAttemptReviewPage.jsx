import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Grid, Stack, TextField, Typography
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import {
  instructorAssessmentApi,
  unwrapAssessmentResponse,
  getAssessmentError
} from "../../../service/AssessmentApi";
import "./Assessment.scss";

const TEXT_TYPES = ["SHORT_TEXT", "LONG_TEXT"];

function labelForType(type) {
  return String(type || "").replaceAll("_", " ").toLowerCase();
}

function questionHasAnswer(question) {
  const selected = question.selected_option_ids || [];
  return question.is_answered === true &&
    (selected.length > 0 || String(question.answer_text || "").trim().length > 0);
}

export default function AssessmentAttemptReviewPage() {
  const { assessmentId, attemptId } = useParams();
  const [data, setData] = useState(null);
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await instructorAssessmentApi.attempt(assessmentId, attemptId);
      const result = unwrapAssessmentResponse(response);
      setData(result);
      const initial = {};
      for (const question of result.questions || []) {
        initial[question.question_id] = {
          marks_awarded: Number(question.marks_awarded || 0),
          evaluation_comment: question.evaluation_comment || ""
        };
      }
      setGrades(initial);
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setLoading(false);
    }
  }, [assessmentId, attemptId]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const attempt = data?.attempt;
  const questions = useMemo(() => data?.questions || [], [data]);
  const certificate = data?.certificate;
  const pendingQuestions = useMemo(
    () => questions.filter(question =>
      TEXT_TYPES.includes(question.question_type) &&
      questionHasAnswer(question) &&
      (question.is_correct === null || question.is_correct === undefined)
    ).length,
    [questions]
  );

  function updateGrade(questionId, field, value) {
    setGrades(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [field]: value
      }
    }));
  }

  async function saveResult() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const answers = [];

      for (const question of questions) {
        const grade = grades[question.question_id] || {};
        const marks = Number(grade.marks_awarded || 0);
        const comment = String(grade.evaluation_comment || "").trim();
        const isText = TEXT_TYPES.includes(question.question_type);
        const hasAnswer = questionHasAnswer(question);
        const changed =
          marks !== Number(question.marks_awarded || 0) ||
          comment !== (question.evaluation_comment || "");

        if (isText && hasAnswer) {
          answers.push({
            question_id: question.question_id,
            marks_awarded: marks,
            evaluation_comment: comment || null
          });
        } else if (changed) {
          answers.push({
            question_id: question.question_id,
            marks_awarded: marks,
            evaluation_comment: comment || null
          });
        }
      }

      const response = await instructorAssessmentApi.evaluateAttempt(
        assessmentId,
        attemptId,
        { answers, publish: true }
      );
      const result = unwrapAssessmentResponse(response);
      setData(result);
      if (result?.certificate) {
        setNotice(`Result published. Certificate ${result.certificate.certificate_number} issued.`);
      } else {
        setNotice("Result published successfully.");
      }
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Box className="assessment-loading"><CircularProgress /></Box>;

  return <Box className="assessment-page">
    <Button component={Link} to={`/instructor/assessments/${assessmentId}/results`} startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 2 }}>Back to results</Button>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}

    <Typography variant="h4" fontWeight={800}>{attempt?.assessment_title || "Review attempt"}</Typography>
    <Typography color="text.secondary" mb={2}>
      {attempt?.student_name || "Student"} · Attempt #{attempt?.attempt_number} · {attempt?.course_title || ""}
    </Typography>

    <Grid container spacing={2} mb={3}>
      {[
        ["Status", attempt?.status || "—"],
        ["Score", `${attempt?.obtained_marks ?? 0} / ${attempt?.total_marks ?? 0}`],
        ["Percentage", `${attempt?.percentage ?? 0}%`],
        ["Passing", attempt?.passed === true ? "Passed" : attempt?.passed === false ? "Failed" : "Pending"],
        ["Written answers awaiting grade", pendingQuestions]
      ].map(([label, value]) => (
        <Grid item xs={6} md={2} key={label}>
          <Card className="assessment-stat"><CardContent>
            <Typography color="text.secondary" variant="caption">{label}</Typography>
            <Typography variant="h6" fontWeight={800}>{value}</Typography>
          </CardContent></Card>
        </Grid>
      ))}
    </Grid>

    {certificate && (
      <Alert severity="success" icon={<VerifiedRoundedIcon />} sx={{ mb: 3 }}>
        Certificate {certificate.certificate_number} issued on {certificate.issue_date || "—"}. Verification code: {certificate.verification_code}
      </Alert>
    )}

    <Stack spacing={2}>
      {questions.map((question, index) => {
        const isText = TEXT_TYPES.includes(question.question_type);
        const grade = grades[question.question_id] || { marks_awarded: 0, evaluation_comment: "" };
        const hasAnswer = questionHasAnswer(question);

        return <Card className="assessment-panel" key={question.question_id}>
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
              <Box>
                <Typography color="text.secondary" variant="overline">
                  QUESTION {question.question_number || index + 1} · {labelForType(question.question_type)} · {question.marks} marks
                </Typography>
                <Typography variant="h6" fontWeight={700}>{question.question_text}</Typography>
              </Box>
              <Chip
                size="small"
                color={question.is_correct === true ? "success" : question.is_correct === false ? "error" : "warning"}
                label={question.is_correct === true ? "Correct" : question.is_correct === false ? "Incorrect" : "Needs grading"}
              />
            </Stack>

            {Array.isArray(question.options) && question.options.length > 0 && (
              <Stack spacing={0.75} mt={2}>
                {question.options.map(option => {
                  const id = Number(option.option_id ?? option.id);
                  const selected = option.is_selected || (question.selected_option_ids || []).includes(id);
                  const correct = option.is_correct === true;
                  return <Box
                    key={id}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: selected ? "primary.main" : "divider",
                      bgcolor: correct ? "success.50" : selected ? "primary.50" : "transparent"
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip size="small" label={option.option_code} />
                      <Typography variant="body2">{option.option_text}</Typography>
                      {selected && <Chip size="small" color="primary" label="Student answer" />}
                      {correct && <Chip size="small" color="success" label="Correct answer" />}
                    </Stack>
                  </Box>;
                })}
              </Stack>
            )}

            {isText && (
              <Box mt={2}>
                <Typography variant="subtitle2" fontWeight={800}>Student written answer</Typography>
                {hasAnswer ? (
                  <Box sx={{ mt: 1, p: 1.5, bgcolor: "grey.50", borderRadius: 2, whiteSpace: "pre-wrap" }}>
                    <Typography variant="body2">{question.answer_text}</Typography>
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mt: 1 }}>No answer submitted.</Alert>
                )}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  type="number"
                  label={`Marks awarded (max ${question.marks})`}
                  value={grade.marks_awarded}
                  onChange={e => updateGrade(question.question_id, "marks_awarded", e.target.value)}
                  inputProps={{ min: 0, max: Number(question.marks), step: "0.5" }}
                />
              </Grid>
              <Grid item xs={12} sm={9}>
                <TextField
                  fullWidth
                  label="Evaluation comment (optional)"
                  value={grade.evaluation_comment}
                  onChange={e => updateGrade(question.question_id, "evaluation_comment", e.target.value)}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>;
      })}
    </Stack>

    <Stack direction="row" justifyContent="flex-end" mt={3}>
      <Button
        variant="contained"
        color="success"
        onClick={saveResult}
        disabled={saving}
        startIcon={saving ? <CircularProgress size={18} /> : <SaveRoundedIcon />}
      >
        {saving ? "Publishing..." : "Publish final result"}
      </Button>
    </Stack>
  </Box>;
}
