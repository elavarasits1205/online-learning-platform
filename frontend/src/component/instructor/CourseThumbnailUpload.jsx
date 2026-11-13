
import { useEffect, useState } from "react";
import "./CourseThumbnail.scss";

export default function CourseThumbnail({
  course,
  className = "course-thumbnail",
}) {
  const imageUrl =
    course?.thumbnail_url ||
    course?.thumbnailUrl ||
    course?.thumbnail ||
    course?.image_url ||
    course?.imageUrl ||
    "";

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  if (!imageUrl || imageError) {
    return (
      <div
        className="course-thumbnail-placeholder"
        role="img"
        aria-label={`${course?.title || "Course"} thumbnail unavailable`}
      >
        {course?.title?.trim()?.slice(0, 2)?.toUpperCase() ||
          "CO"}
      </div>
    );
  }

  return (
    <img
      className={className}
      src={imageUrl}
      alt={`${course?.title || "Course"} thumbnail`}
      loading="lazy"
      onError={() => setImageError(true)}
    />
  );
}
