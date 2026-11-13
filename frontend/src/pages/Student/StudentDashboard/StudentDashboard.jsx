import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Menu,
  MenuItem,
  Pagination,
  Select,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import SpaRoundedIcon from "@mui/icons-material/SpaRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import api from "../../../service/Api";
import communityApi from "../../../service/CommunityApi";
import {
  studentAssessmentApi,
  unwrapAssessmentResponse,
} from "../../../service/AssessmentApi";
import { logoutUser } from "../../../service/Authapi";
import {
  getAuthUser,
  clearAuthUser,
} from "../../../utils/authCookie";
import { calculateCourseProgress } from "../../../utils/courseProgress";
import { useWishlist } from "../../../utils/wishlist";
import {
  clearRecentlyViewedCourses,
  useRecentlyViewedCourses,
} from "../../../utils/recentlyViewedCourses";
import LearnovaFooter from "../../../component/LearnovaFooter";
import LearnovaLogoMark from "../../../component/LearnovaLogoMark";
import CourseExploreMenu from "../../../component/CourseExploreMenu";
import "../../../component/Course/CourseCard.scss";
import "./StudentDashboard.scss";
import "./StudentNotifications.scss";

const categoryVisuals = [
  { icon: <CodeRoundedIcon />, tone: "blue" },
  { icon: <BarChartRoundedIcon />, tone: "green" },
  { icon: <BusinessCenterRoundedIcon />, tone: "orange" },
  { icon: <PaletteRoundedIcon />, tone: "pink" },
  { icon: <CampaignRoundedIcon />, tone: "amber" },
  { icon: <ComputerRoundedIcon />, tone: "purple" },
  { icon: <SpaRoundedIcon />, tone: "mint" },
  { icon: <CameraAltRoundedIcon />, tone: "red" },
];

function normalizeCatalog(payload) {
  const root = payload?.data ?? payload ?? {};
  const courseList = root.courses ?? root.featuredCourses ?? root.items ?? [];
  const categoryList = root.categories ?? root.courseCategories ?? [];
  const stats = root.stats ?? root.statistics ?? {};
  return {
    courses: Array.isArray(courseList) ? courseList : [],
    categories: Array.isArray(categoryList) ? categoryList : [],
    stats,
    pagination: root.pagination ?? {
      page: 1,
      limit: 3,
      total: Array.isArray(courseList) ? courseList.length : 0,
      totalPages: 1,
    },
  };
}

function money(value) {
  if (value === null || value === undefined || value === "") return "Free";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(amount)
    : String(value);
}

function courseImage(course) {
  return (
    course?.thumbnail_url ||
    course?.thumbnailUrl ||
    course?.thumbnail ||
    course?.image_url ||
    course?.imageUrl ||
    course?.course_thumbnail ||
    ""
  );
}

function assessmentRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.assessments ?? payload?.items ?? payload?.results ?? [];
}

function notificationRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.notifications ?? payload?.items ?? [];
}

function enrollmentCourseId(enrollment) {
  return (
    enrollment?.course_id ?? enrollment?.courseId ?? enrollment?.course?.id
  );
}

function getEnrollmentProgress(enrollment) {
  const value = Number(
    enrollment?.progress_percentage ??
      enrollment?.progress ??
      enrollment?.completion_percentage ??
      enrollment?.course_progress?.progress_percentage,
  );
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function calculateDashboardProgress(payload) {
  return calculateCourseProgress(payload).percentage;
}

function formatDashboardDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function localDateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function calculateLearningStreak(activityDates) {
  const activeDays = new Set(activityDates);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayKey = localDateKey(today);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  let cursor = activeDays.has(todayKey) ? today : activeDays.has(localDateKey(yesterday)) ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  while (activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function StudentDashboard() {
  const navigate = useNavigate();
  const wishlist = useWishlist();
  const recentlyViewedCourses = useRecentlyViewedCourses();
  const user = useMemo(() => getAuthUser(), []);
  const firstName =
    user?.firstName ??
    user?.first_name ??
    user?.username ??
    user?.name ??
    "Student";
  const greetingHour = new Date().getHours();
  const timeGreeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 18
        ? "Good afternoon"
        : "Good evening";
  const [catalog, setCatalog] = useState({
    courses: [],
    categories: [],
    stats: {},
    pagination: { page: 1, limit: 4, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [levelFilter, setLevelFilter] = useState("");
  const [page, setPage] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [learningLoading, setLearningLoading] = useState(true);
  const [learningError, setLearningError] = useState("");
  const [courseProgressById, setCourseProgressById] = useState({});
  const [courseProgressLoading, setCourseProgressLoading] = useState(false);
  const [dashboardCertificates, setDashboardCertificates] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(true);
  const [learningActivityDates, setLearningActivityDates] = useState([]);
  const [learningActivityLoading, setLearningActivityLoading] = useState(true);
  const [dashboardAssessments, setDashboardAssessments] = useState([]);
  const [dashboardNotifications, setDashboardNotifications] = useState([]);
  const [dashboardUnreadCount, setDashboardUnreadCount] = useState(0);
  const [dashboardFeedLoading, setDashboardFeedLoading] = useState(true);
  const [removeEnrollmentTarget, setRemoveEnrollmentTarget] = useState(null);
  const [removingEnrollmentId, setRemovingEnrollmentId] = useState(null);
  const [removeEnrollmentError, setRemoveEnrollmentError] = useState("");
  const [cart, setCart] = useState(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const learningStreak = useMemo(
    () => calculateLearningStreak(learningActivityDates),
    [learningActivityDates],
  );

  const profileMenuName =
    [
      user?.firstName || user?.first_name,
      user?.lastName || user?.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    user?.name ||
    firstName;
  const profileMenuEmail =
    user?.email || user?.email_address || "Student account";

  useEffect(() => {
    let cancelled = false;
    api.get("/student/learning/activity")
      .then((response) => {
        if (cancelled) return;
        const payload = response.data?.data ?? response.data;
        setLearningActivityDates(Array.isArray(payload?.activity_dates) ? payload.activity_dates : []);
      })
      .catch(() => {
        if (!cancelled) setLearningActivityDates([]);
      })
      .finally(() => {
        if (!cancelled) setLearningActivityLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    try {
      // Revokes the refresh token and clears the HttpOnly cookies.
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearAuthUser();
      navigate("/login", { replace: true });
    }
  };

  const loadMyEnrollments = useCallback(async () => {
    setLearningLoading(true);
    setLearningError("");
    try {
      const response = await api.get("/student/enrollments");
      const payload = response.data?.data ?? response.data;
      const rows = payload?.enrollments ?? payload?.items ?? [];
      setMyEnrollments(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Failed to load student enrollments:", error);
      setLearningError(
        error.response?.status === 404
          ? "My Learning API route was not found. Check the backend route registration."
          : "Unable to load your enrolled courses. Please try again.",
      );
    } finally {
      setLearningLoading(false);
    }
  }, []);

  // Fetch the current student's cart from the backend.
  const loadMyCart = useCallback(async () => {
    setCartLoading(true);
    setCartError("");

    try {
      const response = await api.get("/student/cart");
      setCart(response.data?.data ?? null);
    } catch (error) {
      console.error("Failed to load student cart:", error);
      setCartError(
        error.response?.data?.message ||
          "Unable to load your cart. Please try again.",
      );
    } finally {
      setCartLoading(false);
    }
  }, []);

  const handleRemoveEnrollment = async () => {
    const enrollmentId =
      removeEnrollmentTarget?.enrollment_id ??
      removeEnrollmentTarget?.enrollmentId;
    if (
      enrollmentId === null ||
      enrollmentId === undefined ||
      enrollmentId === ""
    ) {
      setRemoveEnrollmentError(
        "Enrollment ID is missing. Please refresh My Learning and try again.",
      );
      return;
    }

    setRemovingEnrollmentId(String(enrollmentId));
    setRemoveEnrollmentError("");
    try {
      await api.delete(
        `/student/enrollments/${encodeURIComponent(enrollmentId)}`,
      );
      setMyEnrollments((current) =>
        current.filter(
          (item) =>
            String(item.enrollment_id ?? item.enrollmentId ?? "") !==
            String(enrollmentId),
        ),
      );
      setRemoveEnrollmentTarget(null);
      setRemoveEnrollmentError("");
      // Re-fetch from the API so the dashboard reflects the server's authoritative list.
      await loadMyEnrollments();
    } catch (error) {
      console.error("Failed to remove enrollment:", error);
      setRemoveEnrollmentError(
        error.response?.data?.message ||
          "Unable to remove this course. Please try again.",
      );
    } finally {
      setRemovingEnrollmentId(null);
    }
  };

  // Fetch the authenticated student's own courses for the dashboard's Continue Learning section.
  useEffect(() => {
    loadMyEnrollments();
  }, [loadMyEnrollments]);

  useEffect(() => {
    loadMyCart();
  }, [loadMyCart]);

  // Load assessments and recent community activity for the dashboard widgets.
  useEffect(() => {
    let cancelled = false;

    async function loadDashboardFeed() {
      const [assessmentResult, notificationResult, unreadResult] =
        await Promise.allSettled([
          studentAssessmentApi.list(),
          communityApi.getNotifications({ page: 1, limit: 5 }),
          communityApi.getUnreadCount(),
        ]);

      if (cancelled) return;

      if (assessmentResult.status === "fulfilled") {
        const payload = unwrapAssessmentResponse(assessmentResult.value);
        const rows = assessmentRows(payload);
        setDashboardAssessments(Array.isArray(rows) ? rows : []);
      } else {
        console.error(
          "Failed to load dashboard assessments:",
          assessmentResult.reason,
        );
      }

      if (notificationResult.status === "fulfilled") {
        const payload =
          notificationResult.value?.data?.data ??
          notificationResult.value?.data;
        const rows = notificationRows(payload);
        const notifications = Array.isArray(rows) ? rows : [];
        setDashboardNotifications(notifications);
        const unreadPayload =
          unreadResult.status === "fulfilled"
            ? (unreadResult.value?.data?.data ?? unreadResult.value?.data)
            : null;
        const reportedUnread = Number(
          unreadPayload?.unread_count ?? unreadPayload?.count,
        );
        setDashboardUnreadCount(
          Number.isFinite(reportedUnread)
            ? reportedUnread
            : notifications.filter((notification) => !notification.is_read)
                .length,
        );
      } else {
        console.error(
          "Failed to load dashboard notifications:",
          notificationResult.reason,
        );
        if (unreadResult.status === "fulfilled") {
          const unreadPayload =
            unreadResult.value?.data?.data ?? unreadResult.value?.data;
          const reportedUnread = Number(
            unreadPayload?.unread_count ?? unreadPayload?.count,
          );
          setDashboardUnreadCount(
            Number.isFinite(reportedUnread) ? reportedUnread : 0,
          );
        }
      }

      setDashboardFeedLoading(false);
    }

    loadDashboardFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reuse the existing course-learning and certificate endpoints to populate
  // per-course progress and certificates earned for this student.
  useEffect(() => {
    let cancelled = false;
    const validEnrollments = myEnrollments.filter((enrollment) => {
      const enrollmentId =
        enrollment?.enrollment_id ?? enrollment?.enrollmentId ?? enrollment?.id;
      return (
        enrollmentId !== null &&
        enrollmentId !== undefined &&
        String(enrollmentId).trim() !== ""
      );
    });
    const courseIds = [
      ...new Set(
        myEnrollments
          .map(enrollmentCourseId)
          .filter(
            (id) => id !== null && id !== undefined && String(id).trim() !== "",
          )
          .map(String),
      ),
    ];

    if (!myEnrollments.length) {
      setCourseProgressById({});
      setDashboardCertificates([]);
      setCourseProgressLoading(false);
      setCertificatesLoading(false);
      return undefined;
    }

    const initialProgress = {};
    courseIds.forEach((courseId) => {
      // Wait for the course learning endpoint to recalculate progress from
      // saved lesson and assessment states instead of trusting stale totals.
      initialProgress[courseId] = 0;
    });
    setCourseProgressById(initialProgress);
    setCourseProgressLoading(courseIds.length > 0);
    setCertificatesLoading(validEnrollments.length > 0);
    setDashboardCertificates([]);

    async function loadCourseOverview() {
      const [progressResults, certificateResults] = await Promise.all([
        Promise.allSettled(
          courseIds.map(async (courseId) => {
            const response = await api.get(
              `/student/learning/courses/${encodeURIComponent(courseId)}`,
            );
            const payload = response.data?.data ?? response.data;
            return calculateDashboardProgress(payload);
          }),
        ),
        Promise.allSettled(
          validEnrollments.map(async (enrollment) => {
            const enrollmentId =
              enrollment.enrollment_id ??
              enrollment.enrollmentId ??
              enrollment.id;
            const response = await api.get(
              `/student/certificates/by-enrollment/${encodeURIComponent(enrollmentId)}`,
            );
            return response.data?.data ?? response.data;
          }),
        ),
      ]);

      if (cancelled) return;

      const updatedProgress = { ...initialProgress };
      progressResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const percentage = Number(result.value);
          updatedProgress[courseIds[index]] = Number.isFinite(percentage)
            ? Math.min(100, Math.max(0, percentage))
            : updatedProgress[courseIds[index]];
        } else {
          console.error(
            `Failed to load progress for course ${courseIds[index]}:`,
            result.reason,
          );
        }
      });
      setCourseProgressById(updatedProgress);
      setCourseProgressLoading(false);

      const certificates = certificateResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value)
        .filter(
          (certificate) =>
            certificate && (certificate.id || certificate.certificate_number),
        );
      const uniqueCertificates = [
        ...new Map(
          certificates.map((certificate) => [
            String(certificate.id ?? certificate.certificate_number),
            certificate,
          ]),
        ).values(),
      ];
      setDashboardCertificates(uniqueCertificates);
      setCertificatesLoading(false);

      certificateResults.forEach((result) => {
        if (
          result.status === "rejected" &&
          result.reason?.response?.status !== 404
        ) {
          console.error(
            "Failed to load an enrollment certificate:",
            result.reason,
          );
        }
      });
    }

    loadCourseOverview();
    return () => {
      cancelled = true;
    };
  }, [myEnrollments]);

  // Keep the public catalog API's server-side search, category and level filters, and pagination.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setApiError(false);
    api
      .get("/public/catalog", {
        params: {
          page,
          limit: 4,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(selectedCategories.length
            ? { categories: selectedCategories.join(",") }
            : {}),
          ...(levelFilter ? { level: levelFilter } : {}),
        },
      })
      .then((response) => {
        if (!active) return;
        setCatalog(normalizeCatalog(response.data));
        setApiError(false);
      })
      .catch((error) => {
        console.error("Failed to load course catalog:", error);
        if (active) setApiError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, search, selectedCategories, levelFilter, catalogRefreshKey]);

  const handleSearchSubmit = () => {
    const nextSearch = searchInput.trim();
    navigate(
      nextSearch
        ? `/student/search?q=${encodeURIComponent(nextSearch)}`
        : "/student/search",
    );
  };

  const goTo = (id) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };
  const openCommunity = () => {
    setMobileMenuOpen(false);
    navigate("/community");
  };
  const categoryName = (category) =>
    category.name ?? category.category_name ?? category.title ?? "Category";
  const categoryId = (category) =>
    category.id ?? category.category_id ?? categoryName(category);
  const toggleCategory = (value) => {
    const id = String(value);
    setSelectedCategories((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
    setPage(1);
  };
  const selectFooterCategory = (category) => {
    const id = categoryId(category);
    navigate(`/student/search?category=${encodeURIComponent(String(id))}`);
  };
  const browseFooterSection = (section) => {
    if (section === "courses") {
      navigate("/student/search");
      return;
    }

    goTo(section);
  };
  const courses = catalog.courses;
  const publishedCount =
    catalog.stats.publishedCourses ??
    catalog.stats.published_courses ??
    catalog.pagination.total ??
    courses.length;
  const learningEnrollments = myEnrollments.filter((enrollment) => {
    const status = String(
      enrollment?.enrollment_status ?? enrollment?.status ?? "ACTIVE",
    ).toUpperCase();
    return ![
      "CANCELLED",
      "CANCELED",
      "EXPIRED",
      "REVOKED",
      "INACTIVE",
      "DELETED",
    ].includes(status);
  });
  const activeEnrollments = learningEnrollments.filter((enrollment) => {
    const status = String(
      enrollment?.enrollment_status ?? enrollment?.status ?? "ACTIVE",
    ).toUpperCase();
    return !["COMPLETED", "COMPLETE"].includes(status);
  });
  const progressEnrollments = activeEnrollments.filter((enrollment) => {
    const courseId = enrollmentCourseId(enrollment);
    const progress = Number(
      courseProgressById[String(courseId)] ?? getEnrollmentProgress(enrollment),
    );
    return Number.isFinite(progress) && progress < 100;
  });
  const overallProgress = learningEnrollments.length
    ? Math.round(
        learningEnrollments.reduce((total, enrollment) => {
          const courseId = enrollmentCourseId(enrollment);
          return (
            total +
            (courseProgressById[String(courseId)] ??
              getEnrollmentProgress(enrollment))
          );
        }, 0) / learningEnrollments.length,
      )
    : 0;
  const pendingAssessments = dashboardAssessments.filter((assessment) => {
    const status = String(assessment.latest_status ?? "").toUpperCase();
    const passed =
      assessment.latest_passed === true ||
      String(assessment.latest_passed).toLowerCase() === "true";
    return status !== "SUBMITTED" && !(status === "EVALUATED" && passed);
  });
  const evaluatedResults = dashboardAssessments
    .filter(
      (assessment) =>
        String(assessment.latest_status ?? "").toUpperCase() === "EVALUATED",
    )
    .sort((left, right) => {
      const leftDate = new Date(
        left.latest_evaluated_at ??
          left.latest_submitted_at ??
          left.updated_at ??
          left.created_at ??
          0,
      ).getTime();
      const rightDate = new Date(
        right.latest_evaluated_at ??
          right.latest_submitted_at ??
          right.updated_at ??
          right.created_at ??
          0,
      ).getTime();
      return rightDate - leftDate;
    });
  const latestResult = evaluatedResults[0] ?? null;
  const latestResultPassed =
    latestResult?.latest_passed === true ||
    String(latestResult?.latest_passed).toLowerCase() === "true";
  const latestResultPercentage = Number(
    latestResult?.latest_percentage ??
      latestResult?.latest_score_percentage ??
      latestResult?.percentage,
  );
  const completedCourseCount = learningEnrollments.filter((enrollment) => {
    const status = String(enrollment?.enrollment_status ?? enrollment?.status ?? "").toUpperCase();
    const progress = Number(courseProgressById[String(enrollmentCourseId(enrollment))] ?? getEnrollmentProgress(enrollment));
    return ["COMPLETED", "COMPLETE"].includes(status) || progress >= 100;
  }).length;
  const achievementCards = [
    { id: "first-steps", title: "First steps", detail: "Make progress in a course", unlocked: overallProgress > 0, icon: <PlayCircleFilledRoundedIcon /> },
    { id: "three-day-streak", title: "Three-day streak", detail: "Learn on 3 days in a row", unlocked: learningStreak >= 3, icon: <LocalFireDepartmentRoundedIcon /> },
    { id: "course-complete", title: "Course finisher", detail: "Complete your first course", unlocked: completedCourseCount > 0, icon: <WorkspacePremiumRoundedIcon /> },
    { id: "assessment-pass", title: "Assessment pass", detail: "Pass an assessment", unlocked: evaluatedResults.some((result) => result.latest_passed === true || String(result.latest_passed).toLowerCase() === "true"), icon: <FactCheckRoundedIcon /> },
  ];
  const activeLearningDays = new Set(learningActivityDates);
  const learningWeek = Array.from({ length: 7 }, (_, index) => {
    const now = new Date();
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return { label: date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }), active: activeLearningDays.has(localDateKey(date)) };
  });
  const unreadNotifications = dashboardUnreadCount;

  const closeProfileMenu = () => setProfileMenuAnchor(null);

  const navigateFromProfileMenu = (path) => {
    closeProfileMenu();
    navigate(path);
  };

  const openCourse = (courseId) => {
    if (courseId !== null && courseId !== undefined && courseId !== "") {
      navigate(`/student/learning/${encodeURIComponent(courseId)}`);
    }
  };

  const openCourseDetails = (courseId) => {
    if (courseId !== null && courseId !== undefined && courseId !== "") {
      navigate(`/courses/${encodeURIComponent(courseId)}`, {
        state: { from: "/student/dashboard" },
      });
    }
  };

  // Mark one notification as read and keep the local unread badge in sync.
  const refreshDashboardNotifications = useCallback(async () => {
    const [notificationResult, unreadResult] = await Promise.allSettled([
      communityApi.getNotifications({ page: 1, limit: 5 }),
      communityApi.getUnreadCount(),
    ]);

    if (notificationResult.status === "fulfilled") {
      const payload =
        notificationResult.value?.data?.data ??
        notificationResult.value?.data;
      const notifications = notificationRows(payload);
      setDashboardNotifications(Array.isArray(notifications) ? notifications : []);
    }

    if (unreadResult.status === "fulfilled") {
      const payload = unreadResult.value?.data?.data ?? unreadResult.value?.data;
      const unreadCount = Number(payload?.unread_count ?? payload?.count);
      if (Number.isFinite(unreadCount)) setDashboardUnreadCount(unreadCount);
    }
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshDashboardNotifications();
      }
    };

    const interval = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [refreshDashboardNotifications]);

  const handleNotificationRead = async (notification) => {
    if (!notification?.id || notification.is_read) return;

    try {
      await communityApi.markRead(notification.id);
      setDashboardNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      );
      setDashboardUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  // Mark every notification as read and clear the dashboard unread badge.
  const handleAllNotificationsRead = async () => {
    if (dashboardUnreadCount === 0) return;

    try {
      await communityApi.markAllRead();
      setDashboardNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true })),
      );
      setDashboardUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const renderEnrollmentCard = (enrollment) => {
    const courseId =
      enrollment.course_id ??
      enrollment.courseId ??
      enrollment.course?.id ??
      enrollment.id;
    const title =
      enrollment.title ??
      enrollment.course_title ??
      enrollment.course?.title ??
      "Your enrolled course";
    const image =
      courseImage(enrollment) || courseImage(enrollment.course ?? {});
    const progressValue = Math.min(
      100,
      Math.max(
        0,
        courseProgressById[String(courseId)] ??
          getEnrollmentProgress(enrollment),
      ),
    );
    const hasProgress =
      courseId !== null && courseId !== undefined && courseId !== "";
    const enrollmentStatus = String(
      enrollment.enrollment_status ?? enrollment.status ?? "ENROLLED",
    ).toUpperCase();
    // Treat a course as completed when its calculated progress reaches 100% or its enrollment status is completed.
    const isCompleted =
      progressValue >= 100 ||
      ["COMPLETED", "COMPLETE"].includes(enrollmentStatus);
    const isInProgress = !isCompleted && progressValue > 0;
    const actionLabel = isCompleted
      ? "View course"
      : isInProgress
        ? "Continue learning"
        : "Start learning";
    return (
      <Card
        className="student-learning-card"
        key={
          enrollment.enrollment_id ??
          enrollment.enrollmentId ??
          courseId ??
          title
        }
        variant="outlined"
      >
        <div className="student-learning-card__image">
          {image ? (
            <img src={image} alt={title} loading="lazy" />
          ) : (
            <div className="student-course-placeholder">
              <MenuBookRoundedIcon />
            </div>
          )}
        </div>
        <CardContent className="student-learning-card__content">
          <Chip
            size="small"
            label={
              isCompleted
                ? "COMPLETED"
                : (enrollment.enrollment_status ??
                  enrollment.status ??
                  "ENROLLED")
            }
            className="student-status-chip"
          />
          <Typography className="student-learning-card__title">
            {title}
          </Typography>
          {hasProgress && (
            <Box className="student-progress-wrap">
              <Box className="student-progress-label">
                <span>Your progress</span>
                <strong>{Math.min(100, progressValue)}%</strong>
              </Box>
              <Box className="student-progress-track">
                <Box
                  className="student-progress-value"
                  style={{ width: `${Math.min(100, progressValue)}%` }}
                />
              </Box>
            </Box>
          )}
          <Button
            fullWidth
            variant="contained"
            endIcon={
              isCompleted ? (
                <ArrowForwardRoundedIcon />
              ) : (
                <PlayCircleFilledRoundedIcon />
              )
            }
            onClick={() => openCourse(courseId)}
          >
            {actionLabel}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box className="student-home">
      <Box className="top-strip student-top-strip">
        <Container maxWidth="xl" className="top-strip__inner">
          <span>
            <AutoAwesomeRoundedIcon fontSize="small" /> Keep learning. Keep
            growing.
          </span>
          <span className="top-strip__right">Your next skill starts here.</span>
        </Container>
      </Box>

      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        className="site-header"
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters className="site-header__toolbar">
            <button
              className="brand student-brand-button"
              onClick={() => goTo("home")}
              aria-label="Learnova home"
            >
              <LearnovaLogoMark className="brand__mark" />
              <span>
                Learnova<small>Learn · Grow · Succeed</small>
              </span>
            </button>

            <Box
              className={`desktop-nav ${mobileMenuOpen ? "desktop-nav--open" : ""}`}
            >
              <CourseExploreMenu
                categories={catalog.categories}
                loading={loading}
                label="Explore courses"
                allCoursesPath="/student/search"
                categoryPath={(id) => `/student/search?category=${encodeURIComponent(id)}`}
              />
              <button onClick={() => goTo("categories")}>
                Categories <ExpandMoreRoundedIcon />
              </button>
              <button onClick={openCommunity}>Community</button>
            </Box>

            <TextField
              className="header-search student-header-search"
              size="small"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearchSubmit();
                }
              }}
              placeholder="Search courses, skills, instructors..."
              slotProps={{
                htmlInput: {
                  "aria-label": "Search courses",
                  enterKeyHint: "search",
                },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon
                        sx={{ color: "#6d5be8", fontSize: 21 }}
                      />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        onClick={handleSearchSubmit}
                        aria-label="Search courses"
                        variant="contained"
                        size="small"
                        sx={{
                          minWidth: 76,
                          px: 1.6,
                          py: 0.8,
                          borderRadius: "10px",
                          background:
                            "linear-gradient(135deg, #6741f5 0%, #5530df 100%)",
                          boxShadow: "0 4px 10px rgba(91, 55, 225, 0.20)",
                          fontSize: 12,
                          fontWeight: 800,
                          textTransform: "none",
                          whiteSpace: "nowrap",
                          "&:hover": {
                            background:
                              "linear-gradient(135deg, #5530df 0%, #4522c6 100%)",
                            boxShadow: "0 5px 13px rgba(91, 55, 225, 0.28)",
                          },
                        }}
                      >
                        Search
                      </Button>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                flex: "1 1 390px",
                width: "100%",
                minWidth: 220,
                maxWidth: 430,
                mx: { xs: 0, md: 2.5 },
                "& .MuiOutlinedInput-root": {
                  minHeight: 46,
                  pl: 1.2,
                  pr: 0.6,
                  borderRadius: "15px",
                  backgroundColor: "#fff",
                  boxShadow: "0 5px 20px rgba(35, 25, 80, 0.06)",
                  transition:
                    "box-shadow .2s ease, border-color .2s ease, background-color .2s ease",
                  "& fieldset": { borderColor: "#e6e1f5" },
                  "&:hover fieldset": { borderColor: "#c7bafa" },
                  "&.Mui-focused": {
                    backgroundColor: "#fff",
                    boxShadow: "0 0 0 4px rgba(103, 65, 245, 0.09)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#7654f6",
                    borderWidth: 1,
                  },
                },
                "& .MuiInputBase-input": {
                  py: 1.25,
                  fontSize: 13,
                  fontWeight: 500,
                  "&::placeholder": { color: "#9692a8", opacity: 1 },
                },
              }}
            />

            <Button
              className="text-links"
              // endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => navigate("/student/my-learning")}
            >
              My Learning
            </Button>

            <Button
              className="text-links"
              onClick={() => navigate("/student/purchase-history")}
            >
              Purchase History
            </Button>

            <Box className="header-actions student-header-actions">
              <Tooltip title="Shopping cart">
                <IconButton
                  aria-label="Open cart"
                  onClick={() => navigate("/student/cart")}
                  className="student-header-icon"
                >
                  <Badge
                    badgeContent={cart?.items?.length || 0}
                    color="error"
                    max={99}
                  >
                    <ShoppingCartOutlinedIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title="Notifications">
                <IconButton
                  aria-label="Open notifications"
                  onClick={() => {
                    setActivePanel("notifications");
                    refreshDashboardNotifications();
                  }}
                  className="student-header-icon"
                >
                  <Badge
                    badgeContent={unreadNotifications}
                    color="primary"
                    max={99}
                  >
                    <NotificationsNoneRoundedIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title={`Profile: ${profileMenuName}`}>
                <IconButton
                  className="student-header-avatar"
                  aria-label="Open profile menu"
                  aria-haspopup="menu"
                  aria-expanded={Boolean(profileMenuAnchor)}
                  aria-controls={
                    profileMenuAnchor ? "student-profile-menu" : undefined
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    const anchor = event.currentTarget;
                    setProfileMenuAnchor((current) => (current ? null : anchor));
                  }}
                >
                  <Avatar
                    src={
                      user?.profile_image_url ||
                      user?.profileImageUrl ||
                      undefined
                    }
                  >
                    {String(firstName).charAt(0).toUpperCase()}
                  </Avatar>
                  <ExpandMoreRoundedIcon className="student-profile-chevron" />
                </IconButton>
              </Tooltip>
            </Box>

            <IconButton
              className="mobile-menu"
              onClick={() => setMobileMenuOpen((value) => !value)}
              aria-label="Toggle navigation"
            >
              <MenuRoundedIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={closeProfileMenu}
        disableScrollLock
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { className: "student-profile-menu-paper" },
          list: {
            id: "student-profile-menu",
            className: "student-profile-menu-list",
            "aria-label": "Student profile menu",
          },
        }}
      >
        <Box className="student-profile-menu-header">
          <Avatar
            className="student-profile-menu-avatar"
            src={
              user?.profile_image_url ||
              user?.profileImageUrl ||
              undefined
            }
          >
            {String(profileMenuName).charAt(0).toUpperCase()}
          </Avatar>
          <Box className="student-profile-menu-identity">
            <Typography component="strong">{profileMenuName}</Typography>
            <Typography component="span">{profileMenuEmail}</Typography>
          </Box>
        </Box>

        <Divider className="student-profile-menu-divider" />

        <MenuItem
          className="student-profile-menu-item"
          onClick={() => navigateFromProfileMenu("/student/my-learning")}
        >
          <ListItemIcon>
            <MenuBookRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="My learning" />
        </MenuItem>
        <MenuItem
          className="student-profile-menu-item"
          onClick={() => navigateFromProfileMenu("/student/wishlist")}
        >
          <ListItemIcon>
            <FavoriteBorderRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Wishlist" />
          {wishlist.courses.length > 0 && (
            <Badge
              className="student-profile-menu-badge"
              badgeContent={wishlist.courses.length}
              color="secondary"
              max={99}
            />
          )}
        </MenuItem>
        <MenuItem
          className="student-profile-menu-item"
          onClick={() => navigateFromProfileMenu("/student/cart")}
        >
          <ListItemIcon>
            <ShoppingCartOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="My cart" />
          {cart?.items?.length > 0 && (
            <Badge
              className="student-profile-menu-badge"
              badgeContent={cart.items.length}
              color="secondary"
              max={99}
            />
          )}
        </MenuItem>
        <MenuItem
          className="student-profile-menu-item"
          onClick={() => navigateFromProfileMenu("/student/purchase-history")}
        >
          <ListItemIcon>
            <AccessTimeRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Purchase history" />
        </MenuItem>

        <Divider className="student-profile-menu-divider" />

        <MenuItem
          className="student-profile-menu-item"
          onClick={() => {
            closeProfileMenu();
            setActivePanel("notifications");
          }}
        >
          <ListItemIcon>
            <NotificationsNoneRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Notifications" />
          {unreadNotifications > 0 && (
            <Badge
              className="student-profile-menu-badge"
              badgeContent={unreadNotifications}
              color="secondary"
              max={99}
            />
          )}
        </MenuItem>
        <MenuItem
          className="student-profile-menu-item"
          onClick={() => navigateFromProfileMenu("/community")}
        >
          <ListItemIcon>
            <GroupsRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Community" />
        </MenuItem>

        <Divider className="student-profile-menu-divider" />

        <MenuItem
          className="student-profile-menu-item"
          onClick={() => navigateFromProfileMenu("/student/profile")}
        >
          <ListItemIcon>
            <SettingsRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Account settings" />
        </MenuItem>
        <MenuItem
          className="student-profile-menu-item is-logout"
          onClick={() => {
            closeProfileMenu();
            handleLogout();
          }}
        >
          <ListItemIcon>
            <LogoutRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Log out" />
        </MenuItem>
      </Menu>

      <Box component="main">
        <section className="student-welcome" id="home">
          <Container maxWidth="xl" className="student-welcome__inner">
            <Box className="student-welcome__copy">
              <Typography className="student-welcome__eyebrow">
                YOUR LEARNING SPACE
              </Typography>
              <Typography component="h1" className="student-welcome__title">
                {timeGreeting}, {firstName}!
              </Typography>
              <Typography className="student-welcome__subtitle">
                Continue your learning journey and make steady progress toward
                your goals.
              </Typography>
              <Box className="student-welcome__quicklinks">
                <span>Popular topics:</span>
                {catalog.categories.slice(0, 4).map((category) => (
                  <button
                    key={categoryId(category)}
                    onClick={() => {
                      setSearchInput("");
                      setSearch("");
                      toggleCategory(categoryId(category));
                      setPage(1);
                      goTo("courses");
                    }}
                  >
                    {categoryName(category)}
                  </button>
                ))}
              </Box>
            </Box>
            <Box className="student-welcome__side-card">
              <span className="student-welcome__side-icon">
                <WorkspacePremiumRoundedIcon />
              </span>
              <Typography variant="overline">
                SMALL STEPS, BIG RESULTS
              </Typography>
              <Typography variant="h6">Make today a learning day.</Typography>
              <Typography variant="body2">
                Keep building skills at your own pace with Learnova.
              </Typography>
              <Button
                onClick={() => goTo("my-learning")}
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Resume learning
              </Button>
            </Box>
          </Container>
        </section>

        <section
          className="section student-dashboard-overview"
          aria-label="Learning overview"
        >
          <Container maxWidth="xl">
            <div className="student-dashboard-metrics">
              <Card className="student-dashboard-metric">
                <CardContent>
                  <Box className="student-dashboard-metric__icon is-blue">
                    <MenuBookRoundedIcon />
                  </Box>
                  <Typography className="student-dashboard-metric__label">
                    Active courses
                  </Typography>
                  <Typography className="student-dashboard-metric__value">
                    {learningLoading ? "—" : activeEnrollments.length}
                  </Typography>
                  <Typography className="student-dashboard-metric__hint">
                    Courses ready to continue
                  </Typography>
                </CardContent>
              </Card>

              <Card className="student-dashboard-metric">
                <CardContent>
                  <Box className="student-dashboard-metric__icon is-lilac">
                    <CheckCircleRoundedIcon />
                  </Box>
                  <Typography className="student-dashboard-metric__label">
                    Completed courses
                  </Typography>
                  <Typography className="student-dashboard-metric__value">
                    {learningLoading || courseProgressLoading || learningError
                      ? "—"
                      : completedCourseCount}
                  </Typography>
                  <Typography className="student-dashboard-metric__hint">
                    Courses you’ve finished
                  </Typography>
                </CardContent>
              </Card>

              <Card className="student-dashboard-metric">
                <CardContent>
                  <Box className="student-dashboard-metric__icon is-purple">
                    <TrendingUpRoundedIcon />
                  </Box>
                  <Typography className="student-dashboard-metric__label">
                    Overall learning progress
                  </Typography>
                  <Typography className="student-dashboard-metric__value">
                    {learningLoading || courseProgressLoading
                      ? "—"
                      : `${overallProgress}%`}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={overallProgress}
                    className="student-dashboard-metric__progress"
                  />
                </CardContent>
              </Card>

              <Card className="student-dashboard-metric">
                <CardContent>
                  <Box className="student-dashboard-metric__icon is-amber">
                    <EventAvailableRoundedIcon />
                  </Box>
                  <Typography className="student-dashboard-metric__label">
                    Upcoming assessments
                  </Typography>
                  <Typography className="student-dashboard-metric__value">
                    {dashboardFeedLoading ? "—" : pendingAssessments.length}
                  </Typography>
                  <Typography className="student-dashboard-metric__hint">
                    Available or still in progress
                  </Typography>
                </CardContent>
              </Card>

              <Card className="student-dashboard-metric">
                <CardContent>
                  <Box className="student-dashboard-metric__icon is-green">
                    <FactCheckRoundedIcon />
                  </Box>
                  <Typography className="student-dashboard-metric__label">
                    Recent results
                  </Typography>
                  <Typography className="student-dashboard-metric__value">
                    {dashboardFeedLoading
                      ? "—"
                      : Number.isFinite(latestResultPercentage)
                        ? `${latestResultPercentage}%`
                        : evaluatedResults.length || "—"}
                  </Typography>
                  <Typography className="student-dashboard-metric__hint">
                    {latestResult
                      ? `${latestResult.title ?? "Latest assessment"} · ${latestResultPassed ? "Passed" : "Needs review"}`
                      : "No evaluated assessments yet"}
                  </Typography>
                </CardContent>
              </Card>

              <Card className="student-dashboard-metric">
                <CardContent>
                  <Box className="student-dashboard-metric__icon is-gold">
                    <WorkspacePremiumRoundedIcon />
                  </Box>
                  <Typography className="student-dashboard-metric__label">
                    Certificates earned
                  </Typography>
                  <Typography className="student-dashboard-metric__value">
                    {learningLoading || certificatesLoading
                      ? "—"
                      : dashboardCertificates.length}
                  </Typography>
                  <Typography className="student-dashboard-metric__hint">
                    Completed course certificates
                  </Typography>
                </CardContent>
              </Card>
            </div>
          </Container>
        </section>

        <section className="section student-learning-section" id="my-learning">
          <Container maxWidth="xl">
            <div className="section-heading">
              <div>
                <Typography component="h2" className="section-heading__title">
                  Continue learning
                </Typography>
                <Typography className="section-heading__subtitle">
                  Your enrolled courses, all in one place.
                </Typography>
              </div>
              <Button
                className="text-link"
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => navigate("/student/my-learning")}
              >
                View My Learning
              </Button>
            </div>
            {learningLoading ? (
              <div className="loading-state">
                <CircularProgress size={25} />
                <span>Loading your courses...</span>
              </div>
            ) : learningError ? (
              <div className="catalog-message">
                <MenuBookRoundedIcon />
                <strong>Couldn't load My Learning</strong>
                <span>{learningError}</span>
                <Button onClick={loadMyEnrollments}>Try again</Button>
              </div>
            ) : myEnrollments.length ? (
              <div className="student-learning-grid">
                {myEnrollments.slice(0, 4).map(renderEnrollmentCard)}
              </div>
            ) : (
              <div className="student-continue-empty">
                <span className="student-panel-illustration">
                  <MenuBookRoundedIcon />
                </span>
                <Box className="student-continue-empty__copy">
                  <strong>Your learning journey starts here</strong>
                  <span>
                    Courses you enroll in will appear here so you can continue
                    anytime.
                  </span>
                </Box>
                <Button variant="outlined" onClick={() => goTo("courses")}>
                  Explore courses
                </Button>
              </div>
            )}
          </Container>
        </section>

        <section className="section student-courses-section" id="courses">
          <Container maxWidth="xl">
            <div className="section-heading">
              <div>
                <Typography component="h2" className="section-heading__title">
                  Explore courses
                </Typography>
                <Typography className="section-heading__subtitle">
                  Discover courses to help you build practical skills.
                </Typography>
              </div>
              <Chip
                className="student-results-chip"
                label={`${catalog.pagination.total ?? courses.length} courses`}
              />
            </div>
            <Box className="student-course-toolbar">
              <FormControl size="small" sx={{ minWidth: 210 }}>
                <InputLabel id="dashboard-categories-label" shrink>
                  Categories
                </InputLabel>
                <Select
                  labelId="dashboard-categories-label"
                  multiple
                  displayEmpty
                  label="Categories"
                  value={selectedCategories}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedCategories(
                      (typeof value === "string"
                        ? value.split(",")
                        : value
                      ).map(String),
                    );
                    setPage(1);
                  }}
                  renderValue={(selected) =>
                    selected.length
                      ? selected
                          .map((id) =>
                            categoryName(
                              catalog.categories.find(
                                (category) =>
                                  String(categoryId(category)) === String(id),
                              ) || { name: id },
                            ),
                          )
                          .join(", ")
                      : "All categories"
                  }
                >
                  {catalog.categories.map((category) => {
                    const id = String(categoryId(category));
                    return (
                      <MenuItem key={id} value={id}>
                        <Checkbox checked={selectedCategories.includes(id)} />
                        <ListItemText primary={categoryName(category)} />
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              <TextField
                select
                size="small"
                label="Level"
                value={levelFilter}
                onChange={(event) => {
                  setLevelFilter(event.target.value);
                  setPage(1);
                }}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="">All levels</MenuItem>
                <MenuItem value="BEGINNER">Beginner</MenuItem>
                <MenuItem value="INTERMEDIATE">Intermediate</MenuItem>
                <MenuItem value="ADVANCED">Advanced</MenuItem>
              </TextField>
              {selectedCategories.map((selectedId) => (
                <Chip
                  key={selectedId}
                  label={categoryName(
                    catalog.categories.find(
                      (category) => String(categoryId(category)) === selectedId,
                    ) || { name: "Filtered category" },
                  )}
                  onDelete={() => {
                    setSelectedCategories((current) =>
                      current.filter((id) => id !== selectedId),
                    );
                    setPage(1);
                  }}
                />
              ))}
              {levelFilter && (
                <Chip
                  label={`Level: ${levelFilter[0]}${levelFilter.slice(1).toLowerCase()}`}
                  onDelete={() => {
                    setLevelFilter("");
                    setPage(1);
                  }}
                />
              )}
              <Button
                className="student-clear-filters-button"
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<CloseRoundedIcon />}
                disabled={
                  !selectedCategories.length &&
                  !levelFilter &&
                  !search.trim() &&
                  !searchInput.trim()
                }
                onClick={() => {
                  setSelectedCategories([]);
                  setLevelFilter("");
                  setSearch("");
                  setSearchInput("");
                  setPage(1);
                }}
                sx={{
                  minHeight: 40,
                  px: 2,
                  borderRadius: "10px",
                  borderColor: "#ded9eb",
                  color: "#625b75",
                  fontSize: "13px",
                  fontWeight: 700,
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  "&:hover": {
                    borderColor: "#7654f6",
                    color: "#6741f5",
                    backgroundColor: "#f8f6ff",
                  },
                  "&.Mui-disabled": {
                    borderColor: "#e8e5ef",
                    color: "#aaa5b5",
                  },
                }}
              >
                Clear filters
              </Button>
            </Box>
            {loading ? (
              <div className="loading-state">
                <CircularProgress size={25} />
                <span>Finding courses for you...</span>
              </div>
            ) : apiError ? (
              <div className="catalog-message">
                <SchoolRoundedIcon />
                <strong>Course catalog is temporarily unavailable</strong>
                <span>
                  Check that the backend is running and the public catalog
                  endpoint is configured.
                </span>
                <Button onClick={() => setCatalogRefreshKey((key) => key + 1)}>
                  Try again
                </Button>
              </div>
            ) : courses.length ? (
              <div className="course-grid student-course-grid">
                {courses.map((course, index) => {
                  const id = course.id ?? course.course_id;
                  const title =
                    course.title ??
                    course.course_name ??
                    course.name ??
                    "Untitled course";
                  const instructor =
                    course.instructors?.[0]?.name ??
                    course.instructor_name ??
                    course.instructorName ??
                    course.instructor?.name ??
                    "Instructor details unavailable";
                  const category =
                    course.category_name ??
                    course.categoryName ??
                    course.category?.name ??
                    "Online course";
                  const image = courseImage(course);
                  const price =
                    course.price ?? course.price_amount ?? course.course_price;
                  const duration =
                    course.duration_hours ??
                    course.durationHours ??
                    course.duration ??
                    "Self-paced";
                  const lessons =
                    course.lesson_count ??
                    course.lessonCount ??
                    course.lessons_count;
                  return (
                    <Card
                      className="course-card student-course-card"
                      key={id ?? title}
                      onClick={() => openCourseDetails(id)}
                      sx={{ cursor: id ? "pointer" : "default" }}
                    >
                      <div className="course-card__image">
                        {image ? (
                          <img src={image} alt={title} loading="lazy" />
                        ) : (
                          <div
                            className={`course-art course-art--${index % 8}`}
                          >
                            <SchoolRoundedIcon />
                            <span>{category}</span>
                          </div>
                        )}
                        {index === 0 && page === 1 && (
                          <Chip className="course-badge" label="Featured" />
                        )}
                        <IconButton
                          className={`course-favorite${wishlist.isSaved(id) ? " is-saved" : ""}`}
                          aria-label={wishlist.isSaved(id) ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
                          aria-pressed={wishlist.isSaved(id)}
                          onClick={(event) => {
                            event.stopPropagation();
                            wishlist.toggle({ ...course, id });
                          }}
                        >
                          {wishlist.isSaved(id) ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}
                        </IconButton>
                      </div>
                      <CardContent className="course-card__content">
                        <span className="course-card__category">
                          {category}
                        </span>
                        <Typography
                          component="h3"
                          className="course-card__title"
                        >
                          {title}
                        </Typography>
                        <div className="course-card__instructor">
                          <Avatar>
                            {String(instructor).charAt(0).toUpperCase()}
                          </Avatar>
                          <span>{instructor}</span>
                        </div>
                        <div className="course-card__meta">
                          <span className="rating">
                            <StarRoundedIcon /> {course.rating ?? "New"}{" "}
                            {course.review_count
                              ? `(${course.review_count})`
                              : ""}
                          </span>
                          <span>
                            <AccessTimeRoundedIcon />{" "}
                            {typeof duration === "number"
                              ? `${duration} hrs`
                              : duration}
                          </span>
                        </div>
                        <Divider className="course-card__divider" />
                        <div className="course-card__bottom">
                          <strong>{money(price)}</strong>
                          {lessons != null && (
                            <small>
                              <MenuBookRoundedIcon /> {lessons} lessons
                            </small>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="catalog-message">
                <MenuBookRoundedIcon />
                <strong>
                  {search || levelFilter || selectedCategories.length
                    ? "No courses match your filters"
                    : "Courses are coming soon"}
                </strong>
                <span>
                  {search || levelFilter || selectedCategories.length
                    ? "Try another course name or adjust your category and level filters."
                    : "Published courses from your database will appear here automatically."}
                </span>
                {(search || levelFilter || selectedCategories.length > 0) && (
                  <Button
                    onClick={() => {
                      setSearchInput("");
                      setSearch("");
                      setSelectedCategories([]);
                      setLevelFilter("");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
            {!loading && !apiError && catalog.pagination.totalPages > 1 && (
              <Box display="flex" justifyContent="center" mt={4}>
                <Pagination
                  page={page}
                  count={catalog.pagination.totalPages}
                  onChange={(_, nextPage) => {
                    setPage(nextPage);
                    goTo("courses");
                  }}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
          </Container>
        </section>

        <section
          className="section student-dashboard-recent"
          aria-label="Recently viewed courses"
        >
          <Container maxWidth="xl">
            <div className="section-heading student-dashboard-recent__heading">
              <div>
                <Typography component="h2" className="section-heading__title">
                  Recently viewed courses
                </Typography>
                <Typography className="section-heading__subtitle">
                  Pick up where your course browsing left off.
                </Typography>
              </div>
              {recentlyViewedCourses.length > 0 && (
                <Button
                  className="student-dashboard-recent__clear"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={clearRecentlyViewedCourses}
                >
                  Clear history
                </Button>
              )}
            </div>

            {recentlyViewedCourses.length ? (
              <div className="student-dashboard-recent__grid">
                {recentlyViewedCourses.slice(0, 4).map((course, index) => {
                  const id = course.id ?? course.course_id;
                  const title = course.title ?? course.course_name ?? "Course";
                  const image = courseImage(course);
                  const category = course.category_name ?? "Online course";
                  const instructor = course.instructor_name ?? "Learnova instructor";
                  const viewedDate = formatDashboardDate(course.viewedAt);

                  return (
                    <Card
                      component={RouterLink}
                      to={`/courses/${encodeURIComponent(id)}`}
                      state={{ from: "/student/dashboard" }}
                      className="student-dashboard-recent__card"
                      key={id ?? title}
                      aria-label={`Open ${title}`}
                    >
                      <div className="student-dashboard-recent__image">
                        {image ? (
                          <img src={image} alt="" loading="lazy" />
                        ) : (
                          <div className={`student-dashboard-recent__placeholder tone-${index % 4}`}>
                            <SchoolRoundedIcon />
                          </div>
                        )}
                        <span className="student-dashboard-recent__viewed">
                          <HistoryRoundedIcon />
                          {viewedDate ? `Viewed ${viewedDate}` : "Recently viewed"}
                        </span>
                      </div>
                      <CardContent className="student-dashboard-recent__content">
                        <span className="student-dashboard-recent__category">{category}</span>
                        <Typography component="h3">{title}</Typography>
                        <span className="student-dashboard-recent__instructor">{instructor}</span>
                        <div className="student-dashboard-recent__footer">
                          <strong>{money(course.price)}</strong>
                          <span>View course <ArrowForwardRoundedIcon /></span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="student-dashboard-recent__empty">
                <span className="student-dashboard-recent__empty-icon">
                  <HistoryRoundedIcon />
                </span>
                <div>
                  <strong>Your course history will appear here</strong>
                  <p>Open a course to keep it handy for your next visit.</p>
                </div>
                <Button onClick={() => goTo("courses")} endIcon={<ArrowForwardRoundedIcon />}>
                  Explore courses
                </Button>
              </div>
            )}
          </Container>
        </section>

        <section
          className="section student-dashboard-widgets"
          aria-label="Your learning activity"
        >
          <Container maxWidth="xl">
            <div className="section-heading">
              <div>
                <Typography component="h2" className="section-heading__title">
                  Your learning activity
                </Typography>
                <Typography className="section-heading__subtitle">
                  Track course progress and recent community updates.
                </Typography>
              </div>
            </div>
            <div className="student-dashboard-widget-grid">
              <Card className="student-dashboard-widget">
                <CardContent>
                  <div className="student-dashboard-widget__header">
                    <div>
                      <Typography component="h3">Course progress</Typography>
                      <span>Progress across your enrolled courses</span>
                    </div>
                    <MenuBookRoundedIcon />
                  </div>
                  {learningLoading || courseProgressLoading ? (
                    <div className="student-dashboard-widget__empty">
                      <CircularProgress size={22} />
                    </div>
                  ) : progressEnrollments.length ? (
                    <div className="student-dashboard-progress-list">
                      {progressEnrollments.slice(0, 3).map((enrollment) => {
                        const courseId = enrollmentCourseId(enrollment);
                        const title =
                          enrollment.title ??
                          enrollment.course_title ??
                          enrollment.course?.title ??
                          "Your course";
                        const progress = Math.min(
                          100,
                          Math.max(
                            0,
                            courseProgressById[String(courseId)] ??
                              getEnrollmentProgress(enrollment),
                          ),
                        );
                        return (
                          <div
                            className="student-dashboard-progress-item"
                            key={
                              enrollment.enrollment_id ??
                              enrollment.enrollmentId ??
                              courseId ??
                              title
                            }
                          >
                            <div className="student-dashboard-progress-item__top">
                              <strong>{title}</strong>
                              <span>{progress}%</span>
                            </div>
                            <LinearProgress
                              variant="determinate"
                              value={progress}
                            />
                            <Button
                              size="small"
                              onClick={() => openCourse(courseId)}
                            >
                              Continue learning
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="student-dashboard-widget__empty">
                      <span>
                        {learningEnrollments.length
                          ? "You're all caught up. Completed courses are available in My Learning."
                          : "No course progress to show yet."}
                      </span>
                      <Button
                        size="small"
                        onClick={() =>
                          learningEnrollments.length
                            ? navigate("/student/my-learning")
                            : goTo("courses")
                        }
                      >
                        {learningEnrollments.length
                          ? "View My Learning"
                          : "Explore courses"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="student-dashboard-widget student-dashboard-streak-widget">
                <CardContent>
                  <div className="student-dashboard-widget__header">
                    <div>
                      <Typography component="h3">Learning streak</Typography>
                      <span>Keep a steady learning rhythm</span>
                    </div>
                    <LocalFireDepartmentRoundedIcon />
                  </div>
                  {learningActivityLoading ? (
                    <div className="student-dashboard-widget__empty"><CircularProgress size={22} /></div>
                  ) : (
                    <>
                      <div className="student-streak-count"><strong>{learningStreak}</strong><span>{learningStreak === 1 ? "day" : "days"} in a row</span></div>
                      <div className="student-streak-week" aria-label="Learning activity over the past seven days">
                        {learningWeek.map((day, index) => (
                          <span className={day.active ? "is-active" : ""} key={`${day.label}-${index}`}>
                            <i aria-hidden="true" />{day.label}
                          </span>
                        ))}
                      </div>
                      <p className="student-streak-note">Activity is counted when your lesson progress is saved.</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="student-dashboard-widget student-dashboard-achievements-widget">
                <CardContent>
                  <div className="student-dashboard-widget__header">
                    <div>
                      <Typography component="h3">Achievements</Typography>
                      <span>{achievementCards.filter((item) => item.unlocked).length} of {achievementCards.length} earned</span>
                    </div>
                    <MilitaryTechRoundedIcon />
                  </div>
                  <div className="student-achievement-grid">
                    {achievementCards.map((achievement) => (
                      <div className={`student-achievement${achievement.unlocked ? " is-unlocked" : ""}`} key={achievement.id}>
                        <span>{achievement.icon}</span>
                        <div><strong>{achievement.title}</strong><small>{achievement.detail}</small></div>
                        {achievement.unlocked && <CheckCircleRoundedIcon className="student-achievement__check" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="student-dashboard-widget">
                <CardContent>
                  <div className="student-dashboard-widget__header">
                    <div>
                      <Typography component="h3">
                        Recent notifications
                      </Typography>
                      <span>
                        {unreadNotifications
                          ? `${unreadNotifications} unread update${unreadNotifications === 1 ? "" : "s"}`
                          : "Your latest community updates"}
                      </span>
                    </div>
                    <NotificationsNoneRoundedIcon />
                  </div>
                  {dashboardFeedLoading ? (
                    <div className="student-dashboard-widget__empty">
                      <CircularProgress size={22} />
                    </div>
                  ) : dashboardNotifications.length ? (
                    <div className="student-dashboard-list student-dashboard-notifications">
                      {dashboardNotifications
                        .slice(0, 3)
                        .map((notification, index) => (
                          <div
                            className="student-dashboard-notification"
                            key={
                              notification.id ??
                              `${notification.title}-${index}`
                            }
                          >
                            <span
                              className={`student-dashboard-notification__dot${notification.is_read ? " is-read" : ""}`}
                            />
                            <div>
                              <strong>
                                {notification.title ?? "Community update"}
                              </strong>
                              <p>
                                {notification.message ??
                                  "There is a new update for you."}
                              </p>
                              <small>
                                {notification.created_at
                                  ? formatDashboardDate(notification.created_at)
                                  : ""}
                              </small>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="student-dashboard-widget__empty">
                      <span>
                        You're all caught up. New announcements and
                        notifications will appear here.
                      </span>
                    </div>
                  )}
                  <Button
                    className="student-dashboard-widget__footer-link"
                    size="small"
                    onClick={() => navigate("/community/notifications")}
                  >
                    View all notifications
                  </Button>
                </CardContent>
              </Card>
            </div>
          </Container>
        </section>

        {(loading || catalog.categories.length > 0) && (
        <section className="section student-categories-section" id="categories">
          <Container maxWidth="xl">
            <div className="section-heading">
              <div>
                <Typography component="h2" className="section-heading__title">
                  Explore by category
                </Typography>
                <Typography className="section-heading__subtitle">
                  Choose one or more categories to find related courses.
                </Typography>
              </div>
            </div>
            {catalog.categories.length ? (
              <div className="category-grid student-category-grid">
                {catalog.categories.slice(0, 8).map((category, index) => {
                  const visual =
                    categoryVisuals[index % categoryVisuals.length];
                  const id = String(categoryId(category));
                  return (
                    <button
                      className={`category-card ${selectedCategories.includes(id) ? "category-card--selected" : ""}`}
                      key={id}
                      onClick={() => {
                        toggleCategory(id);
                        goTo("courses");
                      }}
                    >
                      <span className={`category-card__icon ${visual.tone}`}>
                        {visual.icon}
                      </span>
                      <strong>{categoryName(category)}</strong>
                      <small>
                        {category.course_count ??
                          category.courseCount ??
                          "Explore"}{" "}
                        {category.course_count != null ||
                        category.courseCount != null
                          ? "courses"
                          : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
            ) : loading ? (
              <div className="loading-state">
                <CircularProgress size={22} />
                <span>Loading categories...</span>
              </div>
            ) : (
              <Typography color="text.secondary">
                No categories are available yet.
              </Typography>
            )}
          </Container>
        </section>
        )}


      </Box>

      <LearnovaFooter
        categories={catalog.categories}
        courses={catalog.courses}
        isStudent
        onBrowse={browseFooterSection}
        onCategorySelect={selectFooterCategory}
        onCourseSelect={(course) =>
          openCourseDetails(course?.id ?? course?.course_id)
        }
      />

      <Dialog
        open={Boolean(activePanel)}
        onClose={() => setActivePanel(null)}
        fullWidth
        maxWidth="sm"
        className={`student-panel-dialog ${
          activePanel === "notifications" ? "student-notifications-dialog" : ""
        }`}
      >
        <DialogTitle className="student-panel-title">
          {activePanel === "notifications" ? (
            <Box className="notification-dialog-heading">
              <Box>
                <Typography component="h2">Notifications</Typography>
                <Typography component="p">
                  Stay updated with your learning community.
                </Typography>
              </Box>
              {dashboardUnreadCount > 0 && (
                <Chip
                  label={`${dashboardUnreadCount} unread`}
                  className="notification-unread-count"
                  size="small"
                />
              )}
            </Box>
          ) : (
            <>
              {activePanel === "learning" && "My Learning"}
            </>
          )}
          <IconButton
            aria-label="Close panel"
            onClick={() => setActivePanel(null)}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {activePanel === "learning" && (
            <Box className="student-learning-panel">
              {learningLoading ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    py: 5,
                    gap: 2,
                  }}
                >
                  <CircularProgress size={24} />
                  <Typography>Loading your courses...</Typography>
                </Box>
              ) : learningError ? (
                <Box className="student-panel-empty">
                  <strong>Couldn't load My Learning</strong>
                  <p>{learningError}</p>
                  <Button variant="contained" onClick={loadMyEnrollments}>
                    Try again
                  </Button>
                </Box>
              ) : myEnrollments.length === 0 ? (
                <div className="student-panel-empty">
                  <span className="student-panel-illustration">
                    <MenuBookRoundedIcon />
                  </span>
                  <strong>You haven't enrolled in a course yet</strong>
                  <p>
                    Your enrolled courses will appear here after you enroll.
                  </p>
                  <Button
                    variant="contained"
                    onClick={() => {
                      setActivePanel(null);
                      goTo("courses");
                    }}
                  >
                    Explore courses
                  </Button>
                </div>
              ) : (
                <Box display="grid" gap={2}>
                  {myEnrollments.map((enrollment) => {
                    const enrollmentId =
                      enrollment.enrollment_id ?? enrollment.enrollmentId;
                    const courseId =
                      enrollment.course_id ??
                      enrollment.courseId ??
                      enrollment.course?.id;
                    const title =
                      enrollment.title ??
                      enrollment.course_title ??
                      enrollment.course?.title ??
                      "Untitled course";
                    const image =
                      courseImage(enrollment) ||
                      courseImage(enrollment.course ?? {});
                    const status = String(
                      enrollment.enrollment_status ??
                        enrollment.status ??
                        "ACTIVE",
                    ).toUpperCase();
                    const isRemoving =
                      removingEnrollmentId === String(enrollmentId);
                    return (
                      <Card
                        key={enrollmentId ?? courseId ?? title}
                        variant="outlined"
                      >
                        <Box
                          sx={{
                            display: "flex",
                            gap: 2,
                            p: 2,
                            alignItems: "center",
                          }}
                        >
                          {image ? (
                            <Box
                              component="img"
                              src={image}
                              alt={title}
                              sx={{
                                width: 96,
                                height: 68,
                                objectFit: "cover",
                                borderRadius: 1,
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 96,
                                height: 68,
                                bgcolor: "action.hover",
                                borderRadius: 1,
                              }}
                            >
                              <MenuBookRoundedIcon />
                            </Box>
                          )}
                          <Box flex={1} minWidth={0}>
                            <Typography fontWeight={700}>{title}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {status}
                            </Typography>
                            <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                              <Button
                                size="small"
                                onClick={() => {
                                  setActivePanel(null);
                                  openCourse(courseId);
                                }}
                              >
                                Continue learning
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteOutlineRoundedIcon />}
                                disabled={
                                  !enrollmentId ||
                                  status !== "ACTIVE" ||
                                  isRemoving ||
                                  removingEnrollmentId !== null
                                }
                                onClick={() => {
                                  setRemoveEnrollmentError("");
                                  setRemoveEnrollmentTarget(enrollment);
                                }}
                              >
                                Remove course
                              </Button>
                            </Box>
                            {status === "COMPLETED" && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Completed courses cannot be removed here.
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              )}
              {removeEnrollmentError && !removeEnrollmentTarget && (
                <Typography
                  role="alert"
                  color="error"
                  variant="body2"
                  sx={{ mt: 2 }}
                >
                  {removeEnrollmentError}
                </Typography>
              )}
            </Box>
          )}
          {activePanel === "notifications" && (
            <Box className="student-notification-panel">
              {dashboardFeedLoading ? (
                <Box className="student-notification-loading">
                  <CircularProgress size={28} />
                  <Typography>Loading notifications...</Typography>
                </Box>
              ) : dashboardNotifications.length > 0 ? (
                <>
                  <Box className="notification-panel-toolbar">
                    <Typography component="p">
                      {dashboardNotifications.length} recent updates
                    </Typography>
                    {dashboardUnreadCount > 0 && (
                      <Button
                        size="small"
                        startIcon={<CheckCircleRoundedIcon />}
                        onClick={handleAllNotificationsRead}
                      >
                        Mark all as read
                      </Button>
                    )}
                  </Box>

                  <Box className="student-notification-list">
                    {dashboardNotifications.map((notification, index) => (
                      <Box
                        className={`student-notification-card ${
                          notification.is_read ? "is-read" : "is-unread"
                        }`}
                        key={
                          notification.id ?? `${notification.title}-${index}`
                        }
                      >
                        <Avatar className="student-notification-icon">
                          <NotificationsNoneRoundedIcon />
                        </Avatar>

                        <Box className="student-notification-content">
                          <Box className="student-notification-title-row">
                            <Typography component="strong">
                              {notification.title ?? "Community update"}
                            </Typography>
                            {!notification.is_read && (
                              <span
                                className="notification-unread-dot"
                                aria-label="Unread"
                              />
                            )}
                          </Box>

                          <Typography
                            component="p"
                            className="student-notification-message"
                          >
                            {notification.message ??
                              "There is a new update for you."}
                          </Typography>

                          <Typography
                            component="time"
                            className="student-notification-date"
                          >
                            {notification.created_at
                              ? new Date(
                                  notification.created_at,
                                ).toLocaleString()
                              : ""}
                          </Typography>

                          <Box className="student-notification-actions">
                            {!notification.is_read && (
                              <Button
                                size="small"
                                onClick={() =>
                                  handleNotificationRead(notification)
                                }
                              >
                                Mark as read
                              </Button>
                            )}
                            {notification.post_id && (
                              <Button
                                size="small"
                                endIcon={<ArrowForwardRoundedIcon />}
                                onClick={async () => {
                                  await handleNotificationRead(notification);
                                  setActivePanel(null);
                                  navigate(
                                    `/community/posts/${notification.post_id}`,
                                  );
                                }}
                              >
                                View discussion
                              </Button>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </Box>

                  <Button
                    className="notification-view-all"
                    fullWidth
                    endIcon={<ArrowForwardRoundedIcon />}
                    onClick={() => {
                      setActivePanel(null);
                      navigate("/community/notifications");
                    }}
                  >
                    View all notifications
                  </Button>
                </>
              ) : (
                <Box className="student-notification-empty">
                  <Avatar>
                    <NotificationsNoneRoundedIcon />
                  </Avatar>
                  <Typography component="h3">You're all caught up!</Typography>
                  <Typography component="p">
                    Course milestones, assessment results, payment updates, certificates, and community activity will appear here.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions
          className={
            activePanel === "notifications" ? "notification-dialog-actions" : ""
          }
        >
          <Button onClick={() => setActivePanel(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(removeEnrollmentTarget)}
        onClose={() => {
          if (removingEnrollmentId === null) {
            setRemoveEnrollmentTarget(null);
            setRemoveEnrollmentError("");
          }
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Remove course?</DialogTitle>
        <DialogContent>
          <Typography>
            Remove{" "}
            <strong>
              {removeEnrollmentTarget?.title ??
                removeEnrollmentTarget?.course_title ??
                "this course"}
            </strong>{" "}
            from My Learning? You can enroll again later if the course is
            available.
          </Typography>
          {removeEnrollmentError && (
            <Typography
              role="alert"
              color="error"
              variant="body2"
              sx={{ mt: 2 }}
            >
              {removeEnrollmentError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRemoveEnrollmentTarget(null);
              setRemoveEnrollmentError("");
            }}
            disabled={removingEnrollmentId !== null}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleRemoveEnrollment}
            disabled={removingEnrollmentId !== null}
          >
            {removingEnrollmentId !== null ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Remove course"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default StudentDashboard;
