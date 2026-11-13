import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  LinearProgress,
  Typography,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";

import {
  Award,
  BookOpen,
  CheckCircle2,
  CirclePlay,
  Download,
  Eye,
  Search,
} from "lucide-react";

import api from "../../../service/Api";
import { calculateCourseProgress } from "../../../utils/courseProgress";
import LearnovaBackNavigation from "../../../component/LearnovaBackNavigation";
import "./MyLearning.scss";

// Get the available course thumbnail.
const getCourseImage = (course) =>
  course?.thumbnail_url ||
  course?.thumbnailUrl ||
  course?.thumbnail ||
  course?.image_url ||
  course?.imageUrl ||
  "";

// Extract enrollment ID from supported API response formats.
const getEnrollmentId = (enrollment) =>
  enrollment?.enrollment_id ?? enrollment?.enrollmentId ?? enrollment?.id;

const getCourseId = (enrollment) =>
  enrollment?.course_id ?? enrollment?.courseId ?? enrollment?.course?.id;

const isCertificateEligible = (eligibility) =>
  eligibility?.is_eligible === true || eligibility?.isEligible === true;

export default function MyLearning() {
  const navigate = useNavigate();
  const location = useLocation();

  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [progressByCourse, setProgressByCourse] = useState({});

  // Store certificate eligibility and existing certificate details.
  const [certificateEligibility, setCertificateEligibility] = useState({});

  // Store certificate generation and download loading states.
  const [certificateLoading, setCertificateLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  // Fetch enrolled courses for the logged-in student.
  const loadEnrollments = useCallback(async () => {
    setLoading(true);
    setError("");
    setProgressByCourse({});
    setCertificateEligibility({});

    try {
      const response = await api.get("/student/enrollments");

      const payload = response.data?.data ?? response.data;

      const rows = payload?.enrollments ?? payload?.items ?? [];

      setEnrollments(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("Failed to load My Learning:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load your enrolled courses. Please try again.",
      );

      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  // Fetch learning progress for every enrolled course.
  useEffect(() => {
    let cancelled = false;

    async function loadCourseProgress() {
      const courseIds = [
        ...new Set(
          enrollments
            .map(
              (enrollment) =>
                enrollment.course_id ??
                enrollment.courseId ??
                enrollment.course?.id,
            )
            .filter(
              (id) =>
                id !== null && id !== undefined && String(id).trim() !== "",
            )
            .map(String),
        ),
      ];

      if (courseIds.length === 0) return;

      const initialProgress = {};

      courseIds.forEach((courseId) => {
        initialProgress[courseId] = {
          loading: true,
          data: null,
          error: false,
        };
      });

      if (!cancelled) {
        setProgressByCourse(initialProgress);
      }

      const results = await Promise.allSettled(
        courseIds.map(async (courseId) => {
          const response = await api.get(
            `/student/learning/courses/${encodeURIComponent(courseId)}`,
          );

          const payload = response.data?.data ?? response.data;

          return {
            courseId,
            progress: calculateCourseProgress(payload),
          };
        }),
      );

      if (cancelled) return;

      setProgressByCourse((current) => {
        const updated = { ...current };

        results.forEach((result, index) => {
          const courseId = courseIds[index];

          if (result.status === "fulfilled") {
            updated[courseId] = {
              loading: false,
              data: result.value.progress,
              error: false,
            };
          } else {
            console.error(
              `Failed to load progress for course ${courseId}:`,
              result.reason,
            );

            updated[courseId] = {
              loading: false,
              data: null,
              error: true,
            };
          }
        });

        return updated;
      });
    }

    if (!loading && enrollments.length > 0) {
      loadCourseProgress();
    }

    return () => {
      cancelled = true;
    };
  }, [enrollments, loading]);

  // Load existing certificates and automatically issue one for a completed
  // course if the completion request could not finish certificate preparation.
  useEffect(() => {
    let cancelled = false;

    async function loadCertificates() {
      const validEnrollments = enrollments.filter((enrollment) => {
        const id = getEnrollmentId(enrollment);

        return id !== null && id !== undefined && String(id).trim() !== "";
      });

      if (validEnrollments.length === 0) return;

      const waitingForProgress = validEnrollments.some((enrollment) => {
        const courseId = getCourseId(enrollment);
        if (courseId === null || courseId === undefined || courseId === "") {
          return false;
        }
        const progress = progressByCourse[String(courseId)];
        return !progress || progress.loading;
      });

      const initialState = {};

      validEnrollments.forEach((enrollment) => {
        const enrollmentId = String(getEnrollmentId(enrollment));

        initialState[enrollmentId] = {
          loading: true,
          eligibility: null,
          certificate: null,
          error: false,
        };
      });

      if (!cancelled) {
        setCertificateEligibility(initialState);
      }

      if (waitingForProgress) return;

      await Promise.all(
        validEnrollments.map(async (enrollment) => {
          const enrollmentId = String(getEnrollmentId(enrollment));
          const courseId = getCourseId(enrollment);
          const courseProgress = courseId
            ? progressByCourse[String(courseId)]?.data
            : null;
          const courseCompleted =
            String(courseProgress?.status || "").toUpperCase() === "COMPLETED";
          let eligibility = null;
          let certificate = null;
          let failed = false;

          try {
            const certificateResponse = await api.get(
              `/student/certificates/by-enrollment/${encodeURIComponent(enrollmentId)}`,
            );
            certificate = certificateResponse.data?.data ?? null;
          } catch (certificateError) {
            failed = true;
            console.error("Certificate lookup failed:", certificateError);
          }

          if (courseCompleted) {
            try {
              const eligibilityResponse = await api.get(
                `/student/certificates/eligibility/${encodeURIComponent(enrollmentId)}`,
              );
              eligibility = eligibilityResponse.data?.data ?? null;

              if (
                (isCertificateEligible(eligibility) || certificate?.id) &&
                (!certificate?.id || !certificate?.certificate_url)
              ) {
                const generatedResponse = await api.post(
                  `/student/certificates/generate/${encodeURIComponent(enrollmentId)}`,
                );
                certificate = generatedResponse.data?.data ?? certificate;

                if (!certificate?.id || !certificate?.certificate_url) {
                  throw new Error("The certificate PDF is not ready yet.");
                }
              }
            } catch (certificateError) {
              failed = true;
              console.error(
                "Automatic certificate preparation failed:",
                certificateError,
              );
            }
          }

          if (cancelled) return;

          setCertificateEligibility((current) => ({
            ...current,
            [enrollmentId]: {
              loading: false,
              eligibility,
              certificate,
              error: failed && !certificate?.certificate_url,
            },
          }));
        }),
      );
    }

    if (!loading) {
      loadCertificates();
    }

    return () => {
      cancelled = true;
    };
  }, [enrollments, loading, progressByCourse]);

  // Navigate to the selected course learning page.
  const continueLearning = (courseId) => {
    if (!courseId) {
      setError("Course ID is missing. Please refresh the page and try again.");
      return;
    }

    navigate(`/student/learning/${encodeURIComponent(courseId)}`);
  };

  // Download the existing certificate PDF.
  const downloadCertificate = async (enrollmentId, certificate) => {
    const id = String(enrollmentId);

    if (!certificate?.id) {
      setError("Certificate details are missing.");
      return;
    }

    setError("");

    setCertificateLoading((current) => ({
      ...current,
      [id]: "download",
    }));

    try {
      const response = await api.get(
        `/student/certificates/download/${encodeURIComponent(certificate.id)}`,
        {
          responseType: "blob",
        },
      );

      const pdfBlob = new Blob([response.data], {
        type: "application/pdf",
      });

      const downloadUrl = window.URL.createObjectURL(pdfBlob);

      const link = document.createElement("a");

      link.href = downloadUrl;

      link.download = `${certificate.certificate_number || "Learnova-Certificate"}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Certificate download failed:", err);

      setError(
        err.response?.data?.message ||
          "Unable to download certificate. Please try again.",
      );
    } finally {
      setCertificateLoading((current) => ({
        ...current,
        [id]: null,
      }));
    }
  };

  // Filter enrolled courses using the current search term and status.
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const title =
      enrollment.title ??
      enrollment.course_title ??
      enrollment.course?.title ??
      "Untitled course";
    const description =
      enrollment.short_description ??
      enrollment.course?.short_description ??
      "";
    const matchesSearch = `${title} ${description}`
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase());
    const courseId = getCourseId(enrollment);
    const status = String(
      progressByCourse[String(courseId)]?.data?.status || "",
    ).toUpperCase();
    const isCompleted = status === "COMPLETED";
    const matchesFilter =
      courseFilter === "all" ||
      (courseFilter === "in-progress" && !isCompleted) ||
      (courseFilter === "completed" && isCompleted);

    return matchesSearch && matchesFilter;
  });

  return (
    <Box className="my-learning-page student-page">
      <Container maxWidth="xl" className="student-page-content">
        <LearnovaBackNavigation />
        {/* Page heading */}
        <Box className="my-learning-heading">
          <Box className="my-learning-heading-copy">
            <Box className="my-learning-title-row">
              <Typography component="h1" className="my-learning-title">
                My Learning
              </Typography>
            </Box>

          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Typography className="my-learning-count">
              {enrollments.length}{" "}
              {enrollments.length === 1 ? "course" : "courses"}
            </Typography>
          </Box>
        </Box>

        {location.state?.purchaseSuccess && (
          <Alert severity="success" className="my-learning-alert">
            {location.state.purchaseMessage ||
              "Demo checkout completed successfully. No real payment was collected."}{" "}
            {location.state.purchasedCourseCount === 1
              ? "Your course is now available in My Learning."
              : "Your courses are now available in My Learning."}
          </Alert>
        )}

        {/* Error message */}
        {error && (
          <Alert
            severity="error"
            className="my-learning-alert"
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}

        {!loading && enrollments.length > 0 && (
          <>
            <Box className="my-learning-toolbar">
              <Box>
                <Typography className="my-learning-section-title">
                  Your courses
                </Typography>
              </Box>
              <Box className="my-learning-toolbar-controls">
                <TextField
                  className="my-learning-search"
                  size="small"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search your courses"
                  inputProps={{ "aria-label": "Search your courses" }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
                <ToggleButtonGroup
                  className="my-learning-filters"
                  value={courseFilter}
                  exclusive
                  onChange={(_, nextFilter) => {
                    if (nextFilter) setCourseFilter(nextFilter);
                  }}
                  aria-label="Filter courses"
                  size="small"
                >
                  <ToggleButton value="all">All</ToggleButton>
                  <ToggleButton value="in-progress">In progress</ToggleButton>
                  <ToggleButton value="completed">Completed</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>
          </>
        )}

        {loading ? (
          <Box className="my-learning-state">
            <CircularProgress />
            <Typography>Loading your courses...</Typography>
          </Box>
        ) : enrollments.length === 0 ? (
          <Box className="my-learning-empty">
            <span className="my-learning-empty-icon">
              <BookOpen />
            </span>

            <Typography component="h2">
              Your learning journey starts here
            </Typography>

            <Typography>You haven’t enrolled in any courses yet.</Typography>

            <Button
              variant="contained"
              onClick={() => navigate("/student/dashboard")}
            >
              Explore courses
            </Button>
          </Box>
        ) : filteredEnrollments.length === 0 ? (
          <Box className="my-learning-filter-empty">
            <span className="my-learning-empty-icon">
              <Search />
            </span>
            <Typography component="h2">No matching courses found</Typography>
            <Typography>
              Try another search term or clear your selected filter.
            </Typography>
            <Button
              variant="outlined"
              onClick={() => {
                setSearchTerm("");
                setCourseFilter("all");
              }}
            >
              Clear filters
            </Button>
          </Box>
        ) : (
          <Box className="my-learning-grid">
            {filteredEnrollments.map((enrollment) => {
              const courseId =
                enrollment.course_id ??
                enrollment.courseId ??
                enrollment.course?.id;

              const enrollmentId = getEnrollmentId(enrollment);

              const title =
                enrollment.title ??
                enrollment.course_title ??
                enrollment.course?.title ??
                "Untitled course";

              const image =
                getCourseImage(enrollment) ||
                getCourseImage(enrollment.course ?? {});

              const enrollmentStatus =
                enrollment.enrollment_status ?? enrollment.status ?? "Enrolled";
              const isActiveEnrollment =
                String(enrollmentStatus).trim().toUpperCase() === "ACTIVE";

              const progress = courseId
                ? progressByCourse[String(courseId)]
                : null;

              const progressData = progress?.data;

              const courseCompleted =
                String(progressData?.status || "").toUpperCase() ===
                "COMPLETED";

              const enrollmentKey =
                enrollmentId !== null && enrollmentId !== undefined
                  ? String(enrollmentId)
                  : "";

              const certificateState = enrollmentKey
                ? certificateEligibility[enrollmentKey]
                : null;

              const eligibility = certificateState?.eligibility;

              const certificate = certificateState?.certificate;

              const certificateBusy = enrollmentKey
                ? certificateLoading[enrollmentKey]
                : null;

              const hasCertificate = Boolean(
                certificate?.id && certificate?.certificate_url,
              );

              const isEligible = isCertificateEligible(eligibility);

              return (
                <Card
                  className="my-learning-card"
                  key={enrollmentKey || courseId || title}
                >
                  <Box className="my-learning-card-image">
                    {image ? (
                      <img src={image} alt={title} loading="lazy" />
                    ) : (
                      <span>
                        <BookOpen />
                      </span>
                    )}
                  </Box>

                  <CardContent className="my-learning-card-content">
                    {/* Course status */}
                    <Box className="my-learning-status-row">
                      <Typography
                        className={`my-learning-status${isActiveEnrollment ? " is-active" : ""}`}
                      >
                        {enrollmentStatus}
                      </Typography>

                      {courseCompleted && (
                        <Typography className="my-learning-completed-badge">
                          <CheckCircle2 />
                          Completed
                        </Typography>
                      )}
                    </Box>

                    {/* Course title */}
                    <Typography
                      component="h2"
                      className="my-learning-course-title"
                      title={title}
                    >
                      {title}
                    </Typography>

                    {/* Course progress */}
                    <Box className="my-learning-progress">
                      <Box className="my-learning-progress-heading">
                        <Typography>Course progress</Typography>

                        {progress?.loading || !progress ? (
                          <CircularProgress size={15} />
                        ) : progressData ? (
                          <Typography className="my-learning-progress-value">
                            {progressData.percentage}%
                          </Typography>
                        ) : (
                          <Typography className="my-learning-progress-unavailable">
                            Unavailable
                          </Typography>
                        )}
                      </Box>

                      {progressData ? (
                        <>
                          <LinearProgress
                            className="my-learning-progress-bar"
                            variant="determinate"
                            value={progressData.percentage}
                            color={courseCompleted ? "success" : "primary"}
                          />

                          <Typography className="my-learning-progress-caption">
                            {progressData.completedLessons} of{" "}
                            {progressData.totalLessons} lessons completed
                          </Typography>
                        </>
                      ) : progress?.error ? (
                        <Typography className="my-learning-progress-caption">
                          Progress could not be loaded. Open the course to try
                          again.
                        </Typography>
                      ) : (
                        <LinearProgress className="my-learning-progress-bar" />
                      )}
                    </Box>

                    {/* Certificate section */}
                    {certificateState && (
                      <Box className="my-learning-certificate">
                        {certificateState.loading ? (
                          <Box className="my-learning-certificate-loading">
                            <CircularProgress size={16} />
                            <Typography variant="body2">
                              Checking certificate eligibility...
                            </Typography>
                          </Box>
                        ) : certificateState.error ? (
                          <Alert
                            severity="warning"
                            className="my-learning-certificate-alert"
                          >
                            The certificate could not be prepared automatically.
                            Refresh My Learning to retry.
                          </Alert>
                        ) : hasCertificate ? (
                          <>
                            <Typography
                              variant="body2"
                              className="my-learning-certificate-status"
                            >
                              <Award />
                              Certificate issued
                            </Typography>

                            <Button
                              fullWidth
                              variant="outlined"
                              className="my-learning-certificate-button"
                              startIcon={
                                certificateBusy === "download" ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <Download />
                                )
                              }
                              disabled={Boolean(certificateBusy)}
                              onClick={() =>
                                downloadCertificate(enrollmentKey, certificate)
                              }
                            >
                              {certificateBusy === "download"
                                ? "Downloading..."
                                : "Download certificate"}
                            </Button>
                          </>
                        ) : isEligible ? (
                          <Typography
                            variant="body2"
                            className="my-learning-certificate-status"
                          >
                            <Award />
                            Your certificate is being prepared.
                          </Typography>
                        ) : (
                          <Typography className="my-learning-progress-caption">
                            Complete lessons and assessments to earn a
                            certificate.
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Keep the primary course navigation at the bottom of each card. */}
                    <Box className="my-learning-card-actions">
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={
                          courseCompleted ? (
                            <Eye />
                          ) : (
                            <CirclePlay />
                          )
                        }
                        disabled={!courseId}
                        onClick={() => continueLearning(courseId)}
                      >
                        {courseCompleted ? "View course" : "Continue learning"}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Container>
    </Box>
  );
}
