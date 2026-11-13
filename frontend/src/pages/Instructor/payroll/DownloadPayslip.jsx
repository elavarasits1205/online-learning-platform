import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { instructorPayrollSelfApi } from "../../../service/payroll.api";

const money = (value, code = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code || "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Unable to retrieve payslip.";

export default function DownloadPayslip() {
  const [payrollId, setPayrollId] = useState("");
  const [payrolls, setPayrolls] = useState([]);
  const [payrollsLoading, setPayrollsLoading] = useState(false);
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadPayrolls = async () => {
      setPayrollsLoading(true);

      try {
        const result =
          await instructorPayrollSelfApi.getPayrollHistory({
            page: 1,
            limit: 100,
          });

        if (active) {
          setPayrolls(Array.isArray(result?.rows) ? result.rows : []);
        }
      } catch (err) {
        if (active) {
          setPayrolls([]);
          setError(getErrorMessage(err));
        }
      } finally {
        if (active) {
          setPayrollsLoading(false);
        }
      }
    };

    loadPayrolls();

    return () => {
      active = false;
    };
  }, []);

  const fetchPayslip = async (event) => {
    event.preventDefault();

    setError("");
    setPayslip(null);

    const id = String(payrollId).trim();

    if (!/^[1-9]\d*$/.test(id)) {
      setError("Select a payroll record.");
      return;
    }

    setLoading(true);

    try {
      const result =
        await instructorPayrollSelfApi.getPayslip(id);

      setPayslip(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    if (!payslip?.payroll) return;

    const payroll = payslip.payroll;
    const earnings = Array.isArray(payslip.earnings)
      ? payslip.earnings
      : [];
    const payments = Array.isArray(payslip.payments)
      ? payslip.payments
      : [];

    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(18);
    doc.text("Instructor Payslip", 14, 18);

    doc.setFontSize(10);
    doc.text(
      `Payroll Number: ${payroll.payroll_number || "-"}`,
      14,
      30
    );
    doc.text(
      `Instructor Code: ${payroll.instructor_code || "-"}`,
      14,
      37
    );
    doc.text(
      `Instructor: ${payroll.instructor_name || payroll.instructor_username || "-"}`,
      14,
      44
    );
    doc.text(
      `Payroll Period: ${payroll.period_code || "-"}`,
      14,
      51
    );

    autoTable(doc, {
      startY: 60,
      head: [["Description", "Amount"]],
      body: [
        [
          "Course Earnings",
          money(payroll.total_earnings, payroll.currency_code),
        ],
        [
          "Referral Enrollment Incentives",
          money(payroll.incentive_amount, payroll.currency_code),
        ],
        ["Referral Incentive Calculation", payroll.incentive_notes || "-"],
        [
          "Total Deductions",
          money(payroll.total_deductions, payroll.currency_code),
        ],
        [
          "Net Amount",
          money(payroll.net_amount, payroll.currency_code),
        ],
      ],
    });

    let nextY = (doc.lastAutoTable?.finalY || 90) + 12;

    if (earnings.length > 0) {
      doc.setFontSize(13);
      doc.text("Course Earnings", 14, nextY);

      autoTable(doc, {
        startY: nextY + 5,
        head: [[
          "Course",
          "Rule",
          "Eligible Referred Enrollments",
          "Fixed",
          "Commission",
          "Activity Incentive",
          "Total Course Compensation",
        ]],
        body: earnings.map((item) => [
          item.course_title || item.course_code || "-",
          item.compensation_type || "-",
          Number(item.eligible_student_count || 0),
          money(item.fixed_amount, payroll.currency_code),
          money(item.commission_amount, payroll.currency_code),
          money(item.student_amount, payroll.currency_code),
          money(item.total_earning, payroll.currency_code),
        ]),
      });

      nextY = (doc.lastAutoTable?.finalY || nextY + 20) + 12;
    }

    if (payments.length > 0) {
      doc.setFontSize(13);
      doc.text("Payment Details", 14, nextY);

      autoTable(doc, {
        startY: nextY + 5,
        head: [["Payment Number", "Method", "Amount", "Status", "Bank Reference"]],
        body: payments.map((item) => [
          item.payment_number || "-",
          item.payment_method || "-",
          money(item.amount, item.currency_code || "INR"),
          item.status || "-",
          item.bank_reference || "-",
        ]),
      });
    }

    doc.save(
      `${payroll.payroll_number || "instructor-payslip"}.pdf`
    );
  };

  const payroll = payslip?.payroll;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
      <Typography variant="h5" fontWeight={800}>
        Download Payslip
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Select one of your payroll records to view and download your
        payslip.
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

      <Paper
        elevation={0}
        sx={{
          p: 3,
          maxWidth: 650,
          border: "1px solid #e9e8f2",
          borderRadius: 2,
        }}
      >
        <Box component="form" onSubmit={fetchPayslip}>
          <Stack spacing={2}>
            <TextField
              select
              fullWidth
              label="Payroll Record"
              value={payrollId}
              onChange={(event) =>
                setPayrollId(event.target.value)
              }
              disabled={loading || payrollsLoading}
              helperText={
                payrollsLoading
                  ? "Loading your payroll records..."
                  : payrolls.length === 0
                    ? "No payroll records are available yet."
                    : "Choose the payroll period you want to download."
              }
              required
            >
              {payrollsLoading && (
                <MenuItem value="" disabled>
                  Loading payroll records...
                </MenuItem>
              )}

              {!payrollsLoading && payrolls.length === 0 && (
                <MenuItem value="" disabled>
                  No payroll records available
                </MenuItem>
              )}

              {payrolls.map((payroll) => (
                <MenuItem
                  key={String(payroll.id)}
                  value={String(payroll.id)}
                >
                  {`${payroll.payroll_number || `Payroll #${payroll.id}`} - ${
                    payroll.period_code || "No period"
                  } - ${money(payroll.net_amount, payroll.currency_code)}`}
                </MenuItem>
              ))}
            </TextField>

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                bgcolor: "#6d4aff",
                "&:hover": { bgcolor: "#5134d7" },
                textTransform: "none",
              }}
            >
              {loading ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "View Payslip"
              )}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {payroll && (
        <Paper
          elevation={0}
          sx={{
            mt: 3,
            p: 3,
            border: "1px solid #e9e8f2",
            borderRadius: 2,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {payroll.payroll_number || "Payslip"}
              </Typography>

              <Typography color="text.secondary">
                {payroll.period_code || "-"}
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={downloadPdf}
              sx={{
                bgcolor: "#6d4aff",
                "&:hover": { bgcolor: "#5134d7" },
                textTransform: "none",
              }}
            >
              Download PDF
            </Button>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Stack spacing={1.5}>
            <Typography>
              Instructor:{" "}
              <strong>
                {payroll.instructor_name ||
                  payroll.instructor_username ||
                  "-"}
              </strong>
            </Typography>

            <Typography>
              Instructor Code:{" "}
              <strong>{payroll.instructor_code || "-"}</strong>
            </Typography>

            <Typography>
              Course Earnings:{" "}
              <strong>
                {money(payroll.total_earnings, payroll.currency_code)}
              </strong>
            </Typography>

            <Typography>
              Referral Enrollment Incentives:{" "}
              <strong>
                {money(payroll.incentive_amount, payroll.currency_code)}
              </strong>
            </Typography>

            {payroll.incentive_notes && (
              <Typography>
                Referral Incentive Calculation: <strong>{payroll.incentive_notes}</strong>
              </Typography>
            )}

            <Typography>
              Total Deductions:{" "}
              <strong>
                {money(payroll.total_deductions, payroll.currency_code)}
              </strong>
            </Typography>

            <Typography>
              Net Amount:{" "}
              <strong>
                {money(payroll.net_amount, payroll.currency_code)}
              </strong>
            </Typography>
          </Stack>

          {Array.isArray(payslip.earnings) && payslip.earnings.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
                Course and Referral Activity Breakdown
              </Typography>
              <Stack spacing={1.5}>
                {payslip.earnings.map((earning) => (
                  <Box
                    key={String(earning.id)}
                    sx={{
                      p: 2,
                      border: "1px solid #e9e8f2",
                      borderRadius: 2,
                    }}
                  >
                    <Typography fontWeight={700}>
                      {earning.course_title || earning.course_code || "Course"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {earning.compensation_type || earning.earning_type} · {earning.eligible_student_count || 0} eligible referred enrollments
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Fixed {money(earning.fixed_amount, earning.currency_code)}
                      {" · "}Commission {money(earning.commission_amount, earning.currency_code)}
                      {" · "}Referral incentive {money(earning.student_amount, earning.currency_code)}
                      {" · "}<strong>Total course compensation {money(earning.total_earning, earning.currency_code)}</strong>
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {Array.isArray(payslip.payments) && payslip.payments.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
                Payment History
              </Typography>
              <Stack spacing={1}>
                {payslip.payments.map((payment) => (
                  <Typography key={String(payment.id)} variant="body2">
                    {payment.payment_number} · {payment.status} · {money(payment.amount, payment.currency_code)}
                    {payment.bank_reference ? ` · ${payment.bank_reference}` : ""}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
