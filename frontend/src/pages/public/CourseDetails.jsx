
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import LearnovaLogoMark from "../../component/LearnovaLogoMark";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";

import api from "../../service/Api";
import { getAuthUser, clearAuthUser } from "../../utils/authCookie";
import RelatedCourses from "../../component/Course/RelatedCourses";
import CourseReviews from "../../component/Course/CourseReviews";
import { useWishlist } from "../../utils/wishlist";
import { recordRecentlyViewedCourse } from "../../utils/recentlyViewedCourses";
import "./CourseDetails.scss";


// ============================================================
// COMMON HELPERS
// ============================================================

function getPayload(response) {
  return response?.data?.data ?? response?.data ?? {};
}


function money(course) {
  if (
    String(course?.course_type || "").toUpperCase() === "FREE" ||
    Number(course?.price) === 0
  ) {
    return "Free";
  }

  if (
    course?.price === null ||
    course?.price === undefined ||
    course?.price === ""
  ) {
    return "Price unavailable";
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: course.currency_code || "INR",
      maximumFractionDigits: 2,
    }).format(Number(course.price));
  } catch {
    return `${course.currency_code || "INR"} ${course.price}`;
  }
}


function duration(minutes) {
  const total = Number(minutes || 0);

  if (!total) return "Self-paced";

  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (!hours) return `${mins} min`;

  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
}


function instructorName(instructor) {
  return (
    instructor?.name ||
    [instructor?.first_name, instructor?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Learnova instructor"
  );
}


// ============================================================
// COURSE DETAILS COMPONENT
// ============================================================

export default function CourseDetails() {
  const { courseId } = useParams();

  const location = useLocation();
  const navigate = useNavigate();
  const wishlist = useWishlist();

  // Keep students inside the student experience after login.
  // Guests can still return to the public landing page.
  const isLoggedIn = Boolean(getAuthUser());
  const explorePath = isLoggedIn ? "/student/dashboard" : "/";
  const requestedBackPath = location.state?.from;
  const backPath =
    typeof requestedBackPath === "string" &&
    requestedBackPath.startsWith("/") &&
    !requestedBackPath.startsWith("//") &&
    requestedBackPath.split(/[?#]/, 1)[0] !== location.pathname
      ? requestedBackPath
      : explorePath;
  const backLabel = backPath.startsWith("/student/")
    ? "Back to dashboard"
    : "Back to courses";

  const [course, setCourse] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [enrolling, setEnrolling] = useState(false);

  const [enrollMessage, setEnrollMessage] = useState("");

  const [addingToCart, setAddingToCart] = useState(false);

  const [automaticCoupon, setAutomaticCoupon] = useState(null);

  const [cartMessage, setCartMessage] = useState("");

  const [cartMessageType, setCartMessageType] =
    useState("success");


  // Prevent repeated automatic requests after login.
  const resumeEnrollmentAttempted = useRef(false);

  const resumeCartAttempted = useRef(false);


  // ==========================================================
  // LOAD COURSE DETAILS
  // ==========================================================

  const loadCourse = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        `/public/courses/${encodeURIComponent(courseId)}`,
        signal ? { signal } : undefined
      );

      const payload = getPayload(response);

      setCourse(payload.course ?? payload);

    } catch (err) {
      if (
        err?.name !== "CanceledError" &&
        err?.code !== "ERR_CANCELED"
      ) {
        setError(
          err?.response?.status === 404
            ? "This course could not be found or is no longer available."
            : err?.response?.data?.message ||
                "We could not load this course. Please try again."
        );
      }

    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [courseId]);


  useEffect(() => {
    const controller = new AbortController();

    loadCourse(controller.signal);

    return () => controller.abort();
  }, [loadCourse]);

  useEffect(() => {
    if (isLoggedIn && (course?.id ?? course?.course_id) != null) {
      recordRecentlyViewedCourse(course);
    }
  }, [course, isLoggedIn]);

  useEffect(() => {
    const isPaid =
      String(course?.course_type || "").toUpperCase() === "PAID" &&
      Number(course?.price) > 0;

    if (!isLoggedIn || !course?.id || !isPaid) {
      setAutomaticCoupon(null);
      return undefined;
    }

    const controller = new AbortController();
    setAutomaticCoupon(null);

    async function loadInstitutionCoupon() {
      try {
        const response = await api.get(
          "/student/payments/automatic-coupon",
          {
            params: { course_id: course.id },
            signal: controller.signal,
          }
        );
        const quote = response.data?.data;

        if (!controller.signal.aborted && quote?.coupon_code) {
          setAutomaticCoupon(quote);
        }
      } catch {
        if (!controller.signal.aborted) setAutomaticCoupon(null);
      }
    }

    loadInstitutionCoupon();
    return () => controller.abort();
  }, [course, isLoggedIn]);


  // ==========================================================
  // ENROLL IN COURSE
  // ==========================================================

  const enroll = useCallback(async () => {
    if (!course?.id || enrolling) return;

    setEnrollMessage("");

    // Already enrolled students can continue learning.
    if (course.is_enrolled) {
      navigate(`/student/learning/${encodeURIComponent(course.id)}`);
      return;
    }

    const hasValidPrice =
      course.price !== null &&
      course.price !== undefined &&
      course.price !== "" &&
      Number.isFinite(Number(course.price));

    const isFreeCourse =
      String(course.course_type || "").toUpperCase() === "FREE" &&
      (!hasValidPrice || Number(course.price) === 0);


    // Paid courses: redirect to existing checkout.
    if (!isFreeCourse) {
      const checkoutPath = `/checkout/${course.id}`;

      if (!isLoggedIn) {
        navigate(
          `/login?redirect=${encodeURIComponent(checkoutPath)}`,
          {
            state: {
              from: checkoutPath,
            },
          }
        );

        return;
      }

      navigate(checkoutPath);
      return;
    }

    // Free courses: enroll through the existing backend endpoint.
    if (!isLoggedIn) {
      const returnTo = `/courses/${course.id}?enroll=1`;

      navigate(
        `/login?redirect=${encodeURIComponent(returnTo)}`,
        {
          state: {
            from: returnTo,
          },
        }
      );

      return;
    }


    setEnrolling(true);

    try {
      await api.post("/student/enrollments", {
        course_id: course.id,
      });

      navigate(`/student/learning/${encodeURIComponent(course.id)}`);

    } catch (err) {
      if (err?.response?.status === 401) {
        clearAuthUser();
        const returnTo = `/courses/${course.id}?enroll=1`;

        navigate(
          `/login?redirect=${encodeURIComponent(returnTo)}`,
          {
            state: {
              from: returnTo,
            },
          }
        );

        return;
      }

      // Already enrolled.
      if (
        err?.response?.status === 409 ||
        /already enrolled/i.test(
          err?.response?.data?.message || ""
        )
      ) {
        navigate(`/student/learning/${encodeURIComponent(course.id)}`);
        return;
      }

      setEnrollMessage(
        err?.response?.data?.message ||
        "Enrollment could not be completed. Please try again."
      );

    } finally {
      setEnrolling(false);
    }
  }, [course, enrolling, isLoggedIn, navigate]);


  // ==========================================================
  // ADD COURSE TO CART
  // ==========================================================

  const addToCart = useCallback(async () => {
    if (!course?.id || addingToCart) return;

    setCartMessage("");

    // Student must login before adding a course.
    // Authentication uses HttpOnly cookies; the access token is not
    // available in sessionStorage. Use the same verified user cache as
    // the rest of the student UI.
    if (!getAuthUser()) {
      const returnTo = `/courses/${course.id}?addToCart=1`;

      navigate(
        `/login?redirect=${encodeURIComponent(returnTo)}`,
        {
          state: {
            from: returnTo,
          },
        }
      );

      return;
    }

    setAddingToCart(true);

    try {
      await api.post("/student/cart/items", {
        course_id: course.id,
      });

      setCartMessage(
        automaticCoupon?.coupon_code
          ? `Course added. Institution coupon ${automaticCoupon.coupon_code} is available to apply at checkout.`
          : "Course added to cart successfully!"
      );

      setCartMessageType("success");

      // Remove the automatic action query parameter.
      if (location.search) {
        navigate(location.pathname, {
          replace: true,
        });
      }

    } catch (err) {
      if (err?.response?.status === 401) {
        clearAuthUser();

        const returnTo = `/courses/${course.id}?addToCart=1`;

        navigate(
          `/login?redirect=${encodeURIComponent(returnTo)}`,
          {
            state: {
              from: returnTo,
            },
          }
        );

        return;
      }

      setCartMessage(
        err?.response?.data?.message ||
        "Unable to add course to cart. Please try again."
      );

      setCartMessageType("error");

    } finally {
      setAddingToCart(false);
    }
  }, [course, addingToCart, automaticCoupon, navigate, location.pathname, location.search]);


  // ==========================================================
  // RESUME FREE ENROLLMENT AFTER LOGIN
  // ==========================================================

  useEffect(() => {
    const shouldResumeEnrollment =
      new URLSearchParams(location.search).get("enroll") === "1";

    if (
      loading ||
      !course ||
      !shouldResumeEnrollment ||
      course.is_enrolled ||
      resumeEnrollmentAttempted.current
    ) {
      return;
    }

    resumeEnrollmentAttempted.current = true;

    enroll();

  }, [loading, course, location.search, enroll]);


  // ==========================================================
  // RESUME ADD TO CART AFTER LOGIN
  // ==========================================================

  useEffect(() => {
    const shouldResumeCart =
      new URLSearchParams(location.search).get("addToCart") === "1";

    if (
      loading ||
      !course ||
      !shouldResumeCart ||
      course.is_enrolled ||
      String(course.course_type || "").toUpperCase() !== "PAID" ||
      resumeCartAttempted.current
    ) {
      return;
    }

    resumeCartAttempted.current = true;

    addToCart();

  }, [loading, course, location.search, addToCart]);


  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (loading) {
    return (
      <Box className="course-details-state">
        <CircularProgress />
        <Typography>
          Loading course details…
        </Typography>
      </Box>
    );
  }


  // ==========================================================
  // ERROR STATE
  // ==========================================================

  if (error || !course) {
    return (
      <Box className="course-details-page">
        <header className="cd-header">
          <Container maxWidth="xl" className="cd-header__inner">
            <div className="cd-header__brand-group">
              <RouterLink
                to={backPath}
                className="cd-back-arrow"
                aria-label={backLabel}
                title={backLabel}
              >
                <ArrowBackRoundedIcon />
              </RouterLink>
              <RouterLink
                to={explorePath}
                className="cd-brand"
                aria-label={isLoggedIn ? "Student dashboard" : "Learnova home"}
              >
                <LearnovaLogoMark className="cd-brand__mark" />
                <span>learnova<small>LEARN WITH INTENTION</small></span>
              </RouterLink>
            </div>
          </Container>
        </header>
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Alert severity="error" sx={{ mt: 3 }}>
            {error || "Course not found."}
          </Alert>
        </Container>
      </Box>
    );
  }


  // ==========================================================
  // COURSE DATA
  // ==========================================================

  const instructors = Array.isArray(course.instructors)
    ? course.instructors
    : course.instructor
      ? [course.instructor]
      : [];

  const modules = Array.isArray(course.modules)
    ? course.modules
    : [];

  const totalLessons = Number(
    course.lesson_count ??
    modules.reduce(
      (sum, module) =>
        sum + (module.lessons?.length || 0),
      0
    )
  );

  const whatYouLearn = Array.isArray(course.learning_outcomes)
    ? course.learning_outcomes
    : [];

  const isPaidCourse =
    String(course.course_type || "").toUpperCase() === "PAID";


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <main className="course-details-page">

      {/* HEADER */}

      <header className="cd-header">
        <Container maxWidth="xl" className="cd-header__inner">
          <div className="cd-header__brand-group">
            <RouterLink
              to={backPath}
              className="cd-back-arrow"
              aria-label={backLabel}
              title={backLabel}
            >
              <ArrowBackRoundedIcon />
            </RouterLink>
            <RouterLink
              to={explorePath}
              className="cd-brand"
              aria-label={isLoggedIn ? "Student dashboard" : "Learnova home"}
            >
                <LearnovaLogoMark className="cd-brand__mark" />
              <span>learnova<small>LEARN WITH INTENTION</small></span>
            </RouterLink>
          </div>
        </Container>
      </header>


      {/* COURSE HERO */}

      <section className="cd-hero">
        <Container maxWidth="xl" className="cd-hero__grid">

          <Box className="cd-hero__copy">

            <div className="cd-eyebrow">
              <span />
              COURSE DETAILS
              {course.category_name
                ? ` / ${course.category_name}`
                : ""}
            </div>

            <Typography component="h1">
              {course.title}
            </Typography>

            <Typography className="cd-hero__description">
              {course.short_description ||
                course.description ||
                "Explore this course and build practical skills at your own pace."}
            </Typography>

            <Stack
              direction="row"
              flexWrap="wrap"
              gap={1}
              className="cd-tags"
            >
              {course.level && (
                <Chip
                  label={String(course.level)
                    .toLowerCase()
                    .replace(/^./, letter => letter.toUpperCase())}
                />
              )}

              {course.language_code && (
                <Chip
                  icon={<LanguageRoundedIcon />}
                  label={String(course.language_code).toUpperCase()}
                />
              )}

              {course.course_type && (
                <Chip
                  label={
                    String(course.course_type).toUpperCase() === "FREE"
                      ? "Free course"
                      : "Paid course"
                  }
                />
              )}
            </Stack>

            <Stack
              direction="row"
              flexWrap="wrap"
              gap={2}
              className="cd-hero__meta"
            >
              <span>
                <MenuBookRoundedIcon />
                {course.module_count ?? modules.length} modules
              </span>

              <span>
                <PlayCircleOutlineRoundedIcon />
                {totalLessons} lessons
              </span>

              <span>
                <AccessTimeRoundedIcon />
                {duration(course.duration_minutes)}
              </span>
            </Stack>

            {instructors.length > 0 && (
              <Box className="cd-instructor-inline">
                <Avatar>
                  {instructorName(instructors[0])
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>

                <Box>
                  <small>CREATED BY</small>
                  <strong>
                    {instructorName(instructors[0])}
                  </strong>
                </Box>
              </Box>
            )}

          </Box>


          <Box className="cd-hero__art">
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                onError={event => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="cd-art-placeholder">
                <SchoolRoundedIcon />
                <span>COURSE PREVIEW</span>
                <strong>{course.title}</strong>
              </div>
            )}
          </Box>

        </Container>
      </section>


      {/* MAIN CONTENT */}

      <Container maxWidth="xl" className="cd-main-grid">

        <div className="cd-main-content">

          {/* COURSE OUTCOMES */}

          {whatYouLearn.length > 0 && (
            <Paper elevation={0} className="cd-panel cd-outcomes">

              <div className="cd-section-kicker">
                COURSE OUTCOMES
              </div>

              <Typography component="h2">
                What you’ll learn
              </Typography>

              <div className="cd-outcomes__grid">
                {whatYouLearn.map((outcome, index) => (
                  <div
                    key={`${
                      typeof outcome === "string"
                        ? outcome
                        : outcome.id ?? outcome.title ?? index
                    }-${index}`}
                  >
                    <CheckCircleOutlineRoundedIcon />

                    <span>
                      {typeof outcome === "string"
                        ? outcome
                        : outcome.title || outcome.description}
                    </span>
                  </div>
                ))}
              </div>

            </Paper>
          )}


          {/* COURSE CURRICULUM */}

          <section className="cd-curriculum">

            <div className="cd-section-kicker">
              THE COURSE PLAN
            </div>

            <Typography component="h2">
              Course curriculum
            </Typography>

            <Typography className="cd-muted">
              {course.module_count ?? modules.length} modules ·
              {" "}{totalLessons} lessons ·
              {" "}{duration(course.duration_minutes)}
            </Typography>

            {!course.is_enrolled &&
              (course.module_count ?? modules.length) > modules.length && (
                <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                  Preview access: the first two modules are shown.
                  Enroll to unlock the complete curriculum.
                </Alert>
              )}

            {modules.length === 0 ? (
              <Paper
                elevation={0}
                className="cd-empty-curriculum"
              >
                Course curriculum is not available yet.
              </Paper>
            ) : (
              modules.map((module, index) => (
                <Accordion
                  className="cd-module"
                  key={module.id ?? `${module.title}-${index}`}
                  defaultExpanded={index === 0}
                  disableGutters
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreRoundedIcon />}
                  >
                    <Box className="cd-module__heading">
                      <span className="cd-module__number">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <Box>
                        <Typography component="h3">
                          {module.title}
                        </Typography>

                        {module.description && (
                          <Typography className="cd-muted">
                            {module.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <Typography className="cd-module__count">
                      {module.lessons?.length || 0} lessons
                    </Typography>
                  </AccordionSummary>

                  <AccordionDetails>
                    {(module.lessons || []).length === 0 ? (
                      <Typography className="cd-muted">
                        Lessons will be available soon.
                      </Typography>
                    ) : (
                      (module.lessons || []).map(
                        (lesson, lessonIndex) => (
                          <div
                            className="cd-lesson"
                            key={
                              lesson.id ??
                              `${lesson.title}-${lessonIndex}`
                            }
                          >
                            <PlayCircleOutlineRoundedIcon />

                            <span>{lesson.title}</span>

                            {lesson.is_preview && (
                              <Chip
                                size="small"
                                label="Preview"
                              />
                            )}

                            <small>
                              {duration(lesson.duration_minutes)}
                            </small>
                          </div>
                        )
                      )
                    )}
                  </AccordionDetails>
                </Accordion>
              ))
            )}

          </section>


          {/* INSTRUCTORS */}

          {instructors.length > 0 && (
            <section className="cd-instructors">

              <div className="cd-section-kicker">
                MEET YOUR INSTRUCTOR
              </div>

              <Typography component="h2">
                Learn from experienced people
              </Typography>

              {instructors.map((instructor, index) => (
                <Paper
                  className="cd-instructor-card"
                  elevation={0}
                  key={instructor.id ?? index}
                >
                  <Avatar
                    src={instructor.profile_image_url || undefined}
                  >
                    {instructorName(instructor)
                      .charAt(0)
                      .toUpperCase()}
                  </Avatar>

                  <Box>
                    <Typography component="h3">
                      {instructorName(instructor)}
                    </Typography>

                    {instructor.designation && (
                      <Typography className="cd-muted">
                        {instructor.designation}
                      </Typography>
                    )}

                    {instructor.specialization && (
                      <Typography>
                        {instructor.specialization}
                      </Typography>
                    )}

                    {instructor.bio && (
                      <Typography className="cd-muted">
                        {instructor.bio}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              ))}

            </section>
          )}

          <CourseReviews courseId={course.id} isLoggedIn={isLoggedIn} />

        </div>


        {/* ENROLLMENT CARD */}

        <aside className="cd-enroll-column">

          <Paper className="cd-enroll-card" elevation={0}>

            <div className="cd-enroll-card__image">
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  onError={event => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div>
                  <SchoolRoundedIcon />
                  <span>{course.title}</span>
                </div>
              )}
            </div>


            <div className="cd-enroll-card__body">

              <Typography className="cd-price">
                {money(course)}
              </Typography>


              {/* EXISTING ENROLL BUTTON */}

              <Button
                fullWidth
                variant="contained"
                className="cd-enroll-button"
                onClick={enroll}
                disabled={enrolling}
                endIcon={
                  enrolling
                    ? <CircularProgress size={18} color="inherit" />
                    : <ArrowForwardRoundedIcon />
                }
              >
                {enrolling
                  ? "Processing…"
                  : course.is_enrolled
                    ? "Continue learning"
                    : "Enroll now"}
              </Button>


              {enrollMessage && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {enrollMessage}
                </Alert>
              )}

              {automaticCoupon && !course.is_enrolled && isPaidCourse && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Institution coupon <strong>{automaticCoupon.coupon_code}</strong>{" "}
                  is applied automatically at checkout. You save{" "}
                  <strong>{money({ ...course, price: automaticCoupon.discount_amount })}</strong>{" "}
                  on this course.
                </Alert>
              )}

              {/* ADD TO CART BUTTON */}

              {!course.is_enrolled && isPaidCourse && (
                <Button
                  fullWidth
                  variant="outlined"
                  className="cd-cart-button"
                  onClick={addToCart}
                  disabled={addingToCart}
                  startIcon={
                    addingToCart
                      ? <CircularProgress size={18} />
                      : <ShoppingCartRoundedIcon />
                  }
                  sx={{ mt: 1.5 }}
                >
                  {addingToCart
                    ? "Adding to cart..."
                    : "Add to Cart"}
                </Button>
              )}

              {isLoggedIn && (
                <Button
                  fullWidth
                  variant="text"
                  className="cd-wishlist-button"
                  onClick={() => wishlist.toggle(course)}
                  startIcon={wishlist.isSaved(course.id)
                    ? <FavoriteRoundedIcon />
                    : <FavoriteBorderRoundedIcon />}
                  aria-pressed={wishlist.isSaved(course.id)}
                >
                  {wishlist.isSaved(course.id) ? "Saved to wishlist" : "Add to wishlist"}
                </Button>
              )}


              {/* CART RESPONSE MESSAGE */}

              {cartMessage && (
                <Alert
                  severity={cartMessageType}
                  sx={{ mt: 2 }}
                >
                  {cartMessage}
                </Alert>
              )}


              <Divider />


              {/* COURSE DETAILS */}

              <Typography component="h3">
                Course details
              </Typography>

              <div className="cd-includes-item">
                <MenuBookRoundedIcon />
                <span>
                  {course.module_count ?? modules.length} modules
                </span>
              </div>

              <div className="cd-includes-item">
                <PlayCircleOutlineRoundedIcon />
                <span>{totalLessons} lessons</span>
              </div>

              <div className="cd-includes-item">
                <AccessTimeRoundedIcon />
                <span>
                  {duration(course.duration_minutes)}
                </span>
              </div>

            </div>
          </Paper>

        </aside>

      </Container>

      <Container maxWidth="xl" className="cd-related-container">
        <RelatedCourses
          categoryId={course.category_id}
          excludeCourseIds={[course.id]}
          title="More courses to explore"
          description={course.category_name
            ? `More ways to learn in ${course.category_name}.`
            : "Explore more courses selected for your learning journey."}
        />
      </Container>


      {/* FOOTER */}

      <footer className="cd-footer">
        <Container maxWidth="xl">
          <span>
            © {new Date().getFullYear()} Learnova
          </span>

        </Container>
      </footer>

    </main>
  );
}
