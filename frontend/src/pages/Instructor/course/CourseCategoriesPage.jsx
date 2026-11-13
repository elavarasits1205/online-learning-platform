import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  CircularProgress,
  Pagination,
} from "@mui/material";
import {
  Search,
  Code2,
  Database,
  BrainCircuit,
  Palette,
  BriefcaseBusiness,
  Calculator,
  ArrowRight,
  Plus,
  BookOpen,
  RefreshCw,
} from "lucide-react";

import Button from "../../../component/buttons/Button";
import instructorApi from "../../../service/InstructorApi";
import "./CourseCategoriesPage.scss";

const PAGE_SIZE = 3;
const iconChoices = [Code2, Database, BrainCircuit, Palette, BriefcaseBusiness, Calculator, BookOpen];
const colorChoices = ["purple", "blue", "pink", "orange", "green", "cyan"];

function unwrapCategories(response) {
  const payload = response?.data?.data ?? response?.data ?? response;
  const rows = Array.isArray(payload)
    ? payload
    : payload?.categories ?? payload?.items ?? payload?.results ?? [];

  return rows.filter((category) => category && category.is_active !== false && category.soft_delete !== true);
}

function getCategoryIcon(category, index) {
  const key = `${category.code || ""} ${category.name || ""}`.toLowerCase();
  if (/program|code|develop|software|web/.test(key)) return Code2;
  if (/data|database|analytics/.test(key)) return Database;
  if (/ai|artificial|machine learning|deep learning/.test(key)) return BrainCircuit;
  if (/design|art|creative|ui|ux/.test(key)) return Palette;
  if (/business|management|market|entrepreneur/.test(key)) return BriefcaseBusiness;
  if (/math|statistic|account|finance/.test(key)) return Calculator;
  return iconChoices[index % iconChoices.length];
}

export default function CourseCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await instructorApi.getCategories();
      setCategories(unwrapCategories(response));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to load course categories. Please try again."
      );
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return categories;
    return categories.filter((category) =>
      [category.name, category.code, category.description]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query))
    );
  }, [categories, search]);

  const totalPages = Math.ceil(filteredCategories.length / PAGE_SIZE);
  const visibleCategories = filteredCategories.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const updateSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <main className="course-categories-page">
      <header className="categories-header">
        <div>
          <span className="categories-eyebrow">INSTRUCTOR WORKSPACE</span>
          <h1>Course Categories</h1>
          <p>Explore subject areas and choose the right category for your courses.</p>
        </div>
        <Button
          component={Link}
          to="/instructor/courses/create"
          variant="contained"
          startIcon={<Plus size={17} />}
        >
          Create Course
        </Button>
      </header>

      <section className="categories-intro">
        <div className="categories-intro-icon"><BookOpen size={25} /></div>
        <div>
          <h2>Find your course category</h2>
          <p>Organize your teaching content by subject to help learners discover relevant courses.</p>
        </div>
      </section>

      <section className="categories-library" aria-labelledby="categories-library-title">
        <div className="categories-library-header">
          <div>
            <h2 id="categories-library-title">Explore Categories</h2>
            <p>
              {loading
                ? "Loading categories…"
                : `${filteredCategories.length} ${filteredCategories.length === 1 ? "category" : "categories"}${search.trim() ? " found" : " available"}`}
            </p>
          </div>
          <label className="categories-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search categories..."
              aria-label="Search categories"
            />
          </label>
        </div>

        {error && (
          <Alert
            severity="error"
            action={<Button size="small" onClick={loadCategories} startIcon={<RefreshCw size={14} />}>Retry</Button>}
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="categories-loading" role="status" aria-label="Loading course categories">
            <CircularProgress size={30} />
            <span>Loading course categories</span>
          </div>
        ) : visibleCategories.length > 0 ? (
          <>
            <div className="categories-grid">
              {visibleCategories.map((category, index) => {
                const Icon = getCategoryIcon(category, (page - 1) * PAGE_SIZE + index);
                const color = colorChoices[((page - 1) * PAGE_SIZE + index) % colorChoices.length];

                return (
                  <article className="category-card" key={category.id}>
                    <div className={`category-icon category-icon--${color}`} aria-hidden="true">
                      <Icon size={25} />
                    </div>
                    <div className="category-card-copy">
                      {category.code && <span className="category-code">{category.code}</span>}
                      <h3>{category.name || "Untitled category"}</h3>
                      <p>{category.description || "Browse courses and learning materials in this subject area."}</p>
                    </div>
                    <Link
                      className="category-action"
                      to="/instructor/courses/create"
                      state={{ categoryName: category.name, categoryId: category.id }}
                    >
                      Create a course <ArrowRight size={16} />
                    </Link>
                  </article>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="categories-pagination">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredCategories.length)} of {filteredCategories.length}
                </span>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, nextPage) => setPage(nextPage)}
                  color="primary"
                  shape="rounded"
                  aria-label="Course category pages"
                />
              </div>
            )}
          </>
        ) : (
          <div className="categories-empty">
            <Search size={28} aria-hidden="true" />
            <h3>{search.trim() ? "No categories found" : "No course categories yet"}</h3>
            <p>{search.trim() ? "Try another search term." : "Active categories from your course catalog will appear here."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
