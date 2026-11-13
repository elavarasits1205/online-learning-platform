import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Typography,
} from "@mui/material";

import DataTable from "../../../component/tables/DataTable";
import { instructorPayrollSelfApi } from "../../../service/payroll.api";

const money = (value, code = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code || "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function CourseWiseEarnings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result =
        await instructorPayrollSelfApi.getCourseEarnings({
          page: 1,
          limit: 100,
        });

      setRows(result.rows || []);
    } catch (err) {
      setRows([]);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load course earnings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    { field: "payroll_number", label: "Payroll Number" },
    { field: "instructor_code", label: "Instructor Code" },
    { field: "course_code", label: "Course Code" },
    { field: "course_title", label: "Course Title" },
    { field: "compensation_type", label: "Compensation Type" },
    { field: "eligible_student_count", label: "Eligible Referred Enrollments" },
    {
      field: "rate_amount",
      label: "Per-Student Rate",
      render: (value, row) => value === null || value === undefined
        ? "-"
        : money(value, row.currency_code),
    },
    {
      field: "rate_percentage",
      label: "Commission Rate",
      render: (value) => value === null || value === undefined ? "-" : `${value}%`,
    },
    {
      field: "eligible_course_revenue",
      label: "Eligible Revenue",
      render: (value, row) => money(value, row.currency_code),
    },
    {
      field: "fixed_amount",
      label: "Fixed",
      render: (value, row) => money(value, row.currency_code),
    },
    {
      field: "commission_amount",
      label: "Commission",
      render: (value, row) => money(value, row.currency_code),
    },
    {
      field: "student_amount",
      label: "Referral Enrollment Incentive",
      render: (value, row) => money(value, row.currency_code),
    },
    {
      field: "total_earning",
      label: "Total Course Compensation",
      render: (value, row) => money(value, row.currency_code),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
      <Typography variant="h5" fontWeight={800}>
        Course-wise Earnings
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        View referred paid enrollments, per-enrollment incentive rates and calculated referral payments.
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

      <DataTable
        title="Course-wise Earnings"
        rows={rows}
        columns={columns}
        loading={loading}
        error={null}
        getRowId={(row) => String(row.id)}
        onRefresh={loadData}
        searchPlaceholder="Search course earnings..."
        emptyMessage="No course earnings found."
        minWidth={1300}
        initialRowsPerPage={10}
      />
    </Box>
  );
}
