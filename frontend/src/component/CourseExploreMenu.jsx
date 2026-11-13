import { useId, useState } from "react";
import { Link } from "react-router-dom";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import "./CourseExploreMenu.scss";

function categoryId(category) {
  return category?.id ?? category?.category_id ?? category?.categoryId ?? category?.code ?? "";
}

function categoryName(category) {
  return category?.name ?? category?.category_name ?? category?.title ?? "Category";
}

export default function CourseExploreMenu({
  categories = [],
  allCoursesPath = "/courses",
  categoryPath = (id) => `${allCoursesPath}?category=${encodeURIComponent(id)}`,
  label = "Explore",
  loading = false,
}) {
  const [open, setOpen] = useState(false);
  const generatedId = useId().replace(/:/g, "");
  const menuId = `course-explore-menu-${generatedId}`;

  return (
    <div
      className={`course-explore${open ? " is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          event.currentTarget.querySelector(".course-explore__trigger")?.focus();
        }
      }}
    >
      <button
        className="course-explore__trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <KeyboardArrowDownRoundedIcon aria-hidden="true" />
      </button>

      {open && (
        <div className="course-explore__menu" id={menuId} role="menu" aria-label="Explore courses">
          <p className="course-explore__heading">Browse Learnova</p>
          <Link
            className="course-explore__all"
            to={allCoursesPath}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            All courses
            <ArrowForwardRoundedIcon aria-hidden="true" />
          </Link>

          <div className="course-explore__divider" />
          <p className="course-explore__heading">Explore by category</p>
          {categories.length ? (
            <div className="course-explore__list">
              {categories.map((category, index) => {
                const id = categoryId(category);
                if (!id) return null;

                return (
                  <Link
                    className="course-explore__item"
                    key={id || `${categoryName(category)}-${index}`}
                    to={categoryPath(id, category)}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    <span>{categoryName(category)}</span>
                    <ArrowForwardRoundedIcon aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="course-explore__empty">
              {loading ? "Loading course categories..." : "No course categories are available yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
