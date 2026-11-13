import { useState } from "react";

import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    CircularProgress,
    Divider,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    MenuItem,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography
} from "@mui/material";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";

import {
    instructorAssessmentApi,
    unwrapAssessmentResponse,
    getAssessmentError
} from "../../../service/AssessmentApi";

import "./Assessment.scss";

// ============================================================
// CONSTANTS
// ============================================================

const EMPTY_FORM = {
    question_text: "",
    question_type: "SINGLE_CHOICE",
    explanation: "",
    default_marks: "1",
    negative_marks: "0",
    difficulty_level: "MEDIUM"
};

const createEmptyOption = (index) => ({
    id: null,
    option_code: String.fromCharCode(65 + index),
    option_text: "",
    display_order: index + 1,
    is_correct: index === 0,
    explanation: ""
});

const INITIAL_OPTIONS = [
    createEmptyOption(0),
    createEmptyOption(1),
    createEmptyOption(2),
    createEmptyOption(3)
];

const CHOICE_TYPES = [
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "TRUE_FALSE"
];

const TEXT_TYPES = [
    "SHORT_TEXT",
    "LONG_TEXT"
];

// ============================================================
// HELPERS
// ============================================================

function getQuestionId(question) {
    return (
        question?.question_id ??
        question?.id ??
        question?.questionId ??
        null
    );
}

function getQuestionOptions(question) {
    return Array.isArray(question?.options)
        ? question.options.map((option, index) => ({
            id: option.id ?? option.option_id ?? null,
            option_code: option.option_code || String.fromCharCode(65 + index),
            option_text: option.option_text || "",
            display_order: Number(option.display_order ?? index + 1),
            is_correct: option.is_correct === true,
            explanation: option.explanation || ""
        }))
        : [];
}

// ============================================================
// QUESTION BANK PAGE
// ============================================================

export default function InstructorQuestionBankPage() {
    const [questionId, setQuestionId] = useState("");
    const [loadedQuestionId, setLoadedQuestionId] = useState(null);

    const [form, setForm] = useState(EMPTY_FORM);
    const [options, setOptions] = useState(INITIAL_OPTIONS);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const isEditing = Boolean(loadedQuestionId);

    const isChoiceQuestion =
        CHOICE_TYPES.includes(form.question_type);

    const isTrueFalse =
        form.question_type === "TRUE_FALSE";

    // --------------------------------------------------------
    // FORM HANDLERS
    // --------------------------------------------------------

    const handleOptionChange = (index, field, value) => {
        setOptions(previous => previous.map((option, optionIndex) =>
            optionIndex === index
                ? { ...option, [field]: value }
                : option
        ));
        setError("");
    };

    const handleSingleCorrectOption = (optionCode) => {
        setOptions(previous => previous.map(option => ({
            ...option,
            is_correct: option.option_code === optionCode
        })));
        setError("");
    };

    const handleMultipleCorrectOption = (index, isCorrect) => {
        setOptions(previous => previous.map((option, optionIndex) =>
            optionIndex === index
                ? { ...option, is_correct: isCorrect }
                : option
        ));
        setError("");
    };

   const handleFormChange = (field) => (event) => {
    const value = event.target.value;

    setForm(previous => ({
        ...previous,
        [field]: value
    }));

    if (field === "question_type") {
        if (value === "TRUE_FALSE") {
            setOptions([
                {
                    id: null,
                    option_code: "TRUE",
                    option_text: "True",
                    display_order: 1,
                    is_correct: true,
                    explanation: ""
                },
                {
                    id: null,
                    option_code: "FALSE",
                    option_text: "False",
                    display_order: 2,
                    is_correct: false,
                    explanation: ""
                }
            ]);
        } else if (
            form.question_type === "TRUE_FALSE" &&
            CHOICE_TYPES.includes(value)
        ) {
            setOptions(INITIAL_OPTIONS);
        }
    }
};

    // --------------------------------------------------------
    // RESET FORM
    // --------------------------------------------------------

    const resetForm = () => {
        setQuestionId("");
        setLoadedQuestionId(null);
        setForm(EMPTY_FORM);
        setOptions(INITIAL_OPTIONS);
        setError("");
        setSuccess("");
    };

    // --------------------------------------------------------
    // LOAD QUESTION BY ID
    // --------------------------------------------------------

    const loadQuestion = async (event) => {
        event.preventDefault();

        if (!/^[1-9]\d*$/.test(String(questionId).trim())) {
            setError("Enter a valid positive question ID.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            setSuccess("");

            const response =
                await instructorAssessmentApi.getQuestion(questionId.trim());

            const question =
                unwrapAssessmentResponse(response);

            if (!question || typeof question !== "object") {
                throw new Error("Question details were not returned by the server.");
            }

            const id = getQuestionId(question);

            if (!id) {
                throw new Error("The returned question does not contain an ID.");
            }

            setLoadedQuestionId(String(id));

            setForm({
                question_text: question.question_text || "",
                question_type: question.question_type || "SINGLE_CHOICE",
                explanation: question.explanation || "",
                default_marks: String(question.default_marks ?? 1),
                negative_marks: String(question.negative_marks ?? 0),
                difficulty_level: question.difficulty_level || "MEDIUM"
            });

            const loadedOptions = getQuestionOptions(question);

            setOptions(
                loadedOptions.length
                    ? loadedOptions
                    : INITIAL_OPTIONS
            );

            setSuccess(`Question ${id} loaded successfully.`);
        } catch (err) {
            setError(getAssessmentError(err));
        } finally {
            setLoading(false);
        }
    };

    // --------------------------------------------------------
    // ADD OPTION
    // --------------------------------------------------------

    const addOption = () => {
        if (isTrueFalse) return;

        setOptions(previous => [
            ...previous,
            {
                id: null,
                option_code: String.fromCharCode(65 + previous.length),
                option_text: "",
                display_order: previous.length + 1,
                is_correct: false,
                explanation: ""
            }
        ]);
    };

    // --------------------------------------------------------
    // REMOVE OPTION
    // --------------------------------------------------------

    const removeOption = (index) => {
        if (isTrueFalse || options.length <= 2) return;

        setOptions(previous =>
            previous
                .filter((_, optionIndex) => optionIndex !== index)
                .map((option, optionIndex) => ({
                    ...option,
                    display_order: optionIndex + 1
                }))
        );
    };

    // --------------------------------------------------------
    // VALIDATE FORM
    // --------------------------------------------------------

    const validateForm = () => {
        if (!form.question_text.trim()) {
            return "Question text is required.";
        }

        if (
            !Number.isFinite(Number(form.default_marks)) ||
            Number(form.default_marks) < 0
        ) {
            return "Default marks must be zero or greater.";
        }

        if (
            !Number.isFinite(Number(form.negative_marks)) ||
            Number(form.negative_marks) < 0
        ) {
            return "Negative marks must be zero or greater.";
        }

        if (isChoiceQuestion) {
            if (options.length < 2) {
                return "At least two options are required.";
            }

            if (options.some(option => !option.option_text.trim())) {
                return "Enter text for every option.";
            }

            const correctCount =
                options.filter(option => option.is_correct).length;

            if (correctCount < 1) {
                return "Select at least one correct option.";
            }

            if (
                form.question_type === "SINGLE_CHOICE" &&
                correctCount !== 1
            ) {
                return "Single-choice questions must have exactly one correct option.";
            }

            if (isTrueFalse && options.length !== 2) {
                return "True/False questions must have exactly two options.";
            }
        }

        return "";
    };

    // --------------------------------------------------------
    // SAVE QUESTION OPTIONS
    // --------------------------------------------------------

    const saveOptions = async (id, existingOptions) => {
        if (!isChoiceQuestion) return;

        const payload = options.map((option, index) => ({
            id: option.id || undefined,
            option_code: option.option_code.trim(),
            option_text: option.option_text.trim(),
            display_order: index + 1,
            is_correct: option.is_correct === true,
            explanation: option.explanation?.trim() || null
        }));

        if (existingOptions) {
            await instructorAssessmentApi.updateOptions(id, payload);
        } else {
            await instructorAssessmentApi.createOptions(id, payload);
        }
    };

    // --------------------------------------------------------
    // CREATE / UPDATE QUESTION
    // --------------------------------------------------------

    const handleSubmit = async (event) => {
        event.preventDefault();

        const validationError = validateForm();

        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const payload = {
                question_text: form.question_text.trim(),
                explanation: form.explanation.trim() || null,
                default_marks: Number(form.default_marks),
                negative_marks: Number(form.negative_marks),
                difficulty_level: form.difficulty_level
            };

            let savedQuestion;
            let id = loadedQuestionId;

            if (isEditing) {
                const response =
                    await instructorAssessmentApi.updateQuestion(
                        loadedQuestionId,
                        payload
                    );

                savedQuestion =
                    unwrapAssessmentResponse(response);

                id = getQuestionId(savedQuestion) || loadedQuestionId;

                // The question type cannot be changed by the current
                // backend updateQuestion service.
            } else {
                const response =
                    await instructorAssessmentApi.createQuestion({
                        ...payload,
                        question_type: form.question_type
                    });

                savedQuestion =
                    unwrapAssessmentResponse(response);

                id = getQuestionId(savedQuestion);

                if (!id) {
                    throw new Error(
                        "Question was created, but the response did not include its ID."
                    );
                }

                setLoadedQuestionId(String(id));
                setQuestionId(String(id));
            }

            if (isChoiceQuestion) {
                // For an existing question, use the loaded options
                // to decide whether to create or update them.
                const hasExistingOptions =
                    isEditing &&
                    Array.isArray(savedQuestion?.options)
                        ? savedQuestion.options.length > 0
                        : isEditing &&
                          options.some(option => option.id);

                await saveOptions(
                    String(id),
                    hasExistingOptions
                );
            }

            setSuccess(
                isEditing
                    ? `Question ${id} updated successfully.`
                    : `Question created successfully. Question ID: ${id}`
            );
        } catch (err) {
            setError(getAssessmentError(err));
        } finally {
            setSaving(false);
        }
    };

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <Box className="assessment-page">

            <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ md: "center" }}
                spacing={2}
                mb={3}
            >
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        Questions
                    </Typography>

                    <Typography color="text.secondary">
                        Create questions, manage answer options and update existing questions.
                    </Typography>
                </Box>

                <Button
                    variant="outlined"
                    startIcon={<RestartAltRoundedIcon />}
                    onClick={resetForm}
                >
                    New Question
                </Button>
            </Stack>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    onClose={() => setError("")}
                >
                    {error}
                </Alert>
            )}

            {success && (
                <Alert
                    severity="success"
                    sx={{ mb: 2 }}
                    onClose={() => setSuccess("")}
                >
                    {success}
                </Alert>
            )}

            {/* QUESTION LOOKUP */}

            <Card className="assessment-panel" sx={{ mb: 3 }}>
                <CardContent>

                    <Typography variant="h6" fontWeight={800} mb={1}>
                        Find Existing Question
                    </Typography>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        mb={2}
                    >
                        Enter a question ID to retrieve and edit that question.
                    </Typography>

                    <Box
                        component="form"
                        onSubmit={loadQuestion}
                    >
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                        >
                            <TextField
                                fullWidth
                                label="Question ID"
                                value={questionId}
                                onChange={event =>
                                    setQuestionId(event.target.value)
                                }
                                placeholder="Enter question ID"
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                disabled={loading || !questionId.trim()}
                                startIcon={
                                    loading
                                        ? <CircularProgress size={18} color="inherit" />
                                        : <SearchRoundedIcon />
                                }
                            >
                                Load Question
                            </Button>
                        </Stack>
                    </Box>

                    {loadedQuestionId && (
                        <Typography
                            variant="body2"
                            color="success.main"
                            mt={1.5}
                            fontWeight={700}
                        >
                            Editing question ID: {loadedQuestionId}
                        </Typography>
                    )}

                </CardContent>
            </Card>

            {/* QUESTION FORM */}

            <Card className="assessment-panel">
                <CardContent>

                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        mb={2}
                    >
                        <AddRoundedIcon color="primary" />

                        <Typography variant="h6" fontWeight={800}>
                            {isEditing ? "Edit Question" : "Create Question"}
                        </Typography>
                    </Stack>

                    <Box
                        component="form"
                        onSubmit={handleSubmit}
                    >

                        <Grid container spacing={2}>

                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={3}
                                    label="Question"
                                    value={form.question_text}
                                    onChange={handleFormChange("question_text")}
                                    required
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Question Type"
                                    value={form.question_type}
                                    onChange={handleFormChange("question_type")}
                                    disabled={isEditing}
                                    helperText={
                                        isEditing
                                            ? "Question type cannot be changed by the current backend API."
                                            : ""
                                    }
                                >
                                    <MenuItem value="SINGLE_CHOICE">
                                        Single Choice
                                    </MenuItem>

                                    <MenuItem value="MULTIPLE_CHOICE">
                                        Multiple Choice
                                    </MenuItem>

                                    <MenuItem value="TRUE_FALSE">
                                        True / False
                                    </MenuItem>

                                    <MenuItem value="SHORT_TEXT">
                                        Short Text
                                    </MenuItem>

                                    <MenuItem value="LONG_TEXT">
                                        Long Text
                                    </MenuItem>
                                </TextField>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Difficulty"
                                    value={form.difficulty_level}
                                    onChange={handleFormChange("difficulty_level")}
                                >
                                    <MenuItem value="EASY">Easy</MenuItem>
                                    <MenuItem value="MEDIUM">Medium</MenuItem>
                                    <MenuItem value="HARD">Hard</MenuItem>
                                </TextField>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    type="number"
                                    label="Default Marks"
                                    value={form.default_marks}
                                    onChange={handleFormChange("default_marks")}
                                    inputProps={{ min: 0, step: "0.01" }}
                                    required
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    type="number"
                                    label="Negative Marks"
                                    value={form.negative_marks}
                                    onChange={handleFormChange("negative_marks")}
                                    inputProps={{ min: 0, step: "0.01" }}
                                    required
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    label="Explanation"
                                    value={form.explanation}
                                    onChange={handleFormChange("explanation")}
                                />
                            </Grid>

                        </Grid>

                        {/* OPTIONS */}

                        {isChoiceQuestion && (
                            <>
                                <Divider sx={{ my: 3 }} />

                                <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    justifyContent="space-between"
                                    alignItems={{ sm: "center" }}
                                    spacing={1}
                                    mb={2}
                                >
                                    <Box>
                                        <Typography variant="h6" fontWeight={800}>
                                            Answer Options
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {form.question_type === "SINGLE_CHOICE"
                                                ? "Select exactly one correct option."
                                                : form.question_type === "MULTIPLE_CHOICE"
                                                    ? "Select all correct options."
                                                    : "Add exactly two options and select the correct answer."}
                                        </Typography>
                                    </Box>

                                    {!isTrueFalse && (
                                        <Button
                                            variant="outlined"
                                            startIcon={<AddRoundedIcon />}
                                            onClick={addOption}
                                        >
                                            Add Option
                                        </Button>
                                    )}
                                </Stack>

                                {form.question_type === "SINGLE_CHOICE" ? (
                                    <FormControl fullWidth>
                                        <RadioGroup
                                            value={
                                                options.find(option => option.is_correct)?.option_code || ""
                                            }
                                            onChange={event => {
                                                // The option text fields are nested inside this group,
                                                // so ignore their bubbled change events.
                                                if (event.target.type === "radio") {
                                                    handleSingleCorrectOption(event.target.value);
                                                }
                                            }}
                                        >
                                            <Stack spacing={2}>
                                                {options.map((option, index) => (
                                                    <Card
                                                        variant="outlined"
                                                        key={`${option.option_code}-${index}`}
                                                    >
                                                        <CardContent>
                                                            <Grid
                                                                container
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                <Grid item xs={1}>
                                                                    <Radio
                                                                        value={option.option_code}
                                                                    />
                                                                </Grid>

                                                                <Grid item xs={3} sm={2}>
                                                                    <TextField
                                                                        fullWidth
                                                                        size="small"
                                                                        label="Code"
                                                                        value={option.option_code}
                                                                        onChange={event =>
                                                                            handleOptionChange(
                                                                                index,
                                                                                "option_code",
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                    />
                                                                </Grid>

                                                                <Grid item xs={8} sm={9}>
                                                                    <TextField
                                                                        fullWidth
                                                                        size="small"
                                                                        label={`Option ${index + 1}`}
                                                                        value={option.option_text}
                                                                        onChange={event =>
                                                                            handleOptionChange(
                                                                                index,
                                                                                "option_text",
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                    />
                                                                </Grid>

                                                                {!isTrueFalse && options.length > 2 && (
                                                                    <Grid item xs={12}>
                                                                        <Button
                                                                            color="error"
                                                                            size="small"
                                                                            startIcon={<DeleteOutlineRoundedIcon />}
                                                                            onClick={() => removeOption(index)}
                                                                        >
                                                                            Remove
                                                                        </Button>
                                                                    </Grid>
                                                                )}
                                                            </Grid>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </Stack>
                                        </RadioGroup>
                                    </FormControl>
                                ) : (
                                    <Stack spacing={2}>
                                        {options.map((option, index) => (
                                            <Card
                                                variant="outlined"
                                                key={`${option.option_code}-${index}`}
                                            >
                                                <CardContent>
                                                    <Grid
                                                        container
                                                        spacing={1}
                                                        alignItems="center"
                                                    >
                                                        <Grid item xs={1}>
                                                            <Checkbox
                                                                checked={option.is_correct}
                                                                onChange={event =>
                                                                    handleMultipleCorrectOption(
                                                                        index,
                                                                        event.target.checked
                                                                    )
                                                                }
                                                            />
                                                        </Grid>

                                                        <Grid item xs={3} sm={2}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                label="Code"
                                                                value={option.option_code}
                                                                onChange={event =>
                                                                    handleOptionChange(
                                                                        index,
                                                                        "option_code",
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        </Grid>

                                                        <Grid item xs={8} sm={9}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                label={`Option ${index + 1}`}
                                                                value={option.option_text}
                                                                onChange={event =>
                                                                    handleOptionChange(
                                                                        index,
                                                                        "option_text",
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                        </Grid>

                                                        {!isTrueFalse && options.length > 2 && (
                                                            <Grid item xs={12}>
                                                                <Button
                                                                    color="error"
                                                                    size="small"
                                                                    startIcon={<DeleteOutlineRoundedIcon />}
                                                                    onClick={() => removeOption(index)}
                                                                >
                                                                    Remove
                                                                </Button>
                                                            </Grid>
                                                        )}
                                                    </Grid>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Stack>
                                )}
                            </>
                        )}

                        {/* ACTIONS */}

                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1.5}
                            mt={3}
                        >
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={saving}
                                startIcon={
                                    saving
                                        ? <CircularProgress size={18} color="inherit" />
                                        : <SaveRoundedIcon />
                                }
                            >
                                {saving
                                    ? "Saving..."
                                    : isEditing
                                        ? "Update Question"
                                        : "Create Question"}
                            </Button>

                            <Button
                                type="button"
                                variant="outlined"
                                color="inherit"
                                onClick={resetForm}
                            >
                                Clear Form
                            </Button>
                        </Stack>

                    </Box>
                </CardContent>
            </Card>

            <Alert severity="info" sx={{ mt: 3 }}>
                The current backend supports question creation, individual question lookup,
                question updates, and option management. A question-list endpoint is required
                before this page can display all saved questions in a table.
            </Alert>

        </Box>
    );
}
