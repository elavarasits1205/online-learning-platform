import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  Paper,
  Rating,
  TextField,
  Typography,
} from "@mui/material";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import api from "../../service/Api";
import "./CourseReviews.scss";

function reviewPayload(response) {
  return response?.data?.data ?? response?.data ?? {};
}

export default function CourseReviews({ courseId, isLoggedIn }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ summary: {}, reviews: [], my_review: null, can_review: false });
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadReviews = useCallback(async (signal) => {
    setLoading(true);
    try {
      const response = await api.get(
        `/public/courses/${encodeURIComponent(courseId)}/reviews`,
        { signal },
      );
      const result = reviewPayload(response);
      setData({
        summary: result.summary ?? {},
        reviews: Array.isArray(result.reviews) ? result.reviews : [],
        my_review: result.my_review ?? null,
        can_review: result.can_review === true,
      });
      setRating(Number(result.my_review?.rating ?? 0));
      setReviewText(result.my_review?.review_text ?? "");
      setError("");
    } catch (requestError) {
      if (requestError?.name !== "CanceledError" && requestError?.code !== "ERR_CANCELED") {
        setError(requestError.response?.data?.message || "Reviews are unavailable right now.");
      }
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    const controller = new AbortController();
    loadReviews(controller.signal);
    return () => controller.abort();
  }, [loadReviews]);

  const submitReview = async (event) => {
    event.preventDefault();
    if (!rating || !data.can_review || submitting) return;
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      await api.post(`/student/courses/${encodeURIComponent(courseId)}/reviews`, {
        rating,
        review_text: reviewText,
      });
      setMessage("Your review has been saved.");
      await loadReviews();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "We could not save your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="course-reviews" aria-labelledby="course-reviews-title">
      <div className="cd-section-kicker">STUDENT FEEDBACK</div>
      <div className="course-reviews__heading">
        <div>
          <Typography id="course-reviews-title" component="h2">Reviews &amp; ratings</Typography>
          <Typography className="cd-muted">Feedback from students enrolled in this course.</Typography>
        </div>
        <div className="course-reviews__summary" aria-label={`${Number(data.summary.average_rating || 0).toFixed(1)} out of 5 stars from ${data.summary.review_count || 0} reviews`}>
          <strong>{Number(data.summary.average_rating || 0).toFixed(1)}</strong>
          <Rating value={Number(data.summary.average_rating || 0)} precision={0.1} readOnly size="small" />
          <span>{data.summary.review_count || 0} reviews</span>
        </div>
      </div>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}

      {loading ? (
        <div className="course-reviews__loading"><CircularProgress size={22} /></div>
      ) : (
        <>
          {isLoggedIn && data.can_review ? (
            <Paper component="form" elevation={0} className="course-reviews__form" onSubmit={submitReview}>
              <strong>{data.my_review ? "Update your review" : "Share your experience"}</strong>
              <Rating
                value={rating}
                onChange={(_, value) => setRating(value || 0)}
                size="large"
                getLabelText={(value) => `${value} ${value === 1 ? "star" : "stars"}`}
              />
              <TextField
                fullWidth
                multiline
                minRows={3}
                maxRows={6}
                label="Your review (optional)"
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                inputProps={{ maxLength: 3000 }}
                helperText={`${reviewText.length}/3,000`}
              />
              <Button type="submit" variant="contained" disabled={!rating || submitting}>
                {submitting ? "Saving…" : data.my_review ? "Update review" : "Submit review"}
              </Button>
            </Paper>
          ) : !isLoggedIn ? (
            <Button className="course-reviews__login" onClick={() => navigate("/login", { state: { from: window.location.pathname } })}>
              Sign in to leave a review
            </Button>
          ) : (
            <p className="course-reviews__eligibility">Enroll in this course to share a rating and review.</p>
          )}

          {data.reviews.length ? (
            <div className="course-reviews__list">
              {data.reviews.map((review) => (
                <article className="course-reviews__item" key={review.id}>
                  <Avatar>{String(review.student_name || "S").charAt(0).toUpperCase()}</Avatar>
                  <div className="course-reviews__item-content">
                    <div className="course-reviews__item-top">
                      <strong>{review.student_name}</strong>
                      <time dateTime={review.created_at}>{review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}</time>
                    </div>
                    <Rating value={Number(review.rating)} readOnly size="small" />
                    {review.review_text && <p>{review.review_text}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="course-reviews__empty"><StarRoundedIcon /><span>No reviews yet. Be the first enrolled student to share feedback.</span></div>
          )}
        </>
      )}
    </section>
  );
}
