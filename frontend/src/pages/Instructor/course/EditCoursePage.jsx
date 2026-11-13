import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Upload } from "lucide-react";

import Button from "../../../component/buttons/Button";
import InputField from "../../../component/fields/InputField";
import instructorApi from "../../../service/InstructorApi";
import "./CreateCoursePage.scss";

const emptyForm = {
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

function getPayload(response) {
  return response?.data?.data ?? response?.data ?? response;
}

export default function EditCoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [thumbnail, setThumbnail] = useState(null);
  const [currentThumbnail, setCurrentThumbnail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCourse() {
      setLoading(true);
      setError("");
      try {
        const course = getPayload(await instructorApi.getCourse(id));
        if (!course?.id && !course?.course_id) {
          throw new Error("The server did not return this course.");
        }
        if (!active) return;

        setForm({
          category_id: String(course.category_id ?? ""),
          course_code: course.course_code ?? "",
          title: course.title ?? "",
          short_description: course.short_description ?? "",
          description: course.description ?? "",
          level: course.level ?? "BEGINNER",
          language_code: course.language_code ?? "en",
          currency_code: course.currency_code ?? "INR",
          course_type: course.course_type ?? "PAID",
          price: String(course.price ?? (course.course_type === "FREE" ? 0 : 999)),
          duration_minutes:
            course.duration_minutes == null ? "" : String(course.duration_minutes),
        });
        setCurrentThumbnail(course.thumbnail_url ?? "");
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message ?? err.message ?? "Unable to load this course.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCourse();
    return () => {
      active = false;
    };
  }, [id]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: name === "course_type" && value === "FREE"
        ? "FREE"
        : value,
      ...(name === "course_type" && value === "FREE" ? { price: "0" } : {}),
      ...(name === "course_type" && value === "PAID" && Number(previous.price) === 0
        ? { price: "999" }
        : {}),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const categoryId = Number(form.category_id);
    const price = Number(form.price);
    const duration = form.duration_minutes.trim() === ""
      ? null
      : Number(form.duration_minutes);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      setError("Enter a valid category ID that exists in your database.");
      return;
    }
    if (!form.title.trim()) {
      setError("Course title is required.");
      return;
    }
    if (
      !Number.isFinite(price) ||
      price < 0 ||
      (form.course_type === "FREE" && price !== 0) ||
      (form.course_type === "PAID" && price <= 0)
    ) {
      setError("Free courses must cost 0. Paid courses must have a price greater than 0.");
      return;
    }
    if (duration !== null && (!Number.isSafeInteger(duration) || duration < 0)) {
      setError("Duration must be a non-negative whole number.");
      return;
    }

    setSaving(true);
    try {
      await instructorApi.updateCourse(id, {
        category_id: categoryId,
        title: form.title.trim(),
        short_description: form.short_description.trim(),
        description: form.description.trim(),
        level: form.level,
        language_code: form.language_code.trim() || "en",
        currency_code: form.currency_code.trim() || "INR",
        course_type: form.course_type,
        price,
        duration_minutes: duration,
      });

      if (thumbnail) {
        await instructorApi.uploadThumbnail(id, thumbnail);
      }

      navigate("/instructor/courses", {
        state: { notice: "Course updated successfully." },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ??
        err.message ??
        "Unable to update this course. Only draft or rejected courses can be edited."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="create-course"><p>Loading course details…</p></section>;
  }

  return (
    <section className="create-course">
      <header className="create-course__header">
        <Button component={Link} to="/instructor/courses" variant="text" startIcon={<ArrowLeft size={17} />}>
          Back to My Courses
        </Button>
        <span className="create-course__eyebrow">LEARNOVA INSTRUCTOR PORTAL</span>
        <h1>Edit Course</h1>
        <p>Update the course details. Submitted or published courses may not be editable.</p>
      </header>

      {error && <div className="create-course__error" role="alert">{error}</div>}

      <form className="create-course__form" onSubmit={handleSubmit}>
        <section className="create-course__section">
          <h2>Basic Information</h2>
          <div className="create-course__grid">
            <InputField name="title" label="Course Title" value={form.title} onChange={handleChange} required />
            <InputField name="course_code" label="Course Code" value={form.course_code} readOnly disabled helperText="Course code is fixed after creation." />
            <InputField name="category_id" label="Category ID" type="number" value={form.category_id} onChange={handleChange} required helperText="Use an existing category ID from your database." />
            <InputField name="level" label="Level" select value={form.level} onChange={handleChange} options={[
              { value: "BEGINNER", label: "Beginner" },
              { value: "INTERMEDIATE", label: "Intermediate" },
              { value: "ADVANCED", label: "Advanced" },
            ]} />
            <InputField name="language_code" label="Language Code" value={form.language_code} onChange={handleChange} />
            <InputField name="currency_code" label="Currency Code" value={form.currency_code} onChange={handleChange} />
            <InputField name="course_type" label="Course Type" select value={form.course_type} onChange={handleChange} options={[
              { value: "FREE", label: "Free" },
              { value: "PAID", label: "Paid" },
            ]} />
            <InputField name="price" label="Price" type="number" value={form.price} onChange={handleChange} required />
            <InputField name="duration_minutes" label="Duration (minutes)" type="number" value={form.duration_minutes} onChange={handleChange} />
          </div>
          <div style={{ marginTop: 20 }}>
            <InputField name="short_description" label="Short Description" value={form.short_description} onChange={handleChange} multiline rows={2} />
          </div>
          <div style={{ marginTop: 20 }}>
            <InputField name="description" label="Course Description" value={form.description} onChange={handleChange} multiline rows={5} />
          </div>
        </section>

        <section className="create-course__section">
          <h2>Course Thumbnail</h2>
          {currentThumbnail && (
            <img
              src={currentThumbnail}
              alt="Current course thumbnail"
              style={{ display: "block", width: "min(100%, 360px)", maxHeight: 200, objectFit: "cover", borderRadius: 12, marginBottom: 16 }}
            />
          )}
          <label className="create-course__field">
            <span>Choose a new thumbnail (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setThumbnail(event.target.files?.[0] ?? null)}
            />
            <small>JPEG, PNG, or WebP. Maximum size: 5 MB.</small>
          </label>
        </section>

        <div className="create-course__footer">
          <Button component={Link} to="/instructor/courses" variant="outlined" color="inherit">Cancel</Button>
          <Button type="submit" loading={saving} startIcon={<Save size={17} />}>Save Changes</Button>
        </div>
      </form>
    </section>
  );
}
