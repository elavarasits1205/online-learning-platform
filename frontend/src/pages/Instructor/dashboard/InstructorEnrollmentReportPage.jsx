import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Alert, Box, MenuItem, TextField, Typography } from "@mui/material";
import DataTable from "../../../component/tables/DataTable";
import ReportSummaryCards from "../../admin/reports/ReportSummaryCards";
import api from "../../../service/Api";
import { formatDate, formatMoney, getReportErrorMessage } from "../../admin/reports/reportUtils";

const STATUS_OPTIONS = ["ACTIVE", "COMPLETED", "PENDING", "CANCELLED", "FAILED", "EXPIRED"];

export default function InstructorEnrollmentReportPage() {
  const location = useLocation();
  const isStudents = location.pathname === "/instructor/students";
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "ALL", fromDate: "", toDate: "" });

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isStudents) {
        const response = await api.get("/instructors/students");
        const result = response?.data?.data ?? response?.data;
        const studentRows = Array.isArray(result) ? result : [];
        setRows(studentRows);
        setSummary({
          total_students: studentRows.length,
          total_enrollments: studentRows.reduce((sum, student) => sum + Number(student.enrollment_count || 0), 0),
          completed_courses: studentRows.reduce((sum, student) => sum + Number(student.completed_courses || 0), 0),
        });
      } else {
        const params = { page: 1, limit: 100 };
        Object.entries(filters).forEach(([key, value]) => {
          if (value && !(key === "status" && value === "ALL")) params[key] = value;
        });
        const response = await api.get("/instructors/reports/enrollments", { params });
        const result = response?.data?.data ?? {};
        setRows(Array.isArray(result.rows) ? result.rows : []);
        setSummary(result.summary ?? null);
      }
    } catch (err) {
      setRows([]);
      setSummary(null);
      setError(getReportErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, isStudents]);

  useEffect(() => {
    const timer = window.setTimeout(loadReport, 0);
    return () => window.clearTimeout(timer);
  }, [loadReport]);

  const enrollmentColumns = [
    { field: "enrollment_number", label: "Enrollment No.", minWidth: 170 },
    { field: "student_name", label: "Student", minWidth: 170 },
    { field: "student_email", label: "Student Email", minWidth: 210 },
    { field: "student_code", label: "Student Code", minWidth: 140 },
    { field: "course_title", label: "Course", minWidth: 210 },
    { field: "course_code", label: "Course Code", minWidth: 140 },
    { field: "status", label: "Status", minWidth: 120 },
    { field: "enrollment_date", label: "Enrollment Date", minWidth: 150, render: formatDate },
    { field: "completed_at", label: "Completed At", minWidth: 150, render: formatDate },
    { field: "price", label: "Course Price", minWidth: 130, render: (value, row) => formatMoney(value, row.currency_code) },
  ];

  const studentColumns = [
    { field: "student_name", label: "Student", minWidth: 190 },
    { field: "student_email", label: "Email", minWidth: 230 },
    { field: "student_code", label: "Student Code", minWidth: 150 },
    { field: "register_number", label: "Register No.", minWidth: 150 },
    { field: "enrollment_count", label: "Enrollments", minWidth: 120 },
    { field: "completed_courses", label: "Completed", minWidth: 120 },
    { field: "course_titles", label: "Courses", minWidth: 280 },
    { field: "most_recent_enrollment", label: "Latest Enrollment", minWidth: 160, render: formatDate },
    { field: "last_student_activity_at", label: "Last Activity", minWidth: 160, render: formatDate },
  ];

  const enrollmentCards = [
    { label: "Total Enrollments", value: summary?.total_enrollments ?? 0 },
    { label: "Active", value: summary?.active_enrollments ?? 0 },
    { label: "Completed", value: summary?.completed_enrollments ?? 0 },
    { label: "Pending", value: summary?.pending_enrollments ?? 0 },
    { label: "Courses", value: summary?.total_courses ?? 0 },
  ];
  const studentCards = [
    { label: "My Students", value: summary?.total_students ?? 0 },
    { label: "Enrollments", value: summary?.total_enrollments ?? 0 },
    { label: "Completed Courses", value: summary?.completed_courses ?? 0 },
  ];

  return <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
    <Typography variant="h5" sx={{ fontWeight: 800 }}>{isStudents ? "My Students" : "All Enrollments"}</Typography>
    <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>{isStudents ? "Students enrolled in your courses and their recent learning activity." : "Enrollment activity across your courses."}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!isStudents && <Box className="enrollment-report-filters" sx={{ display: "grid", width: "100%", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
      <Box>
        <Typography component="label" htmlFor="enrollment-report-status" variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>Status</Typography>
        <TextField id="enrollment-report-status" aria-label="Enrollment status" select fullWidth size="small" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <MenuItem value="ALL">All statuses</MenuItem>
          {STATUS_OPTIONS.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
        </TextField>
      </Box>
      <Box>
        <Typography component="label" htmlFor="enrollment-report-from-date" variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>From date</Typography>
        <TextField id="enrollment-report-from-date" aria-label="From date" fullWidth size="small" type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} />
      </Box>
      <Box>
        <Typography component="label" htmlFor="enrollment-report-to-date" variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>To date</Typography>
        <TextField id="enrollment-report-to-date" aria-label="To date" fullWidth size="small" type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} />
      </Box>
    </Box>}
    <ReportSummaryCards cards={isStudents ? studentCards : enrollmentCards} />
    <DataTable title={isStudents ? "My Students" : "Enrollment Report Details"} rows={rows} columns={isStudents ? studentColumns : enrollmentColumns} loading={loading} error={null} getRowId={(row) => String(row.id)} onRefresh={loadReport} searchPlaceholder="Search student or course..." emptyMessage={isStudents ? "No students are enrolled in your courses yet." : "No enrollment records found in your courses."} minWidth={isStudents ? 1550 : 1500} initialRowsPerPage={10} />
  </Box>;
}
