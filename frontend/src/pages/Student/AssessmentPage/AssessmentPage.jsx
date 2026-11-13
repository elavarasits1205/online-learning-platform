import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import api from "../../../service/Api";
import "./AssessmentPage.scss";

const DEFAULT_MAX_ATTEMPTS = 5;

function getResponseData(response) {
    return response?.data?.data ?? response?.data ?? {};
}

function formatTimeRemaining(seconds) {
    if (seconds === null || seconds === undefined) return "No time limit";

    const safeSeconds = Math.max(0, Number(seconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;
    const paddedMinutes = String(minutes).padStart(2, "0");
    const paddedSeconds = String(remainingSeconds).padStart(2, "0");

    return hours > 0
        ? `${hours}:${paddedMinutes}:${paddedSeconds}`
        : `${paddedMinutes}:${paddedSeconds}`;
}

function getAttemptDetails(assessment = {}) {
    const configuredMax = Number(
        assessment.maxAttempts ??
        assessment.max_attempts ??
        DEFAULT_MAX_ATTEMPTS
    );
    const maxAttempts = Number.isFinite(configuredMax) && configuredMax > 0
        ? Math.min(configuredMax, DEFAULT_MAX_ATTEMPTS)
        : DEFAULT_MAX_ATTEMPTS;

    const attemptsUsed = Math.max(0, Number(
        assessment.attemptsUsed ??
        assessment.attempts_used ??
        assessment.lastAttemptNumber ??
        assessment.last_attempt_number ??
        0
    ));

    const status = String(assessment.status ?? "NOT_STARTED").toUpperCase();
    const hasPassed = assessment.hasPassed === true ||
        assessment.has_passed === true ||
        status === "PASSED";

    const remainingAttempts = Math.max(0, Number(
        assessment.remainingAttempts ??
        assessment.remaining_attempts ??
        maxAttempts - attemptsUsed
    ));

    const canAttempt = assessment.canAttempt ??
        assessment.can_attempt ??
        (!hasPassed && remainingAttempts > 0);

    return {
        maxAttempts,
        attemptsUsed,
        remainingAttempts,
        hasPassed,
        canAttempt: Boolean(canAttempt) && !hasPassed &&
            (remainingAttempts > 0 || status === "IN_PROGRESS"),
        status: hasPassed ? "PASSED" : status,
    };
}

export default function AssessmentPage() {
    const { courseId, assessmentId } = useParams();

    const [assessment, setAssessment] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [attemptId, setAttemptId] = useState(null);
    const [deadlineAt, setDeadlineAt] = useState(null);
    const [remainingSeconds, setRemainingSeconds] = useState(null);
    const answerSavePromisesRef = useRef(new Map());
    const submitRef = useRef(null);
    const timedSubmissionStartedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        async function loadAssessment() {
            setLoading(true);
            setError("");
            setAssessment(null);
            setQuestions([]);
            setAnswers({});
            setResult(null);
            setAttemptId(null);
            setDeadlineAt(null);
            setRemainingSeconds(null);
            answerSavePromisesRef.current.clear();
            timedSubmissionStartedRef.current = false;

            try {
                const response = await api.get(
                    `/student/assessments/${encodeURIComponent(assessmentId)}`
                );
                const data = getResponseData(response);

                if (cancelled) return;

                const assessmentData = data.assessment ?? data;
                const existingAttempt = data.in_progress_attempt;
                let activeAttemptId = existingAttempt?.attempt_id ?? null;
                let activeAttempt = existingAttempt;
                let startedNow = false;
                const bestAttemptPassed = data.best_attempt?.status === "EVALUATED" &&
                    (data.best_attempt?.passed === true ||
                        String(data.best_attempt?.passed).toLowerCase() === "true");

                if (
                    !activeAttemptId &&
                    data.can_start !== false &&
                    !bestAttemptPassed
                ) {
                    const startResponse = await api.post(
                        `/student/assessments/${encodeURIComponent(assessmentId)}/start`
                    );
                    const startData = getResponseData(startResponse);
                    activeAttemptId = startData.attempt_id ?? startData.attempt?.attempt_id;
                    activeAttempt = startData;
                    startedNow = true;
                }

                const latestAttempt = data.latest_attempt ?? null;
                const latestAttemptStatus = String(
                    latestAttempt?.status || ""
                ).toUpperCase();
                const hasPassed = bestAttemptPassed ||
                    (latestAttemptStatus === "EVALUATED" && (
                        latestAttempt?.passed === true ||
                        String(latestAttempt?.passed).toLowerCase() === "true"
                    ));
                const remainingFromServer = data.attempts_remaining == null
                    ? null
                    : Math.max(
                        0,
                        Number(data.attempts_remaining) - (startedNow ? 1 : 0)
                    );
                let assessmentState = {
                    ...assessmentData,
                    attemptsUsed: Number(
                        activeAttempt?.attempt_number ?? data.attempt_count ?? 0
                    ),
                    remainingAttempts: remainingFromServer ?? undefined,
                    canAttempt: Boolean(activeAttemptId),
                    hasPassed,
                    status: hasPassed
                        ? "PASSED"
                        : latestAttemptStatus === "SUBMITTED"
                            ? "SUBMITTED"
                            : activeAttempt?.status ?? latestAttempt?.status ?? "NOT_STARTED",
                    latestAttempt,
                    bestAttempt: data.best_attempt ?? null,
                };
                let questionData = Array.isArray(data.questions) ? data.questions : [];

                if (activeAttemptId) {
                    const attemptResponse = await api.get(
                        `/student/assessments/attempts/${encodeURIComponent(activeAttemptId)}`
                    );
                    const attemptData = getResponseData(attemptResponse);
                    const attempt = attemptData.attempt ?? {};

                    activeAttemptId = attempt.attempt_id ?? activeAttemptId;
                    assessmentState = {
                        ...assessmentState,
                        attemptsUsed: Number(
                            attempt.attempt_number ?? assessmentState.attemptsUsed
                        ),
                        status: String(attempt.status ?? "IN_PROGRESS").toUpperCase(),
                        canAttempt: String(attempt.status ?? "IN_PROGRESS").toUpperCase() === "IN_PROGRESS",
                    };
                    questionData = Array.isArray(attemptData.questions)
                        ? attemptData.questions
                        : questionData;

                    const initialAnswers = {};
                    for (const question of questionData) {
                        const questionId = question.id ?? question.question_id;
                        const selected = question.selected_option_ids;
                        if (Array.isArray(selected) && selected.length > 0) {
                            initialAnswers[questionId] = selected[0];
                        }
                    }
                    setAnswers(initialAnswers);
                    setAttemptId(String(activeAttemptId));

                    const durationMinutes = Number(
                        attempt.duration_minutes ??
                        activeAttempt?.duration_minutes ??
                        assessmentState.duration_minutes
                    );
                    const providedEnd = attempt.ends_at ?? activeAttempt?.ends_at;
                    const startedAt = attempt.started_at ?? activeAttempt?.started_at;
                    const deadline = providedEnd
                        ? new Date(providedEnd).getTime()
                        : startedAt && Number.isFinite(durationMinutes) && durationMinutes > 0
                            ? new Date(startedAt).getTime() + durationMinutes * 60 * 1000
                            : null;

                    if (Number.isFinite(deadline)) {
                        setDeadlineAt(deadline);
                        setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
                    } else {
                        setDeadlineAt(null);
                        setRemainingSeconds(null);
                    }
                } else {
                    setAnswers({});
                    setAttemptId(null);
                    setDeadlineAt(null);
                    setRemainingSeconds(null);
                }

                setAssessment(assessmentState);
                setQuestions(questionData);
            } catch (err) {
                if (cancelled) return;
                setError(
                    err.response?.data?.message ||
                    "Assessment could not be loaded. Please try again later."
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        if (assessmentId) {
            loadAssessment();
        }

        return () => {
            cancelled = true;
        };
    }, [assessmentId]);

    const attemptDetails = useMemo(
        () => getAttemptDetails(assessment ?? {}),
        [assessment]
    );

    const latestAttempt = assessment?.latestAttempt ?? assessment?.latest_attempt ?? null;
    const latestAttemptStatus = String(latestAttempt?.status || "").toUpperCase();
    const pendingResultAttemptId = String(result?.status || "").toUpperCase() === "SUBMITTED"
        ? result.attempt_id ?? attemptId
        : !result && latestAttemptStatus === "SUBMITTED"
            ? latestAttempt.attempt_id ?? latestAttempt.id
            : null;

    useEffect(() => {
        if (!pendingResultAttemptId) return undefined;

        let cancelled = false;
        let timerId;

        async function refreshPendingResult() {
            try {
                const response = await api.get(
                    `/student/assessments/attempts/${encodeURIComponent(pendingResultAttemptId)}/result`
                );
                const latestResult = getResponseData(response);

                if (cancelled) return;

                const status = String(latestResult.status || "").toUpperCase();
                if (status === "EVALUATED") {
                    const resultPassed = latestResult.passed === true ||
                        String(latestResult.passed).toLowerCase() === "true";
                    setResult(latestResult);
                    setAssessment((current) => current ? {
                        ...current,
                        hasPassed: resultPassed,
                        status: resultPassed ? "PASSED" : "EVALUATED",
                        latestAttempt: {
                            ...(current.latestAttempt ?? current.latest_attempt ?? {}),
                            ...latestResult,
                        },
                        bestAttempt: (() => {
                            const previousBest = current.bestAttempt ?? current.best_attempt ?? null;
                            const previousBestPercentage = Number(previousBest?.percentage ?? -1);
                            const evaluatedPercentage = Number(latestResult.percentage ?? -1);
                            return !previousBest || evaluatedPercentage > previousBestPercentage
                                ? latestResult
                                : previousBest;
                        })(),
                        canAttempt: !resultPassed &&
                            Number(current.remainingAttempts ?? current.remaining_attempts ?? 0) > 0,
                    } : current);
                    return;
                }

                if (status === "SUBMITTED") {
                    setResult((current) => current || latestResult);
                }
            } catch {
                // Keep the submitted state visible and retry on the next poll.
            }

            if (!cancelled) {
                timerId = window.setTimeout(refreshPendingResult, 5000);
            }
        }

        refreshPendingResult();

        return () => {
            cancelled = true;
            window.clearTimeout(timerId);
        };
    }, [pendingResultAttemptId]);

    useEffect(() => {
        if (!Number.isFinite(deadlineAt)) return undefined;

        const updateRemainingTime = () => {
            const nextRemaining = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
            setRemainingSeconds((current) => current === nextRemaining ? current : nextRemaining);
        };

        updateRemainingTime();
        const intervalId = window.setInterval(updateRemainingTime, 1000);
        return () => window.clearInterval(intervalId);
    }, [deadlineAt]);

    const answeredCount = Object.keys(answers).length;
    const passPercentage = Number(assessment?.pass_percentage ?? 70);
    const courseUrl = `/student/learning/${encodeURIComponent(courseId ?? "")}`;

    function handleAnswerChange(questionId, optionId) {
        if (!attemptId || remainingSeconds === 0 || submitting) return;

        setAnswers((previous) => ({
            ...previous,
            [questionId]: optionId,
        }));
        setError("");

        const answerKey = String(questionId);
        const previousSave = answerSavePromisesRef.current.get(answerKey) ?? Promise.resolve();
        const pendingSave = previousSave.catch(() => undefined).then(() => api.post(
            `/student/assessments/attempts/${encodeURIComponent(attemptId)}/answers`,
            {
                question_id: answerKey,
                selected_option_ids: [String(optionId)],
            }
        )).catch((err) => {
            setError(
                err.response?.data?.message ||
                "Your answer could not be saved. Please try again."
            );
        }).finally(() => {
            if (answerSavePromisesRef.current.get(answerKey) === pendingSave) {
                answerSavePromisesRef.current.delete(answerKey);
            }
        });

        answerSavePromisesRef.current.set(answerKey, pendingSave);
    }

    async function handleSubmit(event, { timedOut = remainingSeconds === 0 } = {}) {
        event?.preventDefault();

        if (submitting || result || !attemptDetails.canAttempt) return;

        const unanswered = questions.filter((question) => {
            const questionId = question.id ?? question.question_id;
            return answers[questionId] === undefined || answers[questionId] === null;
        });

        if (!timedOut && unanswered.length > 0) {
            setError(
                `Please answer all questions. ${unanswered.length} question(s) remaining.`
            );
            return;
        }

        setError("");
        setSubmitting(true);

        try {
            if (!attemptId) {
                throw new Error("Assessment attempt is unavailable. Reload the page and try again.");
            }

            await Promise.allSettled(Array.from(answerSavePromisesRef.current.values()));

            if (!timedOut) {
                await Promise.all(questions.map((question) => {
                    const questionId = question.id ?? question.question_id;
                    return api.post(
                        `/student/assessments/attempts/${encodeURIComponent(attemptId)}/answers`,
                        {
                            question_id: String(questionId),
                            selected_option_ids: [String(answers[questionId])],
                        }
                    );
                }));
            }

            const response = await api.post(
                `/student/assessments/attempts/${encodeURIComponent(attemptId)}/submit`
            );

            const data = getResponseData(response);
            const submittedResult = data.result ?? data;
            setResult(submittedResult);
            if (String(submittedResult.status ?? "").toUpperCase() === "EVALUATED") {
                const resultPassed = submittedResult.passed === true ||
                    String(submittedResult.passed).toLowerCase() === "true";
                setAssessment((current) => current ? {
                    ...current,
                    hasPassed: resultPassed,
                    status: resultPassed ? "PASSED" : "EVALUATED",
                    latestAttempt: submittedResult,
                    bestAttempt: resultPassed ? submittedResult : current.bestAttempt,
                } : current);
            }
        } catch (err) {
            const statusCode = err.response?.status;
            const message = err.response?.data?.message ||
                "Submission failed. Please try again.";

            if (statusCode === 409) {
                setAssessment((previous) => ({
                    ...previous,
                    hasPassed: true,
                    status: "PASSED",
                    canAttempt: false,
                }));
            }

            setError(message);
        } finally {
            setSubmitting(false);
        }
    }

    useEffect(() => {
        submitRef.current = handleSubmit;
    });

    useEffect(() => {
        if (
            remainingSeconds !== 0 ||
            !attemptId ||
            questions.length === 0 ||
            result ||
            submitting ||
            !attemptDetails.canAttempt ||
            timedSubmissionStartedRef.current
        ) {
            return;
        }

        timedSubmissionStartedRef.current = true;
        submitRef.current?.(null, { timedOut: true });
    }, [remainingSeconds, attemptId, questions.length, result, submitting, attemptDetails.canAttempt]);

    if (loading && assessmentId) {
        return (
            <main className="assessment-page student-page student-page--inset">
                <div className="assessment-state">
                    <div className="assessment-spinner" />
                    <p>Loading assessment...</p>
                </div>
            </main>
        );
    }

    if ((error || !assessmentId) && !assessment) {
        return (
            <main className="assessment-page student-page student-page--inset">
                <div className="assessment-state">
                    <div className="assessment-state-icon">!</div>
                    <h2>Unable to open assessment</h2>
                    <p>{error || "Assessment ID is missing."}</p>
                    <Link className="assessment-button" to={courseUrl}>Back to Course</Link>
                </div>
            </main>
        );
    }

    if (!assessment) {
        return (
            <main className="assessment-page student-page student-page--inset">
                <div className="assessment-state">
                    <h2>Assessment not found</h2>
                    <p>This assessment may be unavailable or unpublished.</p>
                    <Link className="assessment-button" to={courseUrl}>Back to Course</Link>
                </div>
            </main>
        );
    }

    const title = assessment.title ?? "Assessment";
    const duration = assessment.duration_minutes;
    const totalMarks = assessment.total_marks;

    if (result) {
        const resultStatus = String(result.status || "").toUpperCase();
        if (resultStatus !== "EVALUATED") {
            return (
                <main className="assessment-page student-page student-page--inset">
                    <section className="assessment-result">
                        <div className="assessment-result-icon">…</div>
                        <p className="assessment-eyebrow">AWAITING INSTRUCTOR EVALUATION</p>
                        <h1>Submission received</h1>
                        <p className="assessment-result-description">
                            Your written answers are being evaluated. This page will update automatically when your instructor publishes the result.
                        </p>
                        <div className="assessment-score">
                            <span>Result status</span>
                            <strong>Pending</strong>
                            <span>Please keep this page open or return later.</span>
                        </div>
                        <Link className="assessment-button" to={courseUrl}>Back to Course</Link>
                    </section>
                </main>
            );
        }

        const percentage = Number(result.percentage ?? result.score_percentage ?? 0);
        const passed = percentage >= passPercentage;
        const remaining = Number(
            result.remainingAttempts ??
            result.remaining_attempts ??
            attemptDetails.remainingAttempts
        );

        return (
            <main className="assessment-page student-page student-page--inset">
                <section className="assessment-result">
                    <div className={`assessment-result-icon ${passed ? "is-pass" : "is-fail"}`}>
                        {passed ? "✓" : "×"}
                    </div>
                    <p className="assessment-eyebrow">ASSESSMENT RESULT</p>
                    <h1>{passed ? "Congratulations!" : "Keep practising"}</h1>
                    <p className="assessment-result-description">
                        {passed
                            ? "You passed this assessment. Retakes are now locked."
                            : "You did not reach the required passing score."}
                    </p>

                    <div className="assessment-score">
                        <span>Your score</span>
                        <strong>{percentage.toFixed(1)}%</strong>
                        <span>Required to pass: {passPercentage}%</span>
                    </div>

                    {result.obtainedMarks != null || result.obtained_marks != null ? (
                        <p className="assessment-marks">
                            Marks: {result.obtainedMarks ?? result.obtained_marks} / {result.totalMarks ?? result.total_marks ?? totalMarks}
                        </p>
                    ) : null}

                    <div className={`assessment-result-status ${passed ? "is-pass" : "is-fail"}`}>
                        {passed ? "Assessment passed" : "Assessment not passed"}
                    </div>

                    <div className="assessment-attempt-summary">
                        <span>Attempt: {result.attemptNumber ?? result.attempt_number ?? attemptDetails.attemptsUsed + 1} / {result.maxAttempts ?? result.max_attempts ?? attemptDetails.maxAttempts}</span>
                        {passed ? (
                            <strong>Retakes locked</strong>
                        ) : (
                            <strong>{Math.max(0, remaining)} attempts remaining</strong>
                        )}
                    </div>

                    <Link className="assessment-button" to={courseUrl}>Back to Course</Link>
                </section>
            </main>
        );
    }

    if (!attemptDetails.canAttempt) {
        if (latestAttemptStatus === "SUBMITTED" && latestAttempt) {
            const pendingAttemptId = latestAttempt.attempt_id ?? latestAttempt.id;

            return (
                <main className="assessment-page student-page student-page--inset">
                    <section className="assessment-result">
                        <div className="assessment-result-icon">…</div>
                        <p className="assessment-eyebrow">AWAITING INSTRUCTOR EVALUATION</p>
                        <h1>Submission received</h1>
                        <p className="assessment-result-description">
                            Your instructor is reviewing your written answers. This page will show the final score automatically when the evaluation is published.
                        </p>
                        <div className="assessment-attempt-summary">
                            <span>Attempt: {latestAttempt.attempt_number ?? attemptDetails.attemptsUsed}</span>
                            <strong>Result pending</strong>
                        </div>
                        {pendingAttemptId && (
                            <Link
                                className="assessment-button"
                                to={`/student/assessments/attempts/${encodeURIComponent(pendingAttemptId)}/result`}
                            >
                                Open Result Page
                            </Link>
                        )}
                    </section>
                </main>
            );
        }

        const lockedByPass = attemptDetails.hasPassed || attemptDetails.status === "PASSED";
        const displayedAttempt = lockedByPass
            ? assessment.bestAttempt ?? assessment.best_attempt ?? latestAttempt
            : latestAttempt;
        const latestPercentage = Number(
            displayedAttempt?.percentage ?? displayedAttempt?.scorePercentage ?? 0
        );
        const latestObtainedMarks =
            displayedAttempt?.obtainedMarks ?? displayedAttempt?.obtained_marks;
        const latestTotalMarks =
            displayedAttempt?.totalMarks ?? displayedAttempt?.total_marks ?? totalMarks;
        const latestAttemptNumber =
            displayedAttempt?.attemptNumber ?? displayedAttempt?.attempt_number ?? attemptDetails.attemptsUsed;
        const hasEvaluatedAttempt =
            String(displayedAttempt?.status || "").toUpperCase() === "EVALUATED";
        const displayedAttemptPassed = latestPercentage >= passPercentage;

        return (
            <main className="assessment-page student-page student-page--inset">
                <section className={`assessment-locked-card ${lockedByPass ? "is-passed" : "is-exhausted"}`}>
                    <div className={`assessment-result-icon ${displayedAttemptPassed ? "is-pass" : "is-fail"}`}>
                        {hasEvaluatedAttempt ? displayedAttemptPassed ? "✓" : "×" : "🔒"}
                    </div>
                    <p className="assessment-eyebrow">
                        {hasEvaluatedAttempt ? "FINAL ASSESSMENT RESULT" : "ASSESSMENT STATUS"}
                    </p>
                    <h1>{displayedAttemptPassed ? "Congratulations!" : "Attempt limit reached"}</h1>
                    <p className="assessment-result-description">
                        {hasEvaluatedAttempt
                            ? displayedAttemptPassed
                                ? "You passed this assessment. You can continue learning with your course."
                                : "Your instructor evaluated this attempt. Review your final score below."
                            : "You have used all available attempts for this assessment."}
                    </p>

                    {hasEvaluatedAttempt ? (
                        <>
                            <div className="assessment-score">
                                <span>{lockedByPass && String(displayedAttempt?.attempt_id) !== String(latestAttempt?.attempt_id) ? "Your best score" : "Your latest score"}</span>
                                <strong>{latestPercentage.toFixed(1)}%</strong>
                                <span>Required to pass: {passPercentage}%</span>
                            </div>

                            {latestObtainedMarks != null && latestTotalMarks != null && (
                                <p className="assessment-marks">
                                    Marks: {latestObtainedMarks} / {latestTotalMarks}
                                </p>
                            )}

                            <div className={`assessment-result-status ${displayedAttemptPassed ? "is-pass" : "is-fail"}`}>
                                {displayedAttemptPassed ? "Assessment passed" : "Assessment not passed"}
                            </div>
                            <div className="assessment-attempt-summary">
                                <span>
                                    Attempt: {latestAttemptNumber} / {attemptDetails.maxAttempts}
                                </span>
                                <strong>{lockedByPass ? "Retakes locked" : "No attempts remaining"}</strong>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={`assessment-status-pill ${lockedByPass ? "is-pass" : "is-fail"}`}>
                                {lockedByPass ? "PASSED" : "ATTEMPTS EXHAUSTED"}
                            </div>
                            <p className="assessment-attempt-summary">
                                Attempts used: {attemptDetails.attemptsUsed} / {attemptDetails.maxAttempts}
                            </p>
                        </>
                    )}

                    <Link className="assessment-button" to={courseUrl}>
                        Continue Learning
                    </Link>
                </section>
            </main>
        );
    }

    if (questions.length === 0) {
        return (
            <main className="assessment-page student-page student-page--inset">
                <div className="assessment-state">
                    <div className="assessment-state-icon">i</div>
                    <h2>Questions are not available yet</h2>
                    <p>This assessment has no questions available to display. Please check again when the instructor publishes it.</p>
                    <Link className="assessment-button" to={courseUrl}>Back to Course</Link>
                </div>
            </main>
        );
    }

    return (
        <main className="assessment-page student-page student-page--inset">
            <header className="assessment-header">
                <nav className="assessment-navigation" aria-label="Assessment navigation">
                    <Link className="assessment-back-link" to={courseUrl}>
                        <ArrowBackRoundedIcon fontSize="small" />
                        <span>Back to learning</span>
                    </Link>
                    <div
                        className={`assessment-countdown${remainingSeconds !== null && remainingSeconds <= 60 ? " is-urgent" : ""}`}
                        role="timer"
                        aria-label={remainingSeconds === null
                            ? "This assessment has no time limit"
                            : `${formatTimeRemaining(remainingSeconds)} remaining`}
                    >
                        <AccessTimeRoundedIcon aria-hidden="true" />
                        <div>
                            <span>TIME REMAINING</span>
                            <strong>{formatTimeRemaining(remainingSeconds)}</strong>
                        </div>
                    </div>
                </nav>

                <div className="assessment-heading">
                    <div className="assessment-heading-copy">
                        <p className="assessment-eyebrow">COURSE ASSESSMENT</p>
                        <h1>{title}</h1>
                        {assessment.description && <p>{assessment.description}</p>}
                    </div>
                    <div className="assessment-heading-mark" aria-hidden="true">A</div>
                </div>

                <div className="assessment-meta">
                    <span>{questions.length} Questions</span>
                    {duration != null && <span>{duration} Minutes</span>}
                    {totalMarks != null && <span>{totalMarks} Marks</span>}
                    <span>Pass: {passPercentage}%</span>
                </div>

                <div className="assessment-attempt-panel">
                    <div>
                        <span className="assessment-attempt-label">ATTEMPT STATUS</span>
                        <strong>{attemptDetails.attemptsUsed} / {attemptDetails.maxAttempts} used</strong>
                    </div>
                    <div>
                        <span className="assessment-attempt-label">REMAINING</span>
                        <strong>{attemptDetails.remainingAttempts}</strong>
                    </div>
                    <span className="assessment-status-pill is-available">{attemptDetails.attemptsUsed > 0 ? "RETAKE AVAILABLE" : "NOT STARTED"}</span>
                </div>
            </header>

            <form className="assessment-form" onSubmit={handleSubmit}>
                <div className="assessment-progress">
                    <div>
                        <strong>{answeredCount} of {questions.length}</strong>
                        <span> answered</span>
                    </div>
                    <div className="assessment-progress-track">
                        <div
                            className="assessment-progress-fill"
                            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                        />
                    </div>
                </div>

                {questions.map((question, index) => {
                    const questionId = question.id ?? question.question_id;
                    const options = Array.isArray(question.options) ? question.options : [];

                    return (
                        <section className="assessment-question" key={questionId}>
                            <div className="assessment-question-top">
                                <span className="assessment-question-number">Question {index + 1}</span>
                                {question.marks != null && (
                                    <span className="assessment-question-marks">{question.marks} marks</span>
                                )}
                            </div>
                            <h2>{question.question_text ?? question.text ?? "Question text unavailable"}</h2>
                            <div className="assessment-options">
                                {options.map((option, optionIndex) => {
                                    const optionId = option.id ?? option.option_id;
                                    const selected = String(answers[questionId] ?? "") === String(optionId);

                                    return (
                                        <label
                                            key={optionId}
                                            className={`assessment-option${selected ? " is-selected" : ""}${submitting || remainingSeconds === 0 || !attemptDetails.canAttempt ? " is-disabled" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name={`question-${questionId}`}
                                                value={optionId}
                                                checked={selected}
                                                disabled={submitting || remainingSeconds === 0 || !attemptDetails.canAttempt}
                                                onChange={() => handleAnswerChange(questionId, optionId)}
                                            />
                                            <span className="assessment-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                                            <span>{option.option_text ?? option.text ?? "Option"}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}

                {error && <div className="assessment-inline-error" role="alert">{error}</div>}

                <footer className="assessment-submit-bar">
                    <div className="assessment-submit-summary">
                        <strong>{answeredCount} of {questions.length} answered</strong>
                        <span>{remainingSeconds === 0
                            ? "Time is up. Submitting your saved answers."
                            : "Your answers save automatically as you go."}</span>
                    </div>
                    <button type="submit" className="assessment-button" disabled={submitting || !attemptDetails.canAttempt}>
                        {submitting
                            ? "Submitting..."
                            : remainingSeconds === 0
                                ? "Retry submission"
                                : "Submit assessment"}
                    </button>
                </footer>
            </form>
        </main>
    );
}
