import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Divider, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography
} from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PublishRoundedIcon from "@mui/icons-material/PublishRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  instructorAssessmentApi,
  unwrapAssessmentResponse,
  getAssessmentError
} from "../../../service/AssessmentApi";
import "./Assessment.scss";

const CHOICE_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"];
const TEXT_TYPES = ["SHORT_TEXT", "LONG_TEXT"];

const blankQuestion = {
  question_text: "",
  question_type: "SINGLE_CHOICE",
  explanation: "",
  default_marks: 1,
  negative_marks: 0,
  difficulty_level: "EASY"
};

function makeOptions(type) {
  if (type === "TRUE_FALSE") {
    return [
      { option_code: "A", option_text: "True", is_correct: true, display_order: 1, explanation: "" },
      { option_code: "B", option_text: "False", is_correct: false, display_order: 2, explanation: "" }
    ];
  }
  return [
    { option_code: "A", option_text: "", is_correct: true, display_order: 1, explanation: "" },
    { option_code: "B", option_text: "", is_correct: false, display_order: 2, explanation: "" },
    { option_code: "C", option_text: "", is_correct: false, display_order: 3, explanation: "" },
    { option_code: "D", option_text: "", is_correct: false, display_order: 4, explanation: "" }
  ];
}

function getId(value) {
  return value?.id ?? value?.question_id ?? value?.questionId;
}

function getNextQuestionNumber(assessmentData) {
  const questions =
    assessmentData?.questions || assessmentData?.assessment_questions || [];

  return questions.reduce(
    (highest, item) => Math.max(highest, Number(item?.question_number) || 0),
    0
  ) + 1;
}

function labelForType(type) {
  return String(type || "").replaceAll("_", " ").toLowerCase();
}

export default function AssessmentManagePage() {
  const { assessmentId } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [question, setQuestion] = useState(blankQuestion);
  const [options, setOptions] = useState(() => makeOptions("SINGLE_CHOICE"));
  const [questionNumber, setQuestionNumber] = useState(1);
  const [marks, setMarks] = useState(1);
  const [mandatory, setMandatory] = useState(true);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await instructorAssessmentApi.getDetails(assessmentId);
      const data = unwrapAssessmentResponse(response);

      setAssessment(data);
      setQuestionNumber(getNextQuestionNumber(data));
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);


  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const attached = useMemo(
    () => assessment?.questions || assessment?.assessment_questions || [],
    [assessment]
  );

  const isChoice = CHOICE_TYPES.includes(question.question_type);
  const isText = TEXT_TYPES.includes(question.question_type);
  const isDraft = String(assessment?.status || "").toUpperCase() === "DRAFT";

  function resetEditor() {
    setQuestion({ ...blankQuestion });
    setOptions(makeOptions("SINGLE_CHOICE"));
    setEditingQuestionId(null);
    setMarks(1);
    setMandatory(true);
    setQuestionNumber(getNextQuestionNumber(assessment));
  }

  function changeQuestionType(event) {
    const type = event.target.value;
    setQuestion(prev => ({ ...prev, question_type: type }));
    setOptions(makeOptions(type));
  }

  function updateOption(index, field, value) {
    setOptions(prev => prev.map((option, i) => {
      if (i !== index) {
        if (field === "is_correct" && value === true && question.question_type === "SINGLE_CHOICE") {
          return { ...option, is_correct: false };
        }
        if (field === "is_correct" && value === true && question.question_type === "TRUE_FALSE") {
          return { ...option, is_correct: false };
        }
        return option;
      }
      return { ...option, [field]: value };
    }));
  }

  function startEdit(item) {
    const type = item.question_type;
    setEditingQuestionId(Number(item.question_id));
    setQuestion({
      question_text: item.question_text || "",
      question_type: type || "SINGLE_CHOICE",
      explanation: item.explanation || "",
      default_marks: item.default_marks ?? item.marks ?? 1,
      negative_marks: item.negative_marks ?? 0,
      difficulty_level: item.difficulty_level || "MEDIUM"
    });
    setOptions(
      Array.isArray(item.options) && item.options.length
        ? item.options.map(option => ({
            id: option.id,
            option_code: option.option_code,
            option_text: option.option_text,
            display_order: option.display_order,
            is_correct: option.is_correct === true,
            explanation: option.explanation || ""
          }))
        : makeOptions(type)
    );
    setMarks(item.marks ?? item.default_marks ?? 1);
    setMandatory(item.is_mandatory !== false);
    setQuestionNumber(item.question_number || getNextQuestionNumber(assessment));
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateOptions() {
    const validOptions = options.filter(option => option.option_text.trim());

    if (validOptions.length < 2) {
      throw new Error("Add at least two answer options.");
    }
    if (question.question_type === "TRUE_FALSE" && validOptions.length !== 2) {
      throw new Error("True / False questions must have exactly two options.");
    }
    const correctCount = validOptions.filter(option => option.is_correct).length;
    if (correctCount < 1) {
      throw new Error("Select at least one correct answer.");
    }
    if (question.question_type === "SINGLE_CHOICE" && correctCount !== 1) {
      throw new Error("Single choice questions must have exactly one correct answer.");
    }
    return validOptions.map((option, index) => ({
      ...(option.id ? { id: option.id } : {}),
      option_code: option.option_code,
      option_text: option.option_text.trim(),
      display_order: index + 1,
      is_correct: option.is_correct === true,
      explanation: option.explanation || null
    }));
  }

  async function saveQuestion(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!question.question_text.trim()) {
        throw new Error("Question text is required.");
      }
      const validOptions = isChoice ? validateOptions() : [];

      if (editingQuestionId) {
        await instructorAssessmentApi.updateQuestion(editingQuestionId, {
          question_text: question.question_text.trim(),
          explanation: question.explanation || null,
          default_marks: Number(question.default_marks),
          negative_marks: Number(question.negative_marks),
          difficulty_level: question.difficulty_level
        });

        if (isChoice) {
          await instructorAssessmentApi.updateOptions(editingQuestionId, validOptions);
        }

        setNotice("Question updated successfully.");
        resetEditor();
        await load();
        return;
      }

      const createdQuestionResponse = await instructorAssessmentApi.createQuestion({
        ...question,
        question_text: question.question_text.trim(),
        default_marks: Number(question.default_marks),
        negative_marks: Number(question.negative_marks)
      });
      const createdQuestion = unwrapAssessmentResponse(createdQuestionResponse);
      const questionId = getId(createdQuestion);
      if (!questionId) {
        throw new Error("Question was created but no question ID was returned.");
      }

      if (isChoice) {
        await instructorAssessmentApi.createOptions(questionId, validOptions);
      }

      await instructorAssessmentApi.attachQuestion(assessmentId, {
        question_id: Number(questionId),
        question_number: Number(questionNumber),
        marks: Number(marks),
        negative_marks: Number(question.negative_marks),
        is_mandatory: mandatory
      });

      setNotice("Question, options and assessment mapping saved successfully.");
      resetEditor();
      await load();
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setSaving(false);
    }
  }

  async function publishAssessment() {
    if (!window.confirm("Publish this assessment? Students may be able to access it immediately.")) return;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      await instructorAssessmentApi.publish(assessmentId);
      setNotice("Assessment published successfully.");
      await load();
    } catch (err) {
      setError(getAssessmentError(err));
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <Box className="assessment-loading"><CircularProgress /></Box>;

  return <Box className="assessment-page">
    <Button component={Link} to="/instructor/assessments" startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 2 }}>Back to assessments</Button>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
      <Box>
        <Typography variant="h4" fontWeight={800}>{assessment?.title || `Assessment #${assessmentId}`}</Typography>
        <Typography color="text.secondary">
          {assessment?.course_title || "Course"} · {assessment?.assessment_type || "ASSESSMENT"} · Total marks: {assessment?.total_marks ?? 0}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip label={String(assessment?.status || "DRAFT").toUpperCase()} color={isDraft ? "default" : "success"} />
        {isDraft && (
          <Button variant="contained" color="success" onClick={publishAssessment} disabled={publishing || !attached.length} startIcon={publishing ? <CircularProgress size={18} /> : <PublishRoundedIcon />}>
            {publishing ? "Publishing..." : "Publish assessment"}
          </Button>
        )}
      </Stack>
    </Stack>
    <Typography color="text.secondary" mb={3} mt={1}>
      Add questions, answer options and correct answers. Publish only when every question is complete.
    </Typography>

    <Card className="assessment-panel" sx={{ mb: 3 }}><CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight={800}>Attached questions</Typography>
        <Chip label={`${attached.length} question(s)`} />
      </Stack>
      {attached.length ? attached.map((item, i) => <Box key={item.assessment_question_id ?? item.question_id ?? i} py={2}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
          <Box>
            <Typography fontWeight={700}>
              {item.question_number || i + 1}. {item.question_text || `Question ID ${item.question_id ?? "—"}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {labelForType(item.question_type)} · {item.marks ?? "—"} marks
              {Number(item.negative_marks) > 0 ? ` · -${item.negative_marks} negative` : ""}
              {item.is_mandatory ? " · mandatory" : ""}
            </Typography>
          </Box>
          {isDraft && (
            <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => startEdit(item)}>Edit</Button>
          )}
        </Stack>
        {Array.isArray(item.options) && item.options.length > 0 && (
          <Stack spacing={0.5} mt={1}>
            {item.options.map(option => (
              <Stack key={option.id ?? option.option_code} direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={option.option_code} />
                <Typography variant="body2">{option.option_text}</Typography>
                {option.is_correct && <Chip size="small" color="success" label="Correct answer" />}
              </Stack>
            ))}
          </Stack>
        )}
        {i < attached.length - 1 && <Divider sx={{ mt: 2 }} />}
      </Box>) : <Alert severity="info" sx={{ mt: 2 }}>No questions attached yet.</Alert>}
    </CardContent></Card>

    {isDraft && (
      <Card className="assessment-panel"><CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={800}>{editingQuestionId ? "Edit question" : "Create and attach a question"}</Typography>
          {editingQuestionId && <Button size="small" startIcon={<CloseRoundedIcon />} onClick={resetEditor}>Cancel edit</Button>}
        </Stack>
        <Box component="form" onSubmit={saveQuestion}>
          <Grid container spacing={2}>
            <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Question text" value={question.question_text} onChange={e => setQuestion(p => ({ ...p, question_text: e.target.value }))} required /></Grid>
            <Grid item xs={12} sm={4}><TextField select fullWidth label="Question type" value={question.question_type} onChange={changeQuestionType} disabled={Boolean(editingQuestionId)}>
              <MenuItem value="SINGLE_CHOICE">Single choice</MenuItem>
              <MenuItem value="MULTIPLE_CHOICE">Multiple choice</MenuItem>
              <MenuItem value="TRUE_FALSE">True / False</MenuItem>
              <MenuItem value="SHORT_TEXT">Short text (manual grading)</MenuItem>
              <MenuItem value="LONG_TEXT">Long text (manual grading)</MenuItem>
            </TextField></Grid>
            <Grid item xs={12} sm={4}><TextField select fullWidth label="Difficulty" value={question.difficulty_level} onChange={e => setQuestion(p => ({ ...p, difficulty_level: e.target.value }))}><MenuItem value="EASY">Easy</MenuItem><MenuItem value="MEDIUM">Medium</MenuItem><MenuItem value="HARD">Hard</MenuItem></TextField></Grid>
            <Grid item xs={6} sm={2}><TextField fullWidth type="number" label="Default marks" value={question.default_marks} onChange={e => setQuestion(p => ({ ...p, default_marks: e.target.value }))} inputProps={{ min: 0 }} /></Grid>
            <Grid item xs={6} sm={2}><TextField fullWidth type="number" label="Negative" value={question.negative_marks} onChange={e => setQuestion(p => ({ ...p, negative_marks: e.target.value }))} inputProps={{ min: 0 }} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Explanation shown in review (optional)" value={question.explanation} onChange={e => setQuestion(p => ({ ...p, explanation: e.target.value }))} /></Grid>
          </Grid>

          {isChoice && (
            <>
              <Typography variant="subtitle1" fontWeight={800} mt={3} mb={1}>Answer options</Typography>
              <Stack spacing={1.5}>
                {options.map((option, index) => <Stack key={option.option_code} direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1}>
                  <Chip label={option.option_code} />
                  <TextField fullWidth size="small" label={`Option ${option.option_code}`} value={option.option_text} onChange={e => updateOption(index, "option_text", e.target.value)} />
                  <FormControlLabel control={<Checkbox checked={option.is_correct} onChange={e => updateOption(index, "is_correct", e.target.checked)} />} label="Correct" />
                </Stack>)}
              </Stack>
            </>
          )}

          {isText && <Alert severity="info" sx={{ mt: 2 }}>Text answers are saved by the student and graded manually by you from the results page.</Alert>}

          <Divider sx={{ my: 3 }} />
          <Grid container spacing={2}>
            {!editingQuestionId && <Grid item xs={6} sm={3}><TextField fullWidth type="number" label="Question number" value={questionNumber} onChange={e => setQuestionNumber(e.target.value)} inputProps={{ min: 1 }} /></Grid>}
            <Grid item xs={6} sm={3}><TextField fullWidth type="number" label="Marks in assessment" value={marks} onChange={e => setMarks(e.target.value)} inputProps={{ min: 1 }} disabled={Boolean(editingQuestionId)} /></Grid>
            <Grid item xs={12} sm={6}><FormControlLabel control={<Checkbox checked={mandatory} onChange={e => setMandatory(e.target.checked)} disabled={Boolean(editingQuestionId)} />} label="Mandatory question" /></Grid>
            <Grid item xs={12}><Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={18} /> : <SaveRoundedIcon />}>{saving ? "Saving..." : editingQuestionId ? "Update question" : "Save question and attach"}</Button></Grid>
          </Grid>
        </Box>
      </CardContent></Card>
    )}
  </Box>;
}
