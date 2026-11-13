
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  IndianRupee,
  GraduationCap,
  MessageSquareText,
  ClipboardCheck,
  Plus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import Button from "../../../component/buttons/Button";
import instructorApi from "../../../service/InstructorApi";
import api from "../../../service/Api";
import { instructorAssessmentApi, unwrapAssessmentResponse } from "../../../service/AssessmentApi";
import communityApi from "../../../service/CommunityApi";
import "./InstructorDashboard.scss";

const getCourseStatus = (course) =>
  String(course?.approval_status || course?.status || "DRAFT")
    .replaceAll("_", " ")
    .toLowerCase();

const formatStatus = (status) =>
  status.replace(/\b\w/g, (character) => character.toUpperCase());

const getCourseId = (course) =>
  course?.id ?? course?.course_id ?? course?.courseId;

const rowsFrom = (value, keys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
};

const formatMoney = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(Number(value) || 0);

const daysSince = (value) => {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Infinity : (Date.now() - time) / 86400000;
};

function StatusBadge({ status }) {
  const normalized = status.toLowerCase().replaceAll(" ", "-");

  return (
    <span className={`dashboard-status dashboard-status--${normalized}`}>
      <span className="dashboard-status-dot" />
      {formatStatus(status)}
    </span>
  );
}

export default function InstructorDashboard() {
  const [courses, setCourses] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [assessmentPercentages, setAssessmentPercentages] = useState([]);
  const [studentQuestions, setStudentQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [courseResult, payrollResult, assessmentResult, questionResult] = await Promise.allSettled([
        instructorApi.getMyCourses(),
        api.get("/payroll/instructor/overview"),
        instructorAssessmentApi.list(),
        communityApi.getPosts({ page: 1, limit: 6, post_type: "QUESTION" }),
      ]);
      if (courseResult.status === "rejected") throw courseResult.reason;
      const result = courseResult.value?.data?.data ?? courseResult.value?.data;
      const courseList = Array.isArray(result)
        ? result
        : Array.isArray(result?.courses)
          ? result.courses
          : [];

      setCourses(courseList);
      if (payrollResult.status === "fulfilled") setEarnings(payrollResult.value?.data?.data ?? payrollResult.value?.data ?? null);
      if (questionResult.status === "fulfilled") {
        const questionData = questionResult.value?.data?.data ?? questionResult.value?.data;
        setStudentQuestions(rowsFrom(questionData, ["posts", "items", "results"]).slice(0, 6));
      }
      if (assessmentResult.status === "fulfilled") {
        const assessmentData = unwrapAssessmentResponse(assessmentResult.value);
        const assessmentList = rowsFrom(assessmentData, ["assessments", "items", "results"]);
        const results = await Promise.allSettled(assessmentList.map((assessment) => {
          const id = assessment.id ?? assessment.assessment_id;
          return id ? instructorAssessmentApi.results(id) : Promise.resolve(null);
        }));
        const reviewRows = [];
        const percentages = [];
        results.forEach((item, index) => {
          if (item.status !== "fulfilled" || !item.value) return;
          const data = unwrapAssessmentResponse(item.value);
          rowsFrom(data, ["attempts", "results", "students", "items"]).forEach((attempt) => {
            const status = String(attempt.status || "").toUpperCase();
            if (status === "SUBMITTED") reviewRows.push({ ...attempt, assessment_title: attempt.assessment_title || assessmentList[index].title, assessment_id: assessmentList[index].id ?? assessmentList[index].assessment_id });
            const percentage = Number(attempt.percentage ?? attempt.score_percentage ?? attempt.percentage_score);
            if (status === "EVALUATED" && Number.isFinite(percentage)) percentages.push(percentage);
          });
        });
        setPendingReviews(reviewRows.sort((left, right) => {
          const time = (row) => new Date(
            row.submitted_at ?? row.submittedAt ?? row.updated_at ?? row.created_at ?? 0
          ).getTime() || 0;
          return time(right) - time(left);
        }));
        setAssessmentPercentages(percentages);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load your courses. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadCourses, 0);
    return () => window.clearTimeout(timer);
  }, [loadCourses]);

  const stats = useMemo(() => {
    const students = courses.reduce((sum, course) => sum + Number(course.enrolled_students || 0), 0);
    const completed = courses.reduce((sum, course) => sum + Number(course.completed_students || 0), 0);
    const completion = students ? Math.round((completed / students) * 100) : 0;
    const averageScore = assessmentPercentages.length
      ? Math.round(assessmentPercentages.reduce((sum, score) => sum + score, 0) / assessmentPercentages.length)
      : null;
    const totalEarnings = Number(earnings?.total_earnings ?? earnings?.total_amount ?? 0);

    return [
      {
        label: "My courses",
        value: courses.length,
        detail: "Courses you manage",
        icon: BookOpen,
        tone: "purple",
      },
      {
        label: "Enrolled students",
        value: students,
        detail: "Across your courses",
        icon: GraduationCap,
        tone: "blue",
      },
      {
        label: "Average completion",
        value: `${completion}%`,
        detail: `${completed} students completed`,
        icon: CheckCircle2,
        tone: "green",
      },
      {
        label: "Average assessment score",
        value: averageScore === null ? "—" : `${averageScore}%`,
        detail: averageScore === null ? "No graded attempts yet" : "Across graded attempts",
        icon: ClipboardCheck,
        tone: "orange",
      },
      {
        label: "Total earnings",
        value: earnings ? formatMoney(totalEarnings) : "—",
        detail: "Across your payroll records",
        icon: IndianRupee,
        tone: "blue",
      },
    ];
  }, [courses, assessmentPercentages, earnings]);

  const recentCourses = useMemo(
    () => courses.slice(0, 5),
    [courses]
  );

  const lowActivityCourses = useMemo(() => courses
    .filter((course) => ["published", "approved", "active"].includes(getCourseStatus(course)))
    .filter((course) => Number(course.enrolled_students || 0) === 0 || daysSince(course.last_student_activity_at) >= 30)
    .sort((left, right) => {
      const leftEnrolled = Number(left.enrolled_students || 0);
      const rightEnrolled = Number(right.enrolled_students || 0);
      if ((leftEnrolled === 0) !== (rightEnrolled === 0)) {
        return leftEnrolled === 0 ? -1 : 1;
      }
      const leftInactiveDays = daysSince(left.last_student_activity_at);
      const rightInactiveDays = daysSince(right.last_student_activity_at);
      if (leftInactiveDays !== rightInactiveDays) {
        return rightInactiveDays > leftInactiveDays ? 1 : -1;
      }
      if (leftEnrolled !== rightEnrolled) return leftEnrolled - rightEnrolled;
      return String(left.title || "").localeCompare(String(right.title || ""));
    })
    .slice(0, 5), [courses]);

  const enrollmentTrend = useMemo(() => {
    const months = new Map();
    courses.forEach((course) => {
      rowsFrom(course.enrollment_trend).forEach((point) => {
        const key = String(point.month || "").slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(key)) return;
        const current = months.get(key) || { enrolled: 0, completed: 0 };
        current.enrolled += Number(point.enrolled_students || 0);
        current.completed += Number(point.completed_students || 0);
        months.set(key, current);
      });
    });
    return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, value]) => ({
      key,
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" }),
      ...value,
    }));
  }, [courses]);

  const maxTrendValue = Math.max(1, ...enrollmentTrend.map((point) => point.enrolled));

  return (
    <main className="instructor-dashboard">
      <header className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">
            INSTRUCTOR WORKSPACE
          </span>
          <h1>Welcome to your teaching dashboard</h1>
          <p>
            Create courses, organize your curriculum, and manage your
            teaching content in one place.
          </p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="dashboard-secondary-link" to="/instructor/students">
            <GraduationCap size={17} />View students
          </Link>
          <Link className="dashboard-primary-link" to="/instructor/courses/create">
            <Plus size={17} />Create course
          </Link>
        </div>
      </header>

      {error && (
        <div className="dashboard-error" role="alert">
          <div>
            <strong>We couldn't load your courses</strong>
            <p>{error}</p>
          </div>

          <Button
            variant="outlined"
            onClick={loadCourses}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Retry
          </Button>
        </div>
      )}

      <section className="dashboard-stats" aria-label="Course statistics">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article className="dashboard-stat-card" key={stat.label}>
              <div className={`dashboard-stat-icon dashboard-stat-icon--${stat.tone}`}>
                <Icon size={21} />
              </div>

              <div className="dashboard-stat-content">
                <span>{stat.label}</span>
                <strong>
                  {loading ? "—" : stat.value}
                </strong>
                <small>{stat.detail}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="dashboard-insights" aria-label="Teaching insights">
        <article className="dashboard-insight-card dashboard-insight-card--wide">
          <div className="dashboard-insight-heading">
            <div><h2>Enrollment and completion trends</h2><p>Monthly enrolled students and completed learners across your courses.</p></div>
            <TrendingUp size={19} />
          </div>
          {enrollmentTrend.length ? <div className="dashboard-trend-chart">{enrollmentTrend.map((point) => <div className="dashboard-trend-month" key={point.key}>
            <div className="dashboard-trend-bars" title={`${point.label}: ${point.enrolled} enrolled, ${point.completed} completed`}>
              <i style={{ height: `${Math.max(4, (point.enrolled / maxTrendValue) * 100)}%` }} />
              <b style={{ height: `${Math.max(point.completed ? 4 : 0, (point.completed / maxTrendValue) * 100)}%` }} />
            </div><small>{point.label}</small>
          </div>)}</div> : <p className="dashboard-insight-empty">Monthly trends will appear as students enroll in your courses.</p>}
          <div className="dashboard-chart-legend"><span><i /> Enrolled</span><span><i /> Completed</span></div>
        </article>

        <article className="dashboard-insight-card dashboard-insight-card--low-activity">
          <div className="dashboard-insight-heading"><div><h2>Assessments awaiting review</h2><p>Latest five submitted attempts that need grading.</p></div><ClipboardCheck size={19} /></div>
          {pendingReviews.length ? <ul className="dashboard-insight-list">{pendingReviews.slice(0, 5).map((attempt, index) => <li key={attempt.attempt_id ?? attempt.id ?? index}>
            <span><strong>{[attempt.first_name, attempt.last_name].filter(Boolean).join(" ") || attempt.username || "Student"}</strong><small>{attempt.assessment_title || "Assessment"}</small></span>
            <Link to={`/instructor/assessments/${attempt.assessment_id}/results/${attempt.attempt_id ?? attempt.id}`}>Review <ArrowRight size={14} /></Link>
          </li>)}</ul> : <p className="dashboard-insight-empty">No submitted attempts are waiting for review.</p>}
        </article>

        <article className="dashboard-insight-card">
          <div className="dashboard-insight-heading"><div><h2>Courses with low student activity</h2><p>No enrollments or no student access in 30 days.</p></div><Clock3 size={19} /></div>
          {lowActivityCourses.length ? <ul className="dashboard-insight-list">{lowActivityCourses.map((course) => <li key={getCourseId(course)}>
            <span><strong>{course.title || "Untitled course"}</strong><small>{Number(course.enrolled_students || 0)} enrolled · {course.last_student_activity_at ? `Last student activity ${new Date(course.last_student_activity_at).toLocaleDateString()}` : "No student activity recorded"}</small></span>
            <Link to={`/instructor/courses/${getCourseId(course)}`}>View <ArrowRight size={14} /></Link>
          </li>)}</ul> : <p className="dashboard-insight-empty">Your published courses have recent enrollment activity.</p>}
        </article>

        <article className="dashboard-insight-card">
          <div className="dashboard-insight-heading"><div><h2>Recent student questions</h2><p>Latest questions from the learning community.</p></div><MessageSquareText size={19} /></div>
          {studentQuestions.length ? <ul className="dashboard-insight-list">{studentQuestions.slice(0, 5).map((question, index) => <li key={question.id ?? question.post_id ?? index}>
            <span><strong>{question.title || question.content || "Student question"}</strong><small>{question.is_anonymous ? "Anonymous learner" : question.author_name || question.username || "Student"}{question.created_at ? ` · ${new Date(question.created_at).toLocaleDateString()}` : ""}</small></span>
            <Link to="/community">Open <ArrowRight size={14} /></Link>
          </li>)}</ul> : <p className="dashboard-insight-empty">No recent student questions were found.</p>}
        </article>
      </section>

      <section className="dashboard-workspace">
        <div className="dashboard-section-heading">
          <div>
            <h2>Continue building your courses</h2>
            <p>Your latest courses and their current status.</p>
          </div>

        </div>

        <div className="dashboard-table-wrap">
          <table className="dashboard-course-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Course code</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="dashboard-table-message">
                    Loading your courses...
                  </td>
                </tr>
              ) : recentCourses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="dashboard-table-message">
                    <div className="dashboard-empty-state">
                      <div className="dashboard-empty-icon">
                        <GraduationCap size={27} />
                      </div>
                      <strong>Your course library starts here</strong>
                      <p>
                        Create your first course and add modules and lessons
                        to build your learning experience.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentCourses.map((course, index) => {
                  const id = getCourseId(course);
                  const status = getCourseStatus(course);

                  return (
                    <tr key={id ?? course.course_code ?? index}>
                      <td>
                        <div className="dashboard-course-name">
                          <div className="dashboard-course-icon">
                            <BookOpen size={19} />
                          </div>
                          <div>
                            <strong>{course.title || "Untitled course"}</strong>
                            <small>
                              {course.short_description ||
                                "Continue managing your course content"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>{course.course_code || "—"}</td>

                      <td>
                        <StatusBadge status={status} />
                      </td>

                      <td>
                        {id ? (
                          <Link
                            className="dashboard-manage-link"
                            to={`/instructor/courses/${id}/edit`}
                          >
                            Manage <ArrowRight size={15} />
                          </Link>
                        ) : (
                          <span className="dashboard-muted">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-quick-actions" aria-labelledby="dashboard-next-steps-title">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="dashboard-next-steps-title">Your next steps</h2>
            <p>Quick ways to keep your courses and learners moving forward.</p>
          </div>
        </div>

        <div className="dashboard-action-grid">
          <Link
            className="dashboard-action-card"
            to={courses[0] && getCourseId(courses[0])
              ? `/instructor/courses/${getCourseId(courses[0])}/curriculum`
              : "/instructor/courses/create"}
          >
            <div className="dashboard-action-icon dashboard-action-icon--purple">
              <BookOpen size={21} />
            </div>
            <strong>{courses.length ? "Build your curriculum" : "Create your first course"}</strong>
            <p>Add clear modules, lessons, and learning resources to your course.</p>
            <span>{courses.length ? "Open curriculum" : "Create a course"}<ArrowRight size={15} /></span>
          </Link>

          <Link className="dashboard-action-card" to="/instructor/courses">
            <div className="dashboard-action-icon dashboard-action-icon--blue">
              <TrendingUp size={21} />
            </div>
            <strong>Review course activity</strong>
            <p>Check course status, enrollment, and learner progress in one place.</p>
            <span>Manage courses<ArrowRight size={15} /></span>
          </Link>

          <Link className="dashboard-action-card" to="/community">
            <div className="dashboard-action-icon dashboard-action-icon--green">
              <MessageSquareText size={21} />
            </div>
            <strong>Support your learners</strong>
            <p>Visit the learning community to answer questions and share guidance.</p>
            <span>Open community<ArrowRight size={15} /></span>
          </Link>
        </div>
      </section>

    </main>
  );
}
