import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Pagination,
  Typography,
} from "@mui/material";

import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import api from "../../../service/Api";
import LearnovaBackNavigation from "../../../component/LearnovaBackNavigation";
import "./PurchaseHistory.scss";

// Return a supported course thumbnail field.
const getCourseImage = (purchase) =>
  purchase?.course_thumbnail ||
  purchase?.thumbnail_url ||
  purchase?.thumbnailUrl ||
  purchase?.course?.thumbnail_url ||
  "";

// Format payment amounts using the returned currency.
const formatAmount = (amount, currency = "INR") => {
  const value = Number(amount);

  if (!Number.isFinite(value)) return "Amount unavailable";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
};

// Format purchase date and time.
const formatPurchaseDate = (dateValue) => {
  if (!dateValue) return "Date unavailable";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function PurchaseHistory() {
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);

  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 10,
    total_records: 0,
    total_pages: 0,
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch successful Demo Checkout purchases.
  const loadPurchaseHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/student/payments/history", {
        params: {
          page,
          limit: 10,
        },
      });

      const payload = response.data?.data ?? response.data;

      setPurchases(Array.isArray(payload) ? payload : []);

      setPagination(
        response.data?.pagination ?? {
          current_page: page,
          per_page: 10,
          total_records: Array.isArray(payload) ? payload.length : 0,
          total_pages: 0,
        }
      );
    } catch (err) {
      console.error("Failed to load purchase history:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load purchase history. Please try again."
      );

      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadPurchaseHistory();
  }, [loadPurchaseHistory]);

  // Navigate to the selected course learning page.
  const openCourse = (courseId) => {
    if (!courseId) return;

    navigate(`/student/learning/${encodeURIComponent(courseId)}`);
  };

  // Handle purchase history pagination.
  const handlePageChange = (_, nextPage) => {
    setPage(nextPage);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <Box className="purchase-history-page student-page">
      <Container maxWidth="xl" className="student-page-content">
        <LearnovaBackNavigation />

        {/* Page heading */}
        <Box className="purchase-history-heading">
          <Box>
            <Typography
              component="p"
              className="purchase-history-eyebrow"
            >
              LEARNOVA STUDENT SPACE
            </Typography>

            <Typography
              component="h1"
              className="purchase-history-title"
            >
              Purchase History
            </Typography>

            <Typography className="purchase-history-subtitle">
              View your purchased courses and transaction details.
            </Typography>
          </Box>

          <Box className="purchase-history-count">
            <ReceiptLongRoundedIcon />

            <Typography>
              {pagination.total_records}{" "}
              {pagination.total_records === 1
                ? "purchase"
                : "purchases"}
            </Typography>
          </Box>
        </Box>

        {/* Demo payment information */}
        <Alert
          severity="info"
          className="purchase-history-info"
          icon={<ShoppingBagRoundedIcon />}
        >
          Showing successful Demo Checkout purchases only.
        </Alert>

        {/* Error message */}
        {error && (
          <Alert
            severity="error"
            className="purchase-history-alert"
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}

        {/* Loading state */}
        {loading ? (
          <Box className="purchase-history-state">
            <CircularProgress />

            <Typography>
              Loading your purchase history...
            </Typography>
          </Box>
        ) : purchases.length === 0 ? (
          /* Empty state */
          <Box className="purchase-history-empty">
            <Box className="purchase-history-empty-icon">
              <ShoppingBagRoundedIcon />
            </Box>

            <Typography component="h2">
              No purchases yet
            </Typography>

            <Typography>
              Your successful Demo Checkout purchases will appear here.
            </Typography>

            <Button
              variant="contained"
              onClick={() => navigate("/student/dashboard")}
            >
              Explore courses
            </Button>
          </Box>
        ) : (
          <>
            {/* Purchase list */}
            <Box className="purchase-history-list">
              {purchases.map((purchase) => {
                const image = getCourseImage(purchase);

                const courseTitle =
                  purchase.course_title ||
                  purchase.course?.title ||
                  "Untitled course";

                const amount =
                  purchase.paid_amount ??
                  purchase.final_amount ??
                  purchase.original_amount;

                const purchaseDate =
                  purchase.paid_at ||
                  purchase.purchase_date ||
                  purchase.created_at;

                const transactionNumber =
                  purchase.transaction_number ||
                  purchase.payment_number ||
                  "Not available";

                return (
                  <Card
                    className="purchase-history-card"
                    key={purchase.payment_id}
                  >
                    <CardContent className="purchase-history-card-content">
                      <Box className="purchase-history-order-header">
                        <Box className="purchase-history-order-meta">
                          <CalendarMonthRoundedIcon />

                          <Box>
                            <Typography className="purchase-history-detail-label">
                              PURCHASE DATE
                            </Typography>

                            <Typography className="purchase-history-detail-value">
                              {formatPurchaseDate(purchaseDate)}
                            </Typography>
                          </Box>
                        </Box>

                        <Box className="purchase-history-order-meta purchase-history-order-reference">
                          <ReceiptLongRoundedIcon />

                          <Box>
                            <Typography className="purchase-history-detail-label">
                              TRANSACTION ID
                            </Typography>

                            <Typography className="purchase-history-detail-value purchase-history-transaction">
                              {transactionNumber}
                            </Typography>
                          </Box>
                        </Box>

                        <Chip
                          icon={<CheckCircleRoundedIcon />}
                          label="Payment successful"
                          size="small"
                          className="purchase-history-success"
                        />
                      </Box>

                      <Divider className="purchase-history-divider" />

                      <Box className="purchase-history-order-main">
                        <Box className="purchase-history-course">
                          <Box className="purchase-history-image">
                            {image ? (
                              <img
                                src={image}
                                alt={courseTitle}
                                loading="lazy"
                              />
                            ) : (
                              <SchoolRoundedIcon />
                            )}
                          </Box>

                          <Box className="purchase-history-course-info">
                            <Typography className="purchase-history-course-label">
                              COURSE PURCHASE
                            </Typography>

                            <Typography
                              component="h2"
                              className="purchase-history-course-title"
                            >
                              {courseTitle}
                            </Typography>

                            <Typography className="purchase-history-method">
                              Demo Checkout
                            </Typography>

                            {Number(
                              purchase.coupon_discount_amount || 0
                            ) > 0 && (
                              <Typography
                                variant="body2"
                                color="success.main"
                              >
                                Coupon discount:{" "}
                                {formatAmount(
                                  purchase.coupon_discount_amount,
                                  purchase.currency_code
                                )}
                              </Typography>
                            )}

                            {Number(
                              purchase.referral_discount_amount || 0
                            ) > 0 && (
                              <Typography
                                variant="body2"
                                color="success.main"
                              >
                                Instructor referral discount:{" "}
                                {formatAmount(
                                  purchase.referral_discount_amount,
                                  purchase.currency_code
                                )}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Box className="purchase-history-order-side">
                          <Box className="purchase-history-amount">
                            <Typography className="purchase-history-detail-label">
                              AMOUNT PAID
                            </Typography>

                            <Typography className="purchase-history-price">
                              {formatAmount(
                                amount,
                                purchase.currency_code
                              )}
                            </Typography>
                          </Box>

                          <Button
                            variant="outlined"
                            endIcon={<OpenInNewRoundedIcon />}
                            disabled={!purchase.course_id}
                            onClick={() =>
                              openCourse(purchase.course_id)
                            }
                          >
                            View course
                          </Button>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <Box className="purchase-history-pagination">
                <Pagination
                  count={pagination.total_pages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}