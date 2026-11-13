import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Grid,
  Paper,
  Skeleton,
  Typography,
} from "@mui/material";

import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";

import { instructorPayrollSelfApi } from "../../../service/payroll.api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const cards = [
  {
    key: "total_earnings",
    label: "Course Earnings",
    icon: <TrendingUpOutlinedIcon />,
  },
  {
    key: "total_incentives",
    label: "Referral Enrollment Incentives",
    icon: <ReceiptLongOutlinedIcon />,
  },
  {
    key: "net_amount",
    label: "Net Amount",
    icon: <AccountBalanceWalletOutlinedIcon />,
  },
  {
    key: "paid_amount",
    label: "Paid Amount",
    icon: <PaymentsOutlinedIcon />,
  },
  {
    key: "payroll_count",
    label: "Payroll Records",
    icon: <ReceiptLongOutlinedIcon />,
    numeric: true,
  },
];

export default function EarningsOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await instructorPayrollSelfApi.getOverview();
      setOverview(result || {});
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load earnings overview."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
      <Typography variant="h5" fontWeight={800}>
        Earnings Overview
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Your instructor earnings and payroll summary.
      </Typography>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.key}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                height: "100%",
                border: "1px solid #e9e8f2",
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 2,
                  bgcolor: "#eee9ff",
                  color: "#6d4aff",
                  mb: 2,
                }}
              >
                {card.icon}
              </Box>

              <Typography color="text.secondary" variant="body2">
                {card.label}
              </Typography>

              {loading ? (
                <Skeleton width="70%" height={38} />
              ) : (
                <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                  {card.numeric
                    ? Number(overview?.[card.key] || 0)
                    : money(overview?.[card.key])}
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {!loading && overview && (
        <Paper
          elevation={0}
          sx={{
            mt: 3,
            p: 2.5,
            border: "1px solid #e9e8f2",
            borderRadius: 2,
          }}
        >
          <Typography fontWeight={800} sx={{ mb: 2 }}>
            Instructor Details
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="caption" color="text.secondary">
                Instructor Code
              </Typography>
              <Typography fontWeight={600}>
                {overview.instructor_code || "-"}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="caption" color="text.secondary">
                Instructor Name
              </Typography>
              <Typography fontWeight={600}>
                {overview.instructor_name ||
                  overview.instructor_username ||
                  "-"}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="caption" color="text.secondary">
                Total Deductions
              </Typography>
              <Typography fontWeight={600}>
                {money(overview.total_deductions)}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
}
