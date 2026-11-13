import { useCallback, useEffect, useRef, useState } from "react";

import {
    Alert,
    Box,
    Grid,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import DataTable from "../../../component/tables/DataTable";
import { adminReportApi } from "../../../service/adminReportApi";
import courseApi from "../../../service/courseApi";
import { getInstitutions } from "../../../service/institutionApi";
import ReportSummaryCards from "./ReportSummaryCards";
import {
    formatDate,
    formatMoney,
    getReportErrorMessage,
} from "./reportUtils";

const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

const STATUS_OPTIONS = [
    "ACTIVE",
    "COMPLETED",
    "PENDING",
    "CANCELLED",
    "FAILED",
    "EXPIRED",
];

function extractInstitutions(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.rows)) return result.rows;
    if (Array.isArray(result?.items)) return result.items;
    if (Array.isArray(result?.institutions)) return result.institutions;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.data?.rows)) return result.data.rows;
    if (Array.isArray(result?.data?.institutions)) {
        return result.data.institutions;
    }

    return [];
}

export default function EnrollmentReportPage() {
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [filters, setFilters] = useState({
        status: "",
        courseId: "",
        institutionId: "",
        fromDate: "",
        toDate: "",
    });

    const [courses, setCourses] = useState([]);
    const [institutions, setInstitutions] = useState([]);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const optionsLoadedRef = useRef(false);

    const loadOptions = useCallback(async () => {
        if (optionsLoadedRef.current) return;

        setOptionsLoading(true);

        try {
            const [courseRows, institutionResult] = await Promise.all([
                courseApi.getAllCourses(),
                getInstitutions({ page: 1, limit: 100 }),
            ]);

            setCourses(Array.isArray(courseRows) ? courseRows : []);
            setInstitutions(extractInstitutions(institutionResult));
            optionsLoadedRef.current = true;
        } catch (err) {
            setError(getReportErrorMessage(err));
        } finally {
            setOptionsLoading(false);
        }
    }, []);

    const loadReport = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const params = {
                page: 1,
                limit: 100,
            };

            if (filters.status) params.status = filters.status;
            if (filters.courseId) params.courseId = filters.courseId;
            if (filters.institutionId) {
                params.institutionId = filters.institutionId;
            }
            if (filters.fromDate) params.fromDate = filters.fromDate;
            if (filters.toDate) params.toDate = filters.toDate;

            const result = await adminReportApi.enrollments.getAll(params);

            setRows(result.rows);
            setSummary(result.summary);
        } catch (err) {
            setRows([]);
            setSummary(null);
            setError(getReportErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        const timer = window.setTimeout(loadOptions, 0);

        return () => window.clearTimeout(timer);
    }, [loadOptions]);

    useEffect(() => {
        const timer = window.setTimeout(loadReport, 0);

        return () => window.clearTimeout(timer);
    }, [loadReport]);

    const columns = [
        {
            field: "enrollment_number",
            label: "Enrollment No.",
            minWidth: 180,
        },
        { field: "student_name", label: "Student", minWidth: 170 },
        { field: "student_email", label: "Student Email", minWidth: 210 },
        { field: "student_code", label: "Student Code", minWidth: 140 },
        { field: "register_number", label: "Register No.", minWidth: 140 },
        { field: "institution_name", label: "Institution", minWidth: 170 },
        { field: "course_title", label: "Course", minWidth: 210 },
        { field: "course_code", label: "Course Code", minWidth: 140 },
        { field: "instructor_name", label: "Instructor", minWidth: 170 },
        {
            field: "price",
            label: "Price",
            minWidth: 130,
            render: (value, row) => formatMoney(value, row.currency_code),
        },
        { field: "status", label: "Status", minWidth: 120 },
        {
            field: "enrollment_date",
            label: "Enrollment Date",
            minWidth: 150,
            render: (value) => formatDate(value),
        },
        {
            field: "completed_at",
            label: "Completed At",
            minWidth: 150,
            render: (value) => formatDate(value),
        },
    ];

    const cards = [
        {
            label: "Total Enrollments",
            value: summary?.total_enrollments ?? 0,
        },
        {
            label: "Active",
            value: summary?.active_enrollments ?? 0,
        },
        {
            label: "Completed",
            value: summary?.completed_enrollments ?? 0,
        },
        {
            label: "Pending",
            value: summary?.pending_enrollments ?? 0,
        },
        {
            label: "Cancelled",
            value: summary?.cancelled_enrollments ?? 0,
        },
        {
            label: "Total Course Value",
            value: formatMoney(summary?.total_course_value),
        },
    ];

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
            <Typography
                variant="h5"
                sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
            >
                Enrollment Report
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                Review enrollment activity by status, course, institution and
                date range.
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
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Status"
                        value={filters.status}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                status: event.target.value,
                            }))
                        }
                    >
                        <MenuItem value="">All statuses</MenuItem>

                        {STATUS_OPTIONS.map((status) => (
                            <MenuItem key={status} value={status}>
                                {status}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Course"
                        value={filters.courseId}
                        disabled={optionsLoading}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                courseId: event.target.value,
                            }))
                        }
                    >
                        <MenuItem value="">All courses</MenuItem>

                        {courses.map((course) => (
                            <MenuItem
                                key={String(course.id)}
                                value={String(course.id)}
                            >
                                {`${course.course_code || ""} - ${
                                    course.title || course.id
                                }`}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Institution"
                        value={filters.institutionId}
                        disabled={optionsLoading}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                institutionId: event.target.value,
                            }))
                        }
                    >
                        <MenuItem value="">All institutions</MenuItem>

                        {institutions.map((institution) => (
                            <MenuItem
                                key={String(institution.id)}
                                value={String(institution.id)}
                            >
                                {institution.name || institution.id}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="From Date"
                        value={filters.fromDate}
                        InputLabelProps={{ shrink: true }}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                fromDate: event.target.value,
                            }))
                        }
                    />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="To Date"
                        value={filters.toDate}
                        InputLabelProps={{ shrink: true }}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                toDate: event.target.value,
                            }))
                        }
                    />
                </Grid>
            </Grid>

            <ReportSummaryCards cards={cards} />

            <DataTable
                title="Enrollment Report Details"
                rows={rows}
                columns={columns}
                loading={loading}
                error={null}
                getRowId={(row) => String(row.id)}
                onRefresh={loadReport}
                searchPlaceholder="Search enrollment, student, course..."
                emptyMessage="No enrollment records found."
                minWidth={1950}
                initialRowsPerPage={10}
            />
        </Box>
    );
}
