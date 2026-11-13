import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputAdornment,
  MenuItem,
  Pagination,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import LearnovaLogoMark from "../../../component/LearnovaLogoMark";
import api from "../../../service/Api";
import { matchesCourseSearch } from "../../../utils/courseSearch";
import "./CourseSearchResults.scss";

function formatPrice(course) {
  if (
    String(course?.course_type || "").toUpperCase() === "FREE" ||
    Number(course?.price) === 0
  ) {
    return "Free";
  }

  if (course?.price === null || course?.price === undefined || course?.price === "") {
    return "Price unavailable";
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: course.currency_code || "INR",
      maximumFractionDigits: 0,
    }).format(Number(course.price));
  } catch {
    return `${course.currency_code || "INR"} ${course.price}`;
  }
}

function normalizeCatalog(response) {
  const root = response?.data?.data ?? response?.data ?? {};
  return {
    courses: Array.isArray(root.courses) ? root.courses : [],
    categories: Array.isArray(root.categories) ? root.categories : [],
    pagination: root.pagination ?? { page: 1, total: 0, totalPages: 1 },
  };
}

function categoryId(category) {
  return category?.id ?? category?.category_id ?? category?.categoryId ?? category?.code ?? "";
}

function categoryName(category) {
  return category?.name ?? category?.category_name ?? category?.title ?? "Category";
}

function courseInstructor(course) {
  return (
    course?.instructors?.[0]?.name ||
    course?.instructor_name ||
    course?.instructorName ||
    course?.instructor?.name ||
    "Learnova instructor"
  );
}

function formatDuration(minutes) {
  const totalMinutes = Number(minutes || 0);
  if (!totalMinutes) return "Self-paced";
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (!hours) return `${remainingMinutes} min`;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

export default function CourseSearchResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const categoryQuery = (searchParams.get("category") || "").trim();
  const isStudentWorkspace = location.pathname.startsWith("/student/");
  const backPath = isStudentWorkspace ? "/student/dashboard" : "/";
  const searchInputRef = useRef(null);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState("newest");
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = JSON.stringify({ query, categoryQuery, level, sort, page, retryCount });
  const [catalogState, setCatalogState] = useState({
    requestKey: "",
    courses: [],
    categories: [],
    pagination: { page: 1, total: 0, totalPages: 1 },
    error: "",
    loading: false,
  });
  const hasCurrentCatalog = catalogState.requestKey === requestKey;
  const courses = catalogState.courses;
  const visibleCourses = courses.filter((course) =>
    matchesCourseSearch(course, query),
  );
  const categories = catalogState.categories;
  const pagination = catalogState.pagination;
  const loading = !hasCurrentCatalog || catalogState.loading;
  const error = hasCurrentCatalog ? catalogState.error : "";

  const setPage = (nextPage) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextPage > 1) nextParams.set("page", String(nextPage));
    else nextParams.delete("page");
    setSearchParams(nextParams);
  };

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/public/catalog", {
        params: {
          page,
          limit: 10,
          ...(query ? { search: query } : {}),
          ...(categoryQuery ? { categories: categoryQuery } : {}),
          ...(level ? { level } : {}),
          sort,
        },
        signal: controller.signal,
      })
      .then((response) => {
        if (controller.signal.aborted) return;
        const catalog = normalizeCatalog(response);
        setCatalogState({
          requestKey,
          courses: catalog.courses,
          categories: catalog.categories,
          pagination: catalog.pagination,
          error: "",
          loading: false,
        });
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setCatalogState((current) => ({
          ...current,
          requestKey,
          error:
            requestError?.response?.data?.message ||
            "We couldn't load search results. Please try again.",
          loading: false,
        }));
      });

    return () => controller.abort();
  }, [query, categoryQuery, level, sort, page, retryCount, requestKey]);

  const submitSearch = (event) => {
    event.preventDefault();
    const nextQuery = searchInputRef.current?.value.trim() ?? "";
    setLevel("");
    setSort("newest");
    setSearchParams(nextQuery ? { q: nextQuery } : {});
  };

  const openCourseFromResults = `${location.pathname}${location.search}`;

  return (
    <main className="student-search-page">
      <header className="student-search-header">
        <Container maxWidth="xl" className="student-search-header__inner student-page-content">
          <div className="student-search-header__brand-group">
            <RouterLink
              className="student-search-back-arrow"
              to={backPath}
              aria-label={isStudentWorkspace ? "Back to student dashboard" : "Back to home"}
              title={isStudentWorkspace ? "Back to dashboard" : "Back to home"}
            >
              <ArrowBackRoundedIcon />
            </RouterLink>
            <button
              className="student-search-brand"
              type="button"
              onClick={() => navigate(backPath)}
              aria-label={isStudentWorkspace ? "Go to student dashboard" : "Go to home"}
            >
              <LearnovaLogoMark
                className="student-search-brand__mark"
                size="small"
              />
              <span>Learnova</span>
            </button>
          </div>

          <form className="student-search-form" onSubmit={submitSearch}>
            <TextField
              key={query}
              fullWidth
              size="small"
              inputRef={searchInputRef}
              defaultValue={query}
              placeholder="Search courses, skills, instructors..."
              inputProps={{ "aria-label": "Search courses" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" variant="contained" aria-label="Search">
              <SearchRoundedIcon />
            </Button>
          </form>

        </Container>
      </header>

      <Container maxWidth="xl" className="student-search-content student-page-content">
        <div className="student-search-heading">
          <div>
            <span className="student-search-eyebrow">COURSE CATALOG</span>
            <Typography component="h1">
              {query ? (
                <>Results for <strong>“{query}”</strong></>
              ) : categoryQuery ? (
                `Courses in ${categoryName(categories.find((item) => String(categoryId(item)) === categoryQuery) ?? {})}`
              ) : (
                "Explore courses"
              )}
            </Typography>
            <Typography className="student-search-count">
              {loading
                ? "Finding courses for you..."
                : `${pagination.total ?? courses.length} ${
                    (pagination.total ?? courses.length) === 1 ? "course" : "courses"
                  } available`}
            </Typography>
          </div>
          <div className="student-search-heading__badge">
            <SearchRoundedIcon />
            <span>Find your next skill</span>
          </div>
        </div>

        <div className="student-search-toolbar" aria-label="Course filters">
          <FormControl size="small" className="student-search-filter">
            <Select
              value={categoryQuery}
              displayEmpty
              onChange={(event) => {
                const nextCategory = String(event.target.value);
                const nextParams = new URLSearchParams(searchParams);
                if (nextCategory) nextParams.set("category", nextCategory);
                else nextParams.delete("category");
                nextParams.delete("page");
                setSearchParams(nextParams);
              }}
              inputProps={{ "aria-label": "Filter by category" }}
            >
              <MenuItem value="">All categories</MenuItem>
              {categories.map((item) => (
                <MenuItem key={categoryId(item) || categoryName(item)} value={String(categoryId(item))}>
                  {categoryName(item)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" className="student-search-filter">
            <Select
              value={level}
              displayEmpty
              onChange={(event) => {
                setLevel(event.target.value);
                setPage(1);
              }}
              inputProps={{ "aria-label": "Filter by level" }}
            >
              <MenuItem value="">All levels</MenuItem>
              <MenuItem value="BEGINNER">Beginner</MenuItem>
              <MenuItem value="INTERMEDIATE">Intermediate</MenuItem>
              <MenuItem value="ADVANCED">Advanced</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" className="student-search-filter student-search-sort">
            <Select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              inputProps={{ "aria-label": "Sort courses" }}
            >
              <MenuItem value="newest">Newest</MenuItem>
              <MenuItem value="title">Title A–Z</MenuItem>
              <MenuItem value="price_low">Price: low to high</MenuItem>
              <MenuItem value="price_high">Price: high to low</MenuItem>
            </Select>
          </FormControl>
        </div>

        {loading ? (
          <div className="student-search-state">
            <CircularProgress size={28} />
            <span>Loading courses...</span>
          </div>
        ) : error ? (
          <div className="student-search-empty">
            <Alert severity="error" className="student-search-error">
              {error}
            </Alert>
            <Button variant="outlined" onClick={() => setRetryCount((count) => count + 1)}>
              Try again
            </Button>
          </div>
        ) : visibleCourses.length ? (
          <div className="student-search-list">
            {visibleCourses.map((course) => {
              const id = course.id ?? course.course_id;
              const title = course.title ?? course.course_name ?? "Untitled course";
              const instructor = courseInstructor(course);
              const categoryName = course.category_name ?? course.categoryName ?? "Online course";
              const image =
                course.thumbnail_url ||
                course.thumbnailUrl ||
                course.thumbnail ||
                course.image_url ||
                course.course_thumbnail ||
                "";

              return (
                <Card className="student-search-result" key={id ?? title}>
                  <CardActionArea
                    className="student-search-result__action"
                    component={RouterLink}
                    to={`/courses/${encodeURIComponent(id)}`}
                    state={{ from: openCourseFromResults }}
                    disabled={id === null || id === undefined}
                  >
                    <div className="student-search-result__image">
                      {image ? <img src={image} alt={title} loading="lazy" /> : (
                        <div className="student-search-result__placeholder">
                          <SchoolRoundedIcon />
                          <span>{categoryName}</span>
                        </div>
                      )}
                    </div>

                    <div className="student-search-result__body">
                      <div className="student-search-result__category-row">
                        <span>{categoryName}</span>
                        {course.level && (
                          <Chip
                            size="small"
                            label={String(course.level).toLowerCase()}
                            className="student-search-result__level"
                          />
                        )}
                      </div>
                      <Typography component="h2" className="student-search-result__title">
                        {title}
                      </Typography>
                      <Typography className="student-search-result__description">
                        {course.short_description || course.description || "Build practical skills with this course."}
                      </Typography>
                      <div className="student-search-result__meta">
                        <span className="student-search-result__rating">
                          <StarRoundedIcon /> {course.rating ?? "New"}
                          {course.review_count ? ` (${course.review_count} ratings)` : ""}
                        </span>
                        <span><Avatar>{String(instructor).charAt(0).toUpperCase()}</Avatar>{instructor}</span>
                        <span><MenuBookRoundedIcon /> {course.lesson_count ?? 0} lessons</span>
                      </div>
                    </div>

                    <div className="student-search-result__price">
                      <strong>{formatPrice(course)}</strong>
                      <span><AccessTimeRoundedIcon /> {formatDuration(course.duration_minutes)}</span>
                      <span className="student-search-result__view">View course <ArrowForwardRoundedIcon /></span>
                    </div>
                  </CardActionArea>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="student-search-empty">
            <span className="student-search-empty__icon"><SearchRoundedIcon /></span>
            <Typography component="h2">No courses found</Typography>
            <Typography>
              Try a different course name, skill, or instructor, or adjust the filters.
            </Typography>
            <Button variant="outlined" onClick={() => {
              setLevel("");
              setSort("newest");
              if (searchInputRef.current) searchInputRef.current.value = "";
              setSearchParams({});
            }}>
              Clear search and filters
            </Button>
          </div>
        )}

        {!loading && pagination.totalPages > 1 && (
          <div className="student-search-pagination">
            <Pagination
              page={page}
              count={pagination.totalPages}
              color="primary"
              onChange={(_, nextPage) => {
                setPage(nextPage);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        )}
      </Container>
    </main>
  );
}
