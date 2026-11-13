
import {
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from "@mui/material";

import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import "./CourseCard.scss";

function getTitle(course) {
  return course?.title ?? course?.course_name ?? course?.name ?? "Untitled course";
}

function getCategory(course) {
  return (
    course?.category_name ??
    course?.categoryName ??
    course?.category?.name ??
    course?.category?.category_name ??
    "Uncategorized"
  );
}
function getInstructor(course) {
  const instructor =
    course?.instructors?.[0] ??
    course?.instructor ??
    null;

  if (typeof instructor === "string") {
    return instructor;
  }

  return (
    instructor?.name ??
    instructor?.full_name ??
    course?.instructor_name ??
    course?.instructorName ??
    "Instructor details unavailable"
  );
}

function getImage(course) {
  return (
    course?.thumbnail_url ??
    course?.thumbnailUrl ??
    course?.thumbnail ??
    course?.image_url ??
    course?.imageUrl ??
    ""
  );
}

function formatMoney(course) {
  const value =
    course?.price ??
    course?.price_amount ??
    course?.course_price;

  if (value === null || value === undefined || value === "") {
    return "Price unavailable";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) return String(value);
  if (amount === 0) return "Free";

  const currency =
    course?.currency_code ??
    course?.currencyCode ??
    "INR";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function formatDuration(course) {
  const minutes =
    course?.duration_minutes ??
    course?.durationMinutes;

  if (minutes !== null && minutes !== undefined && minutes !== "") {
    const total = Number(minutes);

    if (!Number.isFinite(total) || total < 0) {
      return "Duration unavailable";
    }

    const hours = Math.floor(total / 60);
    const remaining = total % 60;

    if (hours === 0) return `${remaining} min`;
    if (remaining === 0) return `${hours} hr`;

    return `${hours} hr ${remaining} min`;
  }

  const hours =
    course?.duration_hours ??
    course?.durationHours;

  return hours !== null && hours !== undefined && hours !== ""
    ? `${hours} hr`
    : "Duration unavailable";
}

function isFeatured(course) {
  return course?.is_featured === true || course?.is_featured === 1;
}

export default function CourseCard({
  course,
  index = 0,
  onOpen,
}) {
  const id = course?.id ?? course?.course_id;
  const title = getTitle(course);
  const category = getCategory(course);
  const instructor = getInstructor(course);
  const image = getImage(course);

  const rating =
    course?.rating ??
    course?.average_rating;

  const lessons =
    course?.lesson_count ??
    course?.lessonCount ??
    course?.lessons_count;

  const canOpen = id !== null && id !== undefined;

  const openCourse = () => {
    if (canOpen && onOpen) onOpen(course);
  };

  return (
    <Card
      className="course-card course-card--clickable"
      onClick={openCourse}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCourse();
        }
      }}
      role={canOpen ? "link" : undefined}
      tabIndex={canOpen ? 0 : -1}
      aria-label={`View details for ${title}`}
      sx={{
        cursor: canOpen ? "pointer" : "default",
        "&:focus-visible": {
          outline: "3px solid #f26d4f",
          outlineOffset: "3px",
        },
      }}
    >
      <div className="course-card__image">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div
            className={`course-art course-art--${index % 4}`}
          >
            <SchoolRoundedIcon />
            <span>{category}</span>
          </div>
        )}

        {isFeatured(course) && (
          <Chip
            className="course-badge"
            label="Featured"
          />
        )}
      </div>

      <CardContent className="course-card__content">
        <span className="course-card__category">
          {category}
        </span>

        <Typography className="course-card__title">
          {title}
        </Typography>

        <div className="course-card__instructor">
          <Avatar>
            {instructor.charAt(0).toUpperCase()}
          </Avatar>
          <span>{instructor}</span>
        </div>

        <div className="course-card__meta">
          <span className="rating">
            <StarRoundedIcon />
            {rating ?? "Not rated"}
          </span>

          <span>
            <AccessTimeRoundedIcon />
            {formatDuration(course)}
          </span>
        </div>

        <Divider className="course-card__divider" />

        <div className="course-card__bottom">
          <strong>{formatMoney(course)}</strong>

          {lessons !== null &&
            lessons !== undefined &&
            lessons !== "" && (
              <small>
                <MenuBookRoundedIcon />
                {lessons} lessons
              </small>
            )}
        </div>

        <Button
          fullWidth
          variant="outlined"
          sx={{ mt: 2 }}
          onClick={(event) => {
            event.stopPropagation();
            openCourse();
          }}
          disabled={!canOpen}
          endIcon={<ArrowForwardRoundedIcon />}
        >
          View course
        </Button>
      </CardContent>
    </Card>
  );
}
