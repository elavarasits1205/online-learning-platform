import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Link as RouterLink } from "react-router-dom";
import LearnovaLogoMark from "./LearnovaLogoMark";
import "./LearnovaFooter.scss";

function getCategoryName(category) {
  return category?.name ?? category?.category_name ?? category?.title ?? "Category";
}

function getCategoryId(category) {
  return category?.id ?? category?.category_id ?? getCategoryName(category);
}

function getCourseId(course) {
  return course?.id ?? course?.course_id;
}

function getCourseName(course) {
  return (
    course?.title ??
    course?.course_name ??
    course?.courseName ??
    course?.name ??
    "Untitled course"
  );
}

export default function LearnovaFooter({
  categories = [],
  courses = [],
  isStudent = false,
  onBrowse,
  onCategorySelect,
  onCourseSelect,
}) {
  const availableCategories = Array.isArray(categories) ? categories.slice(0, 12) : [];
  const availableCourses = Array.isArray(courses)
    ? courses
        .filter((course) => {
          const id = getCourseId(course);
          return id !== null && id !== undefined && String(id).trim() !== "";
        })
        .slice(0, 12)
    : [];
  const categorySplit = Math.ceil(availableCategories.length / 2);
  const categoryGroups = [
    availableCategories.slice(0, categorySplit),
    availableCategories.slice(categorySplit),
  ];

  const browse = (section) => onBrowse?.(section);

  return (
    <footer className="learnova-footer">
      <section className="learnova-footer__teach">
        <div className="learnova-footer__container learnova-footer__teach-inner">
          <div className="learnova-footer__teach-copy">
            <span className="learnova-footer__eyebrow">FOR INSTRUCTORS</span>
            <h2>Teach the world online</h2>
            <p>Create a course, share your expertise, and help learners grow.</p>
          </div>
          <RouterLink className="learnova-footer__teach-button" to="/register/instructor">
            Teach with Learnova <ArrowForwardRoundedIcon />
          </RouterLink>
        </div>
      </section>

      <section className="learnova-footer__trust" aria-label="Learnova learning features">
        <div className="learnova-footer__container learnova-footer__trust-inner">
          <div className="learnova-footer__trust-intro">
            <strong>Learning that moves with you</strong>
            <span>Build skills one course at a time.</span>
          </div>
          <div className="learnova-footer__trust-item">
            <SchoolRoundedIcon />
            <span>Learn from instructors</span>
          </div>
          <div className="learnova-footer__trust-item">
            <PlayCircleOutlineRoundedIcon />
            <span>Study at your own pace</span>
          </div>
          <div className="learnova-footer__trust-item">
            <TrendingUpRoundedIcon />
            <span>Track your progress</span>
          </div>
        </div>
      </section>

      <section className="learnova-footer__directory">
        <div className="learnova-footer__container">
          <div className="learnova-footer__directory-heading">
            <div>
              <span className="learnova-footer__eyebrow">FIND YOUR NEXT SKILL</span>
              <h2>Explore skills and courses</h2>
            </div>
            <button type="button" onClick={() => browse("courses")}>
              Browse course catalog <ArrowForwardRoundedIcon />
            </button>
          </div>

          <div
            className={`learnova-footer__directory-grid ${
              isStudent ? "learnova-footer__directory-grid--student" : ""
            }`}
          >
            {categoryGroups.map((group, index) => (
              <div className="learnova-footer__column" key={`categories-${index}`}>
                <h3>{index === 0 ? "Course categories" : "More categories"}</h3>
                {group.length ? (
                  group.map((category) => (
                    <button
                      type="button"
                      key={String(getCategoryId(category))}
                      onClick={() => onCategorySelect?.(category)}
                    >
                      {getCategoryName(category)}
                    </button>
                  ))
                ) : index === 0 ? (
                  <span className="learnova-footer__empty">Categories will appear as courses are added.</span>
                ) : (
                  <button type="button" onClick={() => browse("categories")}>
                    View all categories
                  </button>
                )}
              </div>
            ))}

            {isStudent && (
              <div className="learnova-footer__column">
                <h3>Courses</h3>
                {availableCourses.length ? (
                  availableCourses.map((course) => (
                    <button
                      type="button"
                      key={String(getCourseId(course))}
                      onClick={() => onCourseSelect?.(course)}
                    >
                      {getCourseName(course)}
                    </button>
                  ))
                ) : (
                  <span className="learnova-footer__empty">
                    Courses will appear here when they are available.
                  </span>
                )}
              </div>
            )}

            <div className="learnova-footer__column">
              <h3>{isStudent ? "Your learning" : "Get started"}</h3>
              {isStudent ? (
                <>
                  <RouterLink to="/student/my-learning">My learning</RouterLink>
                  <RouterLink to="/student/purchase-history">Purchase history</RouterLink>
                  <RouterLink to="/student/cart">My cart</RouterLink>
                </>
              ) : (
                <>
                  <RouterLink to="/login">Log in</RouterLink>
                  <RouterLink to="/register/student">Create a student account</RouterLink>
                  <button type="button" onClick={() => browse("categories")}>
                    Explore categories
                  </button>
                  <button type="button" onClick={() => browse("courses")}>
                    Browse courses
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="learnova-footer__bottom">
        <div className="learnova-footer__container learnova-footer__bottom-inner">
          <button className="learnova-footer__brand" type="button" onClick={() => browse("home")}>
            <LearnovaLogoMark
              className="learnova-footer__brand-mark"
              size="small"
            />
            <span>Learnova<small>LEARN · GROW · SUCCEED</small></span>
          </button>
          <span className="learnova-footer__copyright">
            © {new Date().getFullYear()} Learnova. All rights reserved.
          </span>
          <span className="learnova-footer__motto">
            <AutoAwesomeRoundedIcon /> Learning for what comes next.
          </span>
        </div>
      </div>
    </footer>
  );
}
