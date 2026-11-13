import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Container, Divider, Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { useNavigate } from "react-router-dom";
import api from "../../../service/Api";
import LearnovaBackNavigation from "../../../component/LearnovaBackNavigation";
import RelatedCourses from "../../../component/Course/RelatedCourses";
import "./StudentCart.scss";

function money(value, currency = "INR") {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return String(value ?? "");
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency, maximumFractionDigits: 2,
  }).format(amount);
}

export default function StudentCart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingCourseId, setRemovingCourseId] = useState(null);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/student/cart");
      setCart(response.data?.data ?? null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load your cart. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCart(); }, [loadCart]);

  const items = useMemo(
    () => (Array.isArray(cart?.items) ? cart.items : []),
    [cart],
  );
  const currencies = [...new Set(items.map((item) => String(item.currency_code || "INR").toUpperCase()))];
  const cartCurrency = currencies[0] || "INR";
  const subtotal = items.reduce((total, item) => total + Number(item.price || 0), 0);
  const canCheckoutCart = items.length > 0 &&
    items.every((item) => Boolean(item.course_id)) &&
    currencies.length === 1;

  const handleRemove = async (courseId) => {
    setRemovingCourseId(String(courseId));
    setError("");
    try {
      await api.delete(`/student/cart/items/${encodeURIComponent(courseId)}`);
      await loadCart();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to remove this course. Please try again.");
    } finally {
      setRemovingCourseId(null);
    }
  };

  return (
    <Box className="student-cart-page student-page">
      <Container maxWidth="xl" className="student-page-content">
        <LearnovaBackNavigation />

        <Box className="student-cart-heading">
          <Box>
            <Typography component="p" className="student-cart-eyebrow">LEARNOVA · YOUR LEARNING</Typography>
            <Typography component="h1">Shopping Cart</Typography>
            <Typography className="student-cart-subtitle">Review your selected courses before checkout.</Typography>
          </Box>
          <Box className="student-cart-count">
            <ShoppingCartOutlinedIcon />
            <span>{items.length} {items.length === 1 ? "course" : "courses"}</span>
          </Box>
        </Box>

        {error && <Alert severity="error" className="student-cart-alert"
          action={<Button color="inherit" size="small" onClick={loadCart}>Retry</Button>}>{error}</Alert>}

        {loading ? (
          <Box className="student-cart-loading"><CircularProgress /><Typography>Loading your cart...</Typography></Box>
        ) : items.length === 0 ? (
          <Box className="student-cart-empty">
            <span className="student-cart-empty-icon"><ShoppingCartOutlinedIcon /></span>
            <Typography component="h2">Your cart is empty</Typography>
            <Typography>Browse our courses and add the skills you want to learn.</Typography>
            <Button variant="contained" onClick={() => navigate("/student/dashboard")}>Explore courses</Button>
          </Box>
        ) : (
          <Box className="student-cart-layout">
            <Box className="student-cart-items">
              <Typography component="h2">{items.length} {items.length === 1 ? "course" : "courses"} in cart</Typography>
              {items.map((item) => {
                const courseId = item.course_id;
                const isRemoving = removingCourseId === String(courseId);
                return (
                  <Card className="student-cart-item" variant="outlined" key={item.cart_item_id ?? courseId}>
                    <Box className="student-cart-item-image">
                      {item.thumbnail_url ? <img src={item.thumbnail_url} alt={item.title || "Course"} />
                        : <MenuBookRoundedIcon />}
                    </Box>
                    <Box className="student-cart-item-info">
                      <Typography component="h3">{item.title || "Course"}</Typography>
                      <Typography className="student-cart-item-meta">{item.level || "Online course"}</Typography>
                      <Button className="student-cart-remove" color="error" size="small"
                        startIcon={isRemoving ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineRoundedIcon />}
                        disabled={isRemoving} onClick={() => handleRemove(courseId)}>
                        {isRemoving ? "Removing..." : "Remove"}
                      </Button>
                    </Box>
                    <Typography className="student-cart-item-price">{money(item.price, item.currency_code || "INR")}</Typography>
                  </Card>
                );
              })}
            </Box>
            <Card className="student-cart-summary" variant="outlined">
              <Typography component="h2">Order Summary</Typography>
              <Box className="student-cart-summary-row"><span>Courses ({items.length})</span><span>{currencies.length === 1 ? money(subtotal, cartCurrency) : "Multiple currencies"}</span></Box>
              <Divider />
              <Box className="student-cart-summary-total"><strong>Total</strong><strong>{currencies.length === 1 ? money(subtotal, cartCurrency) : "See course prices"}</strong></Box>
              <Typography className="student-cart-summary-note">
                {currencies.length === 1
                  ? "All selected courses will be checked out together. Applicable discounts will be shown during checkout."
                  : "Courses with different currencies must be checked out separately. Remove items until one currency remains."}
              </Typography>
              <Button fullWidth variant="contained" className="student-cart-checkout"
                disabled={!canCheckoutCart}
                onClick={() => navigate("/checkout")}>
                Proceed to checkout
              </Button>
              <Button fullWidth className="student-cart-continue"
                onClick={() => navigate("/student/dashboard")}>Continue shopping</Button>
            </Card>
          </Box>
        )}

        <RelatedCourses
          excludeCourseIds={items.map((item) => item.course_id)}
          title="Recommended for you"
          description="Discover another course to add to your learning plan."
        />
      </Container>
    </Box>
  );
}
