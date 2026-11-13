
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import instructorApi from "../../../service/InstructorApi";
import Button from "../../../component/buttons/Button";
import InputField from "../../../component/fields/InputField";

import "./CreateCoursePage.scss";

const initialForm = {
  category_id: "",
  course_code: "",
  title: "",
  short_description: "",
  description: "",
  level: "BEGINNER",
  language_code: "en",
  currency_code: "INR",
  course_type: "PAID",
  price: "999",
  duration_minutes: "",
};

const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(() => ({
    ...initialForm,
    category_id: location.state?.categoryId
      ? String(location.state.categoryId)
      : initialForm.category_id,
  }));
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Fetch categories from the existing backend API.
  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        setCategoriesLoading(true);

        const response = await instructorApi.getCategories();
        const responseData = response.data;

        const result =
          responseData?.data?.categories ??
          responseData?.categories ??
          responseData?.data ??
          responseData;

        const categoryList = Array.isArray(result)
          ? result
          : [];

        if (!cancelled) {
          setCategories(categoryList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              "Unable to load course categories. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  // Create and clean up the local thumbnail preview.
  useEffect(() => {
    if (!thumbnail) {
      setThumbnailPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(thumbnail);
    setThumbnailPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [thumbnail]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setNotice("");
  }

  function handleCourseTypeChange(event) {
    const courseType = event.target.value;

    setForm((previous) => ({
      ...previous,
      course_type: courseType,
      price: courseType === "FREE" ? "0" : "999",
    }));

    setError("");
    setNotice("");
  }

  function handleThumbnailChange(event) {
    const file = event.target.files?.[0] ?? null;

    setError("");
    setNotice("");

    if (!file) {
      setThumbnail(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setThumbnail(null);
      event.target.value = "";
      setError("Please select a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_THUMBNAIL_SIZE) {
      setThumbnail(null);
      event.target.value = "";
      setError("Thumbnail image must be 5 MB or smaller.");
      return;
    }

    setThumbnail(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setNotice("");

    const categoryId = Number(form.category_id);
    const price = Number(form.price);

    if (
      !Number.isSafeInteger(categoryId) ||
      categoryId <= 0
    ) {
      setError("Please select a valid course category.");
      return;
    }

    if (!form.title.trim()) {
      setError("Course title is required.");
      return;
    }

    if (!form.language_code.trim()) {
      setError("Language code is required.");
      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      (form.course_type === "FREE" && price !== 0) ||
      (form.course_type === "PAID" && price <= 0)
    ) {
      setError(
        "Free courses must have a price of 0. Paid courses must have a price greater than 0."
      );
      return;
    }

    const duration =
      form.duration_minutes.trim() === ""
        ? null
        : Number(form.duration_minutes);

    if (
      duration !== null &&
      (!Number.isSafeInteger(duration) || duration < 0)
    ) {
      setError(
        "Duration must be a non-negative whole number."
      );
      return;
    }

    const payload = {
      ...form,
      category_id: categoryId,
      title: form.title.trim(),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      language_code: form.language_code.trim(),
      price,
      duration_minutes: duration,
    };

    setLoading(true);

    try {
      // Step 1: Create the course using the existing API.
      const response = await instructorApi.createCourse(payload);
      const responseData = response.data;

      const course =
        responseData?.data?.course ??
        responseData?.course ??
        responseData?.data ??
        responseData;

      const courseId = course?.id;

      if (
        courseId === undefined ||
        courseId === null ||
        String(courseId).trim() === ""
      ) {
        throw new Error(
          "The server did not return a course ID. Check the create-course API response."
        );
      }

      let finalNotice = "Course created successfully.";

      // Step 2: Upload the thumbnail after getting the course ID.
      if (thumbnail) {
        try {
          await instructorApi.uploadThumbnail(
            courseId,
            thumbnail
          );

          finalNotice =
            "Course and thumbnail created successfully.";
        } catch (uploadError) {
          console.error(
            "Thumbnail upload failed:",
            uploadError
          );

          finalNotice =
            "Course created successfully, but the thumbnail upload failed. You can upload it later.";
        }
      }

      // Step 3: Open curriculum management for this course.
      navigate(
        `/instructor/courses/${encodeURIComponent(
          String(courseId)
        )}/curriculum`,
        {
          state: { notice: finalNotice },
        }
      );
    } catch (err) {
      console.error("Create course failed:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to create the course. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="create-course">
      <header className="create-course__header">
        <span className="create-course__eyebrow">
          LEARNOVA INSTRUCTOR PORTAL
        </span>

        <h1>Create a Course</h1>

        <p>
          Enter your course details. You can add modules and
          lessons after creating the course.
        </p>
      </header>

      {error && (
        <div
          className="create-course__error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="create-course__notice"
          role="status"
        >
          {notice}
        </div>
      )}

      <form
        className="create-course__form"
        onSubmit={handleSubmit}
      >
        {/* Basic Information */}
        <section className="create-course__section">
          <h2>Basic Information</h2>

          <div className="create-course__grid">
            <InputField
              name="title"
              label="Course Title"
              value={form.title}
              onChange={handleChange}
              required
              fullWidth
            />

            <p className="create-course__hint">
              Your course code will be generated automatically
              if supported by the backend.
            </p>

            <div className="create-course__field">
              <label htmlFor="category_id">
                Course Category *
              </label>

              <select
                id="category_id"
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                required
                disabled={categoriesLoading || loading}
              >
                <option value="">
                  {categoriesLoading
                    ? "Loading categories..."
                    : "Select a category"}
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={String(category.id)}
                  >
                    {category.name}
                  </option>
                ))}
              </select>

              {!categoriesLoading &&
                categories.length === 0 && (
                  <small>
                    No categories found. Check the categories
                    API and database.
                  </small>
                )}
            </div>

            <div className="create-course__field">
              <label htmlFor="level">Course Level</label>

              <select
                id="level"
                name="level"
                value={form.level}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">
                  Intermediate
                </option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>

            <InputField
              name="short_description"
              label="Short Description"
              value={form.short_description}
              onChange={handleChange}
              fullWidth
            />

            <InputField
              name="description"
              label="Full Description"
              value={form.description}
              onChange={handleChange}
              fullWidth
              multiline
              rows={4}
            />
          </div>
        </section>

        {/* Pricing and Settings */}
        <section className="create-course__section">
          <h2>Pricing and Settings</h2>

          <div className="create-course__grid">
            <div className="create-course__field">
              <label htmlFor="course_type">
                Course Type
              </label>

              <select
                id="course_type"
                name="course_type"
                value={form.course_type}
                onChange={handleCourseTypeChange}
                disabled={loading}
              >
                <option value="PAID">Paid</option>
                <option value="FREE">Free</option>
              </select>
            </div>

            <InputField
              name="price"
              label="Price (INR)"
              type="number"
              value={form.price}
              onChange={handleChange}
              required
              fullWidth
              disabled={
                loading || form.course_type === "FREE"
              }
            />

            <InputField
              name="duration_minutes"
              label="Duration (minutes)"
              type="number"
              value={form.duration_minutes}
              onChange={handleChange}
              fullWidth
              disabled={loading}
            />

            <InputField
              name="language_code"
              label="Language Code"
              value={form.language_code}
              onChange={handleChange}
              required
              fullWidth
              disabled={loading}
            />
          </div>
        </section>

        {/* Thumbnail */}
        <section className="create-course__section">
          <h2>Course Thumbnail</h2>

          <div className="create-course__field">
            <label htmlFor="thumbnail">
              Thumbnail Image (optional)
            </label>

            <input
              id="thumbnail"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleThumbnailChange}
              disabled={loading}
            />

            <small>
              JPG, PNG, or WebP. Maximum file size: 5 MB.
              The image uploads after the course is created.
            </small>

            {thumbnailPreview && (
              <div className="create-course__thumbnail-preview">
                <img
                  src={thumbnailPreview}
                  alt="Selected course thumbnail preview"
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: "320px",
                    maxHeight: "200px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    marginTop: "12px",
                  }}
                />

                <p>{thumbnail?.name}</p>
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <footer className="create-course__footer">
          <Button
            type="button"
            variant="outlined"
            disabled={loading}
            onClick={() =>
              navigate("/instructor/courses")
            }
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            loading={loading}
            disabled={
              loading ||
              categoriesLoading ||
              categories.length === 0
            }
          >
            {loading ? "Creating..." : "Create Course"}
          </Button>
        </footer>
      </form>
    </section>
  );
}
