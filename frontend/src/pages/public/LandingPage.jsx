import { useCallback, useEffect, useState } from "react";
import api from "../../service/Api";
import { matchesCourseSearch } from "../../utils/courseSearch";
import {
  AppBar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import CourseCard from "../../component/Course/CourseCard";
import LearnovaFooter from "../../component/LearnovaFooter";

import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import LearnovaLogoMark from "../../component/LearnovaLogoMark";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import SpaRoundedIcon from "@mui/icons-material/SpaRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

import { useNavigate } from "react-router-dom";
import CourseExploreMenu from "../../component/CourseExploreMenu";
import "./LandingPage.scss";

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

const featureItems = [
  {
    icon: <SchoolRoundedIcon />,
    title: "Expert instructors",
    text: "Learn from industry professionals and experts.",
    tone: "purple",
  },
  {
    icon: <PlayCircleFilledRoundedIcon />,
    title: "Flexible learning",
    text: "Study at your own pace, anytime, anywhere.",
    tone: "green",
  },
  {
    icon: <WorkspacePremiumRoundedIcon />,
    title: "Get certified",
    text: "Track your progress as you complete your learning.",
    tone: "orange",
  },
  {
    icon: <GroupsRoundedIcon />,
    title: "Learn and grow",
    text: "Build your knowledge one course at a time.",
    tone: "blue",
  },
];

// Supports common API response structures.
function normalizeCatalog(payload) {
  const root = payload?.data ?? payload ?? {};
  const data = root?.data ?? root;

  const courses = data?.courses ?? data?.featuredCourses ?? data?.items ?? [];

  const categories = data?.categories ?? data?.courseCategories ?? [];

  return {
    courses: Array.isArray(courses) ? courses : [],
    categories: Array.isArray(categories) ? categories : [],
    stats: data?.stats ?? data?.statistics ?? {},
    pagination: data?.pagination ?? {
      page: 1,
      limit: 10,
      total: Array.isArray(courses) ? courses.length : 0,
      totalPages: 1,
    },
  };
}

function getCategoryName(category) {
  return (
    category?.name ?? category?.category_name ?? category?.title ?? "Category"
  );
}

function getCategoryId(category) {
  return category?.id ?? category?.category_id ?? getCategoryName(category);
}

function LandingPage() {
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState({
    courses: [],
    categories: [],
    stats: {},
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [levelFilter, setLevelFilter] = useState("");
  const [priceFilter, setPriceFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Search, filters, sorting and pagination are sent to the backend so the
  // browser can search the complete database, not only the first 10 courses.
  const loadCatalog = useCallback(
    async (signal) => {
      setLoading(true);
      setApiError("");

      try {
        const response = await api.get("/public/catalog", {
          params: {
            search: search.trim(),
            categories: selectedCategories.join(","),
            level: levelFilter,
            price: priceFilter,
            sort: sortBy,
            page,
            limit: 10,
          },
          ...(signal ? { signal } : {}),
        });

        setCatalog(normalizeCatalog(response.data));
      } catch (error) {
        if (error?.name !== "CanceledError" && error?.code !== "ERR_CANCELED") {
          setApiError(
            error?.response?.data?.message ||
              "Course catalog is unavailable. Please try again.",
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [search, selectedCategories, levelFilter, priceFilter, sortBy, page],
  );

  // Debounce search typing; other filters and page changes use the same request.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        loadCatalog(controller.signal);
      },
      search.trim() ? 350 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadCatalog, search]);

  const visibleCourses = catalog.courses.filter((course) =>
    matchesCourseSearch(course, search),
  );
  const totalCourses = Number(
    catalog.pagination?.total ?? visibleCourses.length,
  );
  const totalPages = Math.max(1, Number(catalog.pagination?.totalPages ?? 1));

  const publishedCount =
    catalog.stats?.publishedCourses ??
    catalog.stats?.published_courses ??
    catalog.pagination?.total ??
    catalog.courses.length;

  const studentCount =
    catalog.stats?.activeStudents ?? catalog.stats?.active_students ?? null;

  const instructorCount =
    catalog.stats?.expertInstructors ??
    catalog.stats?.expert_instructors ??
    catalog.stats?.active_instructors ??
    catalog.stats?.activeInstructors ??
    null;

  const goTo = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setMobileMenuOpen(false);
  };

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/courses?q=${encodeURIComponent(query)}` : "/courses");
    setMobileMenuOpen(false);
  };

  const openCourse = (course) => {
    const id = course?.id ?? course?.course_id;

    if (!id) return;

    // Change this path later if your app uses a different course route.
    navigate(`/courses/${encodeURIComponent(id)}`, {
      state: { from: "/" },
    });
  };

  const selectFooterCategory = (category) => {
    const id = getCategoryId(category);
    navigate(`/courses?category=${encodeURIComponent(String(id))}`);
  };

  const browseFooterSection = (section) => {
    if (section === "courses") {
      navigate("/courses");
      return;
    }

    goTo(section);
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedCategories([]);
    setLevelFilter("");
    setPriceFilter("");
    setSortBy("newest");
    setPage(1);
  };

  return (
    <Box className="landing-page">
      <Box className="top-strip">
        <Container maxWidth="xl" className="top-strip__inner">
          <span>
            <AutoAwesomeRoundedIcon fontSize="small" />
            Learn from the best, build a brighter future
          </span>
          <span className="top-strip__right">
            Practical skills. Real opportunities.
          </span>
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
            <a className="brand" href="#home" aria-label="Learnova home">
              <LearnovaLogoMark className="brand__mark" />
              <span>
                Learnova
                <small>Learn · Grow · Succeed</small>
              </span>
            </a>

            <Box
              className={`desktop-nav ${
                mobileMenuOpen ? "desktop-nav--open" : ""
              }`}
            >
              <CourseExploreMenu
                categories={catalog.categories}
                loading={loading}
                allCoursesPath="/courses"
                categoryPath={(id) => `/courses?category=${encodeURIComponent(id)}`}
              />
              <button onClick={() => goTo("categories")}>
                Categories <KeyboardArrowDownRoundedIcon />
              </button>
              <button onClick={() => goTo("why-learnova")}>
                Learn <KeyboardArrowDownRoundedIcon />
              </button>
            </Box>

            <Box component="form" className="hero-search" onSubmit={submitSearch}>
              <SearchRoundedIcon />
              <input
                type="search"
                aria-label="What do you want to learn today?"
                placeholder="What do you want to learn today?"
                value={search}
                onChange={(event) => handleSearch(event.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Search
              </Button>
            </Box>

            <Box className="header-actions">
              <Button
                className="instructor-link"
                onClick={() => navigate("/register/instructor")}
              >
                Become an Instructor
              </Button>
              <Button
                variant="outlined"
                className="login-button"
                onClick={() => navigate("/login")}
              >
                Log in
              </Button>
              <Button
                variant="contained"
                className="signup-button"
                onClick={() => navigate("/register/student")}
              >
                Sign Up
              </Button>
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

      <Box component="main">
        <section className="hero" id="home">
          <div className="hero__photo" aria-hidden="true" />
          <div className="hero__wash" aria-hidden="true" />

          <Container maxWidth="xl" className="hero__content">
            <Box className="hero__copy">
              <Chip
                className="hero__eyebrow"
                icon={<StarRoundedIcon />}
                label="Your learning journey starts here"
              />

              <Typography component="h1" className="hero__title">
                Unlock new skills,
                <br />
                create a <span>better tomorrow</span>
              </Typography>

              <Typography className="hero__description">
                Discover courses, build practical skills, and learn at your own
                pace with Learnova.
              </Typography>

              {/* <Box className="hero-search">
                <SearchRoundedIcon />
                <input
                  aria-label="What do you want to learn today?"
                  placeholder="What do you want to learn today?"
                  value={search}
                  onChange={(event) => handleSearch(event.target.value)}
                  onKeyDown={(event) =>
                    event.key === "Enter" && goTo("courses")
                  }
                />
                <Button
                  variant="contained"
                  onClick={() => goTo("courses")}
                  endIcon={<ArrowForwardRoundedIcon />}
                >
                  Search
                </Button>
              </Box> */}

              <Box className="hero-stats">
                <div>
                  <span className="hero-stats__icon purple">
                    <MenuBookRoundedIcon />
                  </span>
                  <strong>{publishedCount}</strong>
                  <small>Published courses</small>
                </div>
                {studentCount != null && (
                  <div>
                    <span className="hero-stats__icon pink">
                      <GroupsRoundedIcon />
                    </span>
                    <strong>{studentCount}</strong>
                    <small>Active learners</small>
                  </div>
                )}
                {instructorCount != null && (
                  <div>
                    <span className="hero-stats__icon orange">
                      <SchoolRoundedIcon />
                    </span>
                    <strong>{instructorCount}</strong>
                    <small>Instructors</small>
                  </div>
                )}
              </Box>
            </Box>

            <Box className="hero-floating-card hero-floating-card--cert">
              <span className="floating-icon purple">
                <WorkspacePremiumRoundedIcon />
              </span>
              <div>
                <strong>Learn at your own pace</strong>
                <small>Build skills step by step</small>
              </div>
            </Box>

            <Box className="hero-floating-card hero-floating-card--project">
              <span className="floating-icon green">
                <AutoAwesomeRoundedIcon />
              </span>
              <div>
                <strong>Explore new skills</strong>
                <small>Find a course for your goals</small>
              </div>
            </Box>
          </Container>
        </section>

        <section className="section categories-section" id="categories">
          <Container maxWidth="xl">
            <div className="section-heading">
              <div>
                <Typography className="section-heading__title">
                  Explore top categories
                </Typography>
                <Typography className="section-heading__subtitle">
                  Select one or more categories to find relevant courses.
                </Typography>
              </div>
              <Button
                className="text-link"
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => {
                  setSelectedCategories([]);
                  setPage(1);
                }}
              >
                View all categories
              </Button>
            </div>

            {loading ? (
              <div className="loading-state">
                <CircularProgress size={25} />
                <span>Loading categories...</span>
              </div>
            ) : apiError ? (
              <div className="catalog-message">
                <strong>Categories are temporarily unavailable</strong>
                <Button onClick={() => loadCatalog()}>Retry</Button>
              </div>
            ) : (
              <div className="category-grid">
                <button
                  className={`category-card ${
                    selectedCategories.length === 0 ? "category-card--selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedCategories([]);
                    setPage(1);
                    goTo("courses");
                  }}
                >
                  <span className="category-card__icon purple">
                    <SchoolRoundedIcon />
                  </span>
                  <strong>All categories</strong>
                  <small>{publishedCount} courses</small>
                </button>

                {catalog.categories.map((category, index) => {
                  const id = getCategoryId(category);
                  const categoryName = getCategoryName(category);
                  const visual =
                    categoryVisuals[index % categoryVisuals.length];

                  const categoryCount =
                    category.course_count ?? category.courseCount;

                  return (
                    <button
                      className={`category-card ${
                        selectedCategories.includes(String(id))
                          ? "category-card--selected"
                          : ""
                      }`}
                      key={id}
                      onClick={() => {
                        const categoryId = String(id);
                        setSelectedCategories((current) =>
                          current.includes(categoryId)
                            ? current.filter((selectedId) => selectedId !== categoryId)
                            : [...current, categoryId],
                        );
                        setPage(1);
                        goTo("courses");
                      }}
                    >
                      <span className={`category-card__icon ${visual.tone}`}>
                        {visual.icon}
                      </span>
                      <strong>{categoryName}</strong>
                      {categoryCount != null && (
                        <small>{categoryCount} courses</small>
                      )}
                    </button>
                  );
                })}

                {!catalog.categories.length && (
                  <div className="empty-inline">
                    No categories are available yet.
                  </div>
                )}
              </div>
            )}
          </Container>
        </section>

        <section className="section courses-section" id="courses">
          <Container maxWidth="xl">
            <div className="section-heading">
              <div>
                <Typography className="section-heading__title">
                  {selectedCategories.length === 0
                    ? "Explore courses"
                    : "Courses in selected categories"}
                </Typography>
                <Typography className="section-heading__subtitle">
                  Find the right course for your next skill.
                </Typography>
              </div>

              <Button
                className="text-link"
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => navigate("/courses")}
              >
                View all courses
              </Button>
            </div>

            <Box
              className="course-filters"
              sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 3 }}
            >
              <FormControl size="small" sx={{ minWidth: 210 }}>
                <InputLabel id="landing-categories-label" shrink>
                  Categories
                </InputLabel>
                <Select
                  labelId="landing-categories-label"
                  multiple
                  displayEmpty
                  label="Categories"
                  value={selectedCategories}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedCategories(
                      (typeof value === "string" ? value.split(",") : value).map(String),
                    );
                    setPage(1);
                  }}
                  renderValue={(selected) => selected.length
                    ? selected.map((id) => getCategoryName(
                        catalog.categories.find(
                          (category) => String(getCategoryId(category)) === String(id),
                        ) || { name: id },
                      )).join(", ")
                    : "All categories"}
                >
                  {catalog.categories.map((category) => {
                    const id = String(getCategoryId(category));
                    return (
                      <MenuItem key={id} value={id}>
                        <Checkbox checked={selectedCategories.includes(id)} />
                        <ListItemText primary={getCategoryName(category)} />
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
              <TextField
                select
                size="small"
                label="Price"
                value={priceFilter}
                onChange={(event) => {
                  setPriceFilter(event.target.value);
                  setPage(1);
                }}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="">All prices</MenuItem>
                <MenuItem value="free">Free</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Sort by"
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value);
                  setPage(1);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="newest">Newest</MenuItem>
                <MenuItem value="title">Title A–Z</MenuItem>
                <MenuItem value="price_low">Price: low to high</MenuItem>
                <MenuItem value="price_high">Price: high to low</MenuItem>
              </TextField>
              {(search ||
                selectedCategories.length > 0 ||
                levelFilter ||
                priceFilter ||
                sortBy !== "newest") && (
                <Button onClick={resetFilters}>Clear filters</Button>
              )}
            </Box>

            <Typography variant="body2" sx={{ mb: 2 }}>
              {loading
                ? "Searching courses…"
                : `${totalCourses.toLocaleString("en-IN")} courses found`}
            </Typography>

            {selectedCategories.map((selectedId) => (
              <Chip
                key={selectedId}
                label={getCategoryName(
                  catalog.categories.find(
                    (category) => String(getCategoryId(category)) === selectedId,
                  ) || { name: selectedId },
                )}
                onDelete={() => {
                  setSelectedCategories((current) =>
                    current.filter((id) => id !== selectedId),
                  );
                  setPage(1);
                }}
                sx={{ mb: 2, mr: 1 }}
              />
            ))}

            {loading ? (
              <div className="loading-state">
                <CircularProgress size={25} />
                <span>Loading courses...</span>
              </div>
            ) : apiError ? (
              <div className="catalog-message">
                <SchoolRoundedIcon />
                <strong>Course catalog is unavailable</strong>
                <span>{apiError}</span>
                <Button variant="contained" onClick={() => loadCatalog()}>
                  Retry
                </Button>
              </div>
            ) : visibleCourses.length > 0 ? (
              <div className="course-grid">
                {visibleCourses.map((course, index) => (
                  <CourseCard
                    key={
                      course.id ??
                      course.course_id ??
                      `${course.title ?? course.course_name ?? "course"}-${index}`
                    }
                    course={course}
                    index={index}
                    onOpen={openCourse}
                  />
                ))}
              </div>
            ) : (
              <div className="catalog-message">
                <MenuBookRoundedIcon />
                <strong>
                  {search.trim() || levelFilter || priceFilter
                    ? "No courses match your filters"
                    : selectedCategories.length > 0
                      ? "No courses in these categories"
                      : "No published courses available"}
                </strong>
                <span>
                  {search.trim() || levelFilter || priceFilter
                    ? "Try another search term or adjust the filters."
                    : "Published courses will appear here when the API returns them."}
                </span>
                {(search ||
                  selectedCategories.length > 0 ||
                  levelFilter ||
                  priceFilter) && (
                  <Button onClick={resetFilters}>Clear filters</Button>
                )}
              </div>
            )}

            {!loading && !apiError && totalCourses > 0 && (
              <Box
                className="course-pagination"
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 2,
                  mt: 4,
                }}
              >
                <Button
                  variant="outlined"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                    goTo("courses");
                  }}
                >
                  Previous
                </Button>
                <Typography variant="body2">
                  Page {page} of {totalPages}
                </Typography>
                <Button
                  variant="outlined"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((current) => Math.min(totalPages, current + 1));
                    goTo("courses");
                  }}
                >
                  Next
                </Button>
              </Box>
            )}
          </Container>
        </section>

        <section className="why-section" id="why-learnova">
          <Container maxWidth="xl">
            <div className="why-panel">
              <div className="why-panel__heading">
                <Typography className="section-heading__title">
                  Why choose Learnova?
                </Typography>
                <Typography className="section-heading__subtitle">
                  A learning experience designed around your goals.
                </Typography>
              </div>

              <div className="feature-list">
                {featureItems.map((feature) => (
                  <div className="feature-item" key={feature.title}>
                    <span className={`feature-item__icon ${feature.tone}`}>
                      {feature.icon}
                    </span>
                    <div>
                      <strong>{feature.title}</strong>
                      <p>{feature.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <section className="section cta-section">
          <Container maxWidth="xl">
            <div className="cta-card">
              <span className="cta-card__eyebrow">
                YOUR NEXT CHAPTER STARTS HERE
              </span>
              <Typography component="h2">
                Your next skill starts here.
              </Typography>
              <Typography>
                Explore courses, learn at your pace, and keep moving forward.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate("/register/student")}
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Create an account
              </Button>
              <div className="cta-card__sparkle">✦</div>
            </div>
          </Container>
        </section>
      </Box>

      <LearnovaFooter
        categories={catalog.categories}
        courses={catalog.courses}
        onBrowse={browseFooterSection}
        onCategorySelect={selectFooterCategory}
        onCourseSelect={openCourse}
      />
    </Box>
  );
}

export default LandingPage;
