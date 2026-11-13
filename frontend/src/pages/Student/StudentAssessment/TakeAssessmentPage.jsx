import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { studentAssessmentApi, unwrapAssessmentResponse, getAssessmentError } from "../../../service/AssessmentApi";
import "../../Instructor/Assessment/Assessment.scss";

const TEXT_TYPES = ["SHORT_TEXT", "LONG_TEXT"];
const CHOICE_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"];

function labelForType(type) {
  return String(type || "").replaceAll("_", " ").toLowerCase();
}

export default function TakeAssessmentPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const submitRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await studentAssessmentApi.attempt(attemptId);
      const data = unwrapAssessmentResponse(response);
      setAttempt(data.attempt);
      setQuestions(data.questions || []);

      const initial = {};
      for (const question of data.questions || []) {
        const qid = String(question.question_id);
        if (TEXT_TYPES.includes(question.question_type)) {
          initial[qid] = question.answer_text || "";
        } else {
          initial[qid] = question.selected_option_ids || [];
        }
      }
      setAnswers(initial);

      if (data.attempt?.duration_minutes != null) {
        const endsAt = new Date(data.attempt.started_at).getTime() +
          Number(data.attempt.duration_minutes) * 60 * 1000;
        setRemaining(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));
      } else {
        setRemaining(null);
      }

      if (data.attempt?.status && data.attempt.status !== "IN_PROGRESS") {
        navigate(`/student/assessments/attempts/${attemptId}/result`, { replace: true });
      }
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setLoading(false);
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      submitRef.current?.(true);
      return;
    }
    const timer = window.setTimeout(() => setRemaining(v => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const timeLabel = useMemo(() => {
    if (remaining === null) return "No time limit";
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60).toString().padStart(2, "0");
    const seconds = (remaining % 60).toString().padStart(2, "0");
    return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
  }, [remaining]);

  const answeredCount = useMemo(
    () => questions.filter(question => {
      const value = answers[String(question.question_id)];
      return Array.isArray(value) ? value.length > 0 : String(value || "").trim().length > 0;
    }).length,
    [questions, answers]
  );

  async function saveAnswer(question, payload) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await studentAssessmentApi.saveAnswer(attemptId, {
        question_id: String(question.question_id),
        ...payload
      });
      setNotice("Answer saved.");
    } catch (err) {
      setError(getAssessmentError(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function choose(question, optionId, multiple) {
    const qid = String(question.question_id);
    const current = Array.isArray(answers[qid]) ? answers[qid] : [];
    const next = multiple
      ? (current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId])
      : [optionId];
    setAnswers(prev => ({ ...prev, [qid]: next }));
    await saveAnswer(question, { selected_option_ids: next });
  }

  async function handleSubmit(auto = false) {
    if (submitting) return;
    if (!auto && !window.confirm("Submit your assessment now? You cannot change answers after submission.")) return;
    setSubmitting(true);
    setError("");
    try {
      for (const question of questions) {
        if (!TEXT_TYPES.includes(question.question_type)) continue;
        const text = String(answers[String(question.question_id)] || "").trim();
        if (text) {
          await studentAssessmentApi.saveAnswer(attemptId, {
            question_id: String(question.question_id),
            answer_text: text,
            selected_option_ids: []
          });
        }
      }
      const response = await studentAssessmentApi.submit(attemptId);
      const data = unwrapAssessmentResponse(response);
      sessionStorage.removeItem(`attempt:${attemptId}`);
      sessionStorage.removeItem(`assessment:${attemptId}`);
      navigate(`/student/assessments/attempts/${attemptId}/result`, { state: { result: data } });
    } catch (err) {
      setError(getAssessmentError(err));
      setSubmitting(false);
    }
  }

  if (loading) return <Box className="assessment-loading student-page student-page--inset"><CircularProgress /></Box>;

  return <Box className="assessment-page student-page student-page--inset">
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={3}>
      <Box>
        <Typography variant="h4" fontWeight={800}>{attempt?.assessment_title || "Assessment"}</Typography>
        <Typography color="text.secondary">{attempt?.course_title || ""} · Attempt #{attempt?.attempt_number} · {answeredCount} of {questions.length} answered</Typography>
      </Box>
      <Card className="assessment-timer"><CardContent><Typography variant="caption" color="text.secondary">TIME LEFT</Typography><Typography variant="h5" fontWeight={900} color={remaining === 0 ? "error" : "primary"}>{timeLabel}</Typography></CardContent></Card>
    </Stack>
    {questions.length === 0 ? <Alert severity="warning">No questions were returned for this assessment.</Alert> :
      <Stack spacing={2}>{questions.map((question, index) => {
        const qid = String(question.question_id);
        const options = question.options || [];
        const selected = Array.isArray(answers[qid]) ? answers[qid] : [];
        const type = question.question_type;
        const multiple = type === "MULTIPLE_CHOICE";
        const isText = TEXT_TYPES.includes(type);

        return <Card className="assessment-panel" key={qid || index}><CardContent>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography color="text.secondary" variant="overline">QUESTION {question.question_number || index + 1} · {question.marks ?? "—"} MARKS</Typography>
            <Typography color="text.secondary" variant="overline">· {labelForType(type)}</Typography>
            {question.is_mandatory && <Typography color="error" variant="overline">· Required</Typography>}
          </Stack>
          <Typography variant="h6" fontWeight={700} mb={2}>{question.question_text}</Typography>

          {CHOICE_TYPES.includes(type) && (
            multiple ? (
              <Stack>{options.map(option => {
                const optionId = String(option.id ?? option.option_id);
                return <FormControlLabel key={optionId} control={<Checkbox checked={selected.includes(optionId)} onChange={() => choose(question, optionId, true)} />} label={`${option.option_code || ""}. ${option.option_text}`} />;
              })}</Stack>
            ) : (
                  <RadioGroup value={selected[0] ?? ""} onChange={e => choose(question, e.target.value, false)}>
                {options.map(option => {
                  const optionId = String(option.id ?? option.option_id);
                  return <FormControlLabel key={optionId} value={optionId} control={<Radio />} label={`${option.option_code || ""}. ${option.option_text}`} />;
                })}
              </RadioGroup>
            )
          )}

          {isText && (
            <Stack spacing={1}>
              <TextField
                fullWidth
                multiline
                minRows={type === "LONG_TEXT" ? 5 : 2}
                label="Your answer"
                value={answers[qid] || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [qid]: e.target.value }))}
                onBlur={() => {
                  const text = String(answers[qid] || "").trim();
                  if (text) {
                    saveAnswer(question, { answer_text: text, selected_option_ids: [] }).catch(() => {});
                  }
                }}
              />
              <Stack direction="row" justifyContent="flex-end">
                <Button
                  size="small"
                  startIcon={<SaveRoundedIcon />}
                  disabled={!String(answers[qid] || "").trim()}
                  onClick={() => saveAnswer(question, {
                    answer_text: String(answers[qid] || "").trim(),
                    selected_option_ids: []
                  })}
                >
                  Save written answer
                </Button>
              </Stack>
            </Stack>
          )}
        </CardContent></Card>;
      })}</Stack>}
    <Stack direction="row" justifyContent="space-between" alignItems="center" mt={3}>
      <Typography variant="body2" color="text.secondary">{saving ? "Saving answer..." : "Objective answers save automatically; written answers save when you click Save or Submit."}</Typography>
      <Button variant="contained" color="success" disabled={submitting || saving} onClick={() => handleSubmit(false)} startIcon={submitting ? <CircularProgress size={18} /> : <SendRoundedIcon />}>{submitting ? "Submitting..." : "Submit assessment"}</Button>
    </Stack>
  </Box>;
}
