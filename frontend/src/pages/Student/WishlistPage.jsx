import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CourseCard from "../../component/Course/CourseCard";
import LearnovaBackNavigation from "../../component/LearnovaBackNavigation";
import api from "../../service/Api";
import { useWishlist } from "../../utils/wishlist";
import "./WishlistPage.scss";

export default function WishlistPage() {
  const navigate = useNavigate();
  const { courses, remove } = useWishlist();
  const [addingCourseId, setAddingCourseId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const addToCart = async (course) => {
    const courseId = course.id ?? course.course_id;
    if (courseId == null) return;

    setAddingCourseId(String(courseId));
    setFeedback(null);
    try {
      const response = await api.post("/student/cart/items", {
        course_id: courseId,
      });
      setFeedback({
        type: "success",
        message: response.data?.message || "Course added to your cart.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error.response?.data?.message ||
          "Unable to add this course to your cart. Please try again.",
      });
    } finally {
      setAddingCourseId(null);
    }
  };

  return (
    <main className="student-wishlist-page student-page student-page--inset">
      <Container maxWidth="xl" className="student-wishlist-content">
        <LearnovaBackNavigation
          to="/student/dashboard"
          label="Back to dashboard"
        />

        <header className="student-wishlist-heading">
          <span>YOUR SAVED COURSES</span>
          <h1>Wishlist</h1>
          <p>Keep track of courses you want to explore next.</p>
        </header>

        {feedback && (
          <Alert
            severity={feedback.type}
            className="student-wishlist-feedback"
            role={feedback.type === "success" ? "status" : "alert"}
            action={
              feedback.type === "success" ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => navigate("/student/cart")}
                >
                  View cart
                </Button>
              ) : null
            }
          >
            {feedback.message}
          </Alert>
        )}

        {courses.length ? (
          <div className="student-wishlist-grid">
            {courses.map((course, index) => (
              <article className="student-wishlist-item" key={course.id}>
                <CourseCard
                  course={course}
                  index={index}
                  onOpen={(selectedCourse) => navigate(
                    `/courses/${encodeURIComponent(selectedCourse.id)}`,
                    { state: { from: "/student/wishlist" } },
                  )}
                />
                <div className="student-wishlist-actions">
                  <Button
                    className="student-wishlist-add"
                    variant="contained"
                    startIcon={
                      addingCourseId === String(course.id) ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <ShoppingCartOutlinedIcon />
                      )
                    }
                    disabled={addingCourseId === String(course.id)}
                    onClick={() => addToCart(course)}
                  >
                    {addingCourseId === String(course.id) ? "Adding…" : "Add to cart"}
                  </Button>
                  <Tooltip title="Remove from wishlist">
                    <IconButton
                      className="student-wishlist-remove"
                      aria-label={`Remove ${
                        course.title ?? course.course_name ?? "course"
                      } from wishlist`}
                      onClick={() => remove(course.id)}
                      size="small"
                    >
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Box className="student-wishlist-empty">
            <FavoriteRoundedIcon />
            <Typography component="h2">Your wishlist is empty</Typography>
            <Typography>
              Save courses with the heart button and they’ll be collected here.
            </Typography>
            <Button variant="contained" onClick={() => navigate("/student/search")}>
              Explore courses
            </Button>
          </Box>
        )}
      </Container>
    </main>
  );
}
