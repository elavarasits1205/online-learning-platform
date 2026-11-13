import { useCallback, useEffect, useRef, useState } from "react";

import {
  Alert,
  Box,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import DataTable from "../../../component/tables/DataTable";
import {
  payrollDropdownApi,
  payrollReportApi,
} from "../../../service/payroll.api";

const money = (value, code = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code || "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN") : "-";

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Unable to load payroll reports.";

export default function PayrollData() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    periodId: "",
    instructorId: "",
    courseId: "",
  });

  const [periods, setPeriods] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const optionsLoadedRef = useRef(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!optionsLoadedRef.current) {
        setOptionsLoading(true);

        try {
          const [periodRows, instructorRows, courseRows] = await Promise.all([
            payrollDropdownApi.getPeriods({ page: 1, limit: 100 }),
            payrollDropdownApi.getInstructors({ page: 1, limit: 100 }),
            payrollDropdownApi.getCourses({ page: 1, limit: 100 }),
          ]);

          setPeriods(periodRows);
          setInstructors(instructorRows);
          setCourses(courseRows);
          optionsLoadedRef.current = true;
        } catch (err) {
          setError(getErrorMessage(err));
        } finally {
          setOptionsLoading(false);
        }
      }

      const params = {};

      if (filters.periodId.trim()) {
        params.periodId = filters.periodId.trim();
      }

      if (filters.instructorId.trim()) {
        params.instructorId = filters.instructorId.trim();
      }

      if (filters.courseId.trim()) {
        params.courseId = filters.courseId.trim();
      }

      const result = await payrollReportApi.getAll(params);

      setRows(Array.isArray(result) ? result : []);
    } catch (err) {
      setRows([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const totalsByCurrency = rows.reduce((totals, row) => {
    const currency = String(row.currency_code || "INR").toUpperCase();
    const total = totals.get(currency) || {
      currency,
      earnings: 0,
      incentives: 0,
      deductions: 0,
      net: 0,
      paid: 0,
    };

    total.earnings += Number(row.total_earnings || 0);
    total.incentives += Number(row.incentive_amount || 0);
    total.deductions += Number(row.total_deductions || 0);
    total.net += Number(row.net_amount || 0);
    if (row.payment_status === "SUCCESS") {
      total.paid += Number(row.net_amount || 0);
    }
    totals.set(currency, total);
    return totals;
  }, new Map());

  const columns = [
    { field: "payroll_number", label: "Payroll Number" },
    { field: "period_code", label: "Period Code" },
    {
      field: "period_start",
      label: "Period Start",
      render: (value) => formatDate(value),
    },
    {
      field: "period_end",
      label: "Period End",
      render: (value) => formatDate(value),
    },
    { field: "instructor_code", label: "Instructor Code" },
    {
      field: "instructor_name",
      label: "Instructor",
      valueGetter: (row) =>
        row.instructor_name || row.instructor_username || "-",
    },
    {
      field: "total_earnings",
      label: "Course Earnings",
      render: (value, row) =>
        money(value, row.currency_code),
    },
    {
      field: "incentive_amount",
      label: "Referral Enrollment Incentive",
      render: (value, row) => money(value, row.currency_code),
    },
    { field: "incentive_notes", label: "Referral Incentive Calculation" },
    {
      field: "total_deductions",
      label: "Deductions",
      render: (value, row) =>
        money(value, row.currency_code),
    },
    {
      field: "net_amount",
      label: "Net Amount",
      render: (value, row) =>
        money(value, row.currency_code),
    },
    { field: "status", label: "Status" },
    { field: "payment_status", label: "Transfer Status" },
    { field: "payment_number", label: "Payment Reference" },
    { field: "payment_method", label: "Payment Method" },
    { field: "bank_reference", label: "Bank / Transaction Reference" },
    {
      field: "payment_processed_at",
      label: "Transferred On",
      render: (value) => formatDate(value),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
      <Typography variant="h5" fontWeight={800}>
        Payroll Reports
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Automatically generated from approved payrolls and recorded transfer results.
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

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Payroll Period"
            placeholder="All payroll periods"
            value={filters.periodId}
            disabled={optionsLoading}
            InputLabelProps={{ shrink: true }}
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                if (!value) return "All payroll periods";
                const period = periods.find((item) => String(item.id) === String(value));
                return period
                  ? `${period.period_code || period.id} (${formatDate(period.period_start)} - ${formatDate(period.period_end)})`
                  : "All payroll periods";
              },
            }}
            sx={{ "& .MuiSelect-select": { whiteSpace: "nowrap", overflowX: "auto", textOverflow: "clip" } }}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                periodId: event.target.value,
              }))
            }
          >
            <MenuItem value="">All periods</MenuItem>

            {periods.map((period) => (
              <MenuItem key={String(period.id)} value={String(period.id)}>
                {`${period.period_code || period.id} (${
                  formatDate(period.period_start)
                } - ${formatDate(period.period_end)})`}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Instructor"
            placeholder="All instructors"
            value={filters.instructorId}
            disabled={optionsLoading}
            InputLabelProps={{ shrink: true }}
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                if (!value) return "All instructors";
                const instructor = instructors.find((item) => String(item.id) === String(value));
                const name = instructor?.instructor_name ||
                  [instructor?.first_name, instructor?.last_name].filter(Boolean).join(" ") ||
                  instructor?.username || instructor?.email || "Instructor";
                return instructor?.instructor_code
                  ? `${instructor.instructor_code} - ${name}`
                  : name;
              },
            }}
            sx={{ "& .MuiSelect-select": { whiteSpace: "nowrap", overflowX: "auto", textOverflow: "clip" } }}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                instructorId: event.target.value,
              }))
            }
          >
            <MenuItem value="">All instructors</MenuItem>

            {instructors.map((instructor) => {
              const fullName = [
                instructor.first_name,
                instructor.last_name,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <MenuItem
                  key={String(instructor.id)}
                  value={String(instructor.id)}
                >
                  {`${instructor.instructor_code || ""} - ${
                    instructor.instructor_name ||
                    fullName ||
                    instructor.username ||
                    instructor.email ||
                    instructor.id
                  }`}
                </MenuItem>
              );
            })}
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Course"
            placeholder="All courses"
            value={filters.courseId || ""}
            disabled={optionsLoading}
            InputLabelProps={{ shrink: true }}
            SelectProps={{
              displayEmpty: true,
              renderValue: (value) => {
                if (!value) return "All courses";
                const course = courses.find((item) => String(item.id) === String(value));
                const title = course?.title || course?.course_title || "Course";
                return course?.course_code ? `${course.course_code} - ${title}` : title;
              },
            }}
            sx={{ "& .MuiSelect-select": { whiteSpace: "nowrap", overflowX: "auto", textOverflow: "clip" } }}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                courseId: event.target.value,
              }))
            }
          >
            <MenuItem value="">All courses</MenuItem>
            {courses.map((course) => (
              <MenuItem key={String(course.id)} value={String(course.id)}>
                {course.course_code ? `${course.course_code} - ` : ""}
                {course.title || course.course_title || course.name || `Course ${course.id}`}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[...totalsByCurrency.values()].flatMap((totals) => [
          { label: `Course Earnings · ${totals.currency}`, value: totals.earnings },
          { label: `Referral Enrollment Incentives · ${totals.currency}`, value: totals.incentives },
          { label: `Deductions · ${totals.currency}`, value: totals.deductions },
          { label: `Net Payroll · ${totals.currency}`, value: totals.net },
          { label: `Paid · ${totals.currency}`, value: totals.paid },
        ]).map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                border: "1px solid #e9e8f2",
                borderRadius: 2,
              }}
            >
              <Typography color="text.secondary" variant="body2">
                {card.label}
              </Typography>

              <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
                {money(card.value, card.label.split("·").at(-1)?.trim())}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <DataTable
        title="Payroll Report Details"
        rows={rows}
        columns={columns}
        loading={loading}
        error={null}
        getRowId={(row) => String(row.instructor_payroll_id)}
        onRefresh={loadReports}
        searchPlaceholder="Search payroll reports..."
        emptyMessage="No payroll report records found."
        minWidth={1250}
        initialRowsPerPage={10}
      />
    </Box>
  );
}
