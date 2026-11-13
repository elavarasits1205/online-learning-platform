import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    Typography,
} from "@mui/material";

import DataTable from "../../../component/tables/DataTable";
import {
    adminEnrollmentApi,
    getErrorMessage,
} from "../../../service/adminEnrollmentApi";

const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const formatDateTime = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const money = (value, currency = "INR") => {
    if (value === null || value === undefined || value === "") return "-";

    const amount = Number(value);

    if (!Number.isFinite(amount)) return String(value);

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currency || "INR",
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency || "INR"} ${amount.toFixed(2)}`;
    }
};

const yesNo = (value) => (value ? "Yes" : "No");

const textColumn = (field, headerName, minWidth = 160) => ({
    field,
    headerName,
    minWidth,
    valueGetter: (row) => row[field] ?? "-",
    exportValue: (row) => row[field] ?? "",
});

const dateColumn = (field, headerName, minWidth = 145) => ({
    field,
    headerName,
    minWidth,
    valueGetter: (row) => formatDate(row[field]),
    exportValue: (row) => formatDate(row[field]),
});

const COLUMNS = [
    textColumn("enrollment_number", "Enrollment No.", 185),
    textColumn("student_name", "Student", 190),
    textColumn("student_email", "Student Email", 220),
    textColumn("student_code", "Student Code", 140),
    textColumn("register_number", "Register No.", 145),
    textColumn("institution_name", "Institution", 180),
    textColumn("course_title", "Course", 230),
    textColumn("course_code", "Course Code", 140),
    textColumn("instructor_name", "Instructor", 180),
    textColumn("course_type", "Course Type", 130),
    textColumn("level", "Level", 110),
    {
        field: "price",
        headerName: "Price",
        minWidth: 130,
        valueGetter: (row) => money(row.price, row.currency_code),
        exportValue: (row) => money(row.price, row.currency_code),
    },
    textColumn("status", "Status", 125),
    dateColumn("enrollment_date", "Enrollment Date"),
    dateColumn("start_date", "Start Date"),
    dateColumn("expected_completion_date", "Expected Completion"),
    dateColumn("completed_at", "Completed At"),
    dateColumn("last_accessed_at", "Last Accessed"),
    dateColumn("cancelled_at", "Cancelled At"),
    textColumn("cancellation_reason", "Cancellation Reason", 190),
    {
        field: "soft_delete",
        headerName: "Deleted",
        minWidth: 100,
        valueGetter: (row) => yesNo(row.soft_delete),
        exportValue: (row) => yesNo(row.soft_delete),
    },
    dateColumn("created_at", "Created At"),
    dateColumn("updated_at", "Updated At"),
];

const STATUS_COLORS = {
    ACTIVE: "success",
    COMPLETED: "info",
    PENDING: "warning",
    CANCELLED: "error",
    FAILED: "error",
    EXPIRED: "default",
};

function DetailItem({ label, value }) {
    return (
        <Box>
            <Typography
                variant="caption"
                sx={{
                    display: "block",
                    color: "text.secondary",
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                }}
            >
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {value || "-"}
            </Typography>
        </Box>
    );
}

function EnrollmentDetailDialog({ open, enrollment, loading, error, onClose }) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}>
                Enrollment Details
            </DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Stack alignItems="center" py={5}>
                        <CircularProgress size={28} />
                    </Stack>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : enrollment ? (
                    <Stack spacing={2.5}>
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            spacing={1}
                        >
                            <Box>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontFamily: FONT_HEADING,
                                        fontWeight: 800,
                                    }}
                                >
                                    {enrollment.course_title || "Course"}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {enrollment.enrollment_number}
                                </Typography>
                            </Box>
                            <Chip
                                label={enrollment.status || "-"}
                                color={
                                    STATUS_COLORS[enrollment.status] ||
                                    "default"
                                }
                            />
                        </Stack>

                        <Divider />

                        <Typography
                            sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
                        >
                            Student
                        </Typography>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, minmax(0, 1fr))",
                                    md: "repeat(3, minmax(0, 1fr))",
                                },
                                gap: 2,
                            }}
                        >
                            <DetailItem
                                label="Name"
                                value={enrollment.student_name}
                            />
                            <DetailItem
                                label="Email"
                                value={enrollment.student_email}
                            />
                            <DetailItem
                                label="Student Code"
                                value={enrollment.student_code}
                            />
                            <DetailItem
                                label="Register Number"
                                value={enrollment.register_number}
                            />
                            <DetailItem
                                label="Institution"
                                value={enrollment.institution_name}
                            />
                        </Box>

                        <Divider />

                        <Typography
                            sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
                        >
                            Course
                        </Typography>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, minmax(0, 1fr))",
                                    md: "repeat(3, minmax(0, 1fr))",
                                },
                                gap: 2,
                            }}
                        >
                            <DetailItem
                                label="Course"
                                value={enrollment.course_title}
                            />
                            <DetailItem
                                label="Course Code"
                                value={enrollment.course_code}
                            />
                            <DetailItem
                                label="Instructor"
                                value={enrollment.instructor_name}
                            />
                            <DetailItem
                                label="Course Type"
                                value={enrollment.course_type}
                            />
                            <DetailItem
                                label="Level"
                                value={enrollment.level}
                            />
                            <DetailItem
                                label="Price"
                                value={money(
                                    enrollment.price,
                                    enrollment.currency_code
                                )}
                            />
                        </Box>

                        <Divider />

                        <Typography
                            sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
                        >
                            Enrollment
                        </Typography>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, minmax(0, 1fr))",
                                    md: "repeat(3, minmax(0, 1fr))",
                                },
                                gap: 2,
                            }}
                        >
                            <DetailItem
                                label="Enrollment Date"
                                value={formatDate(enrollment.enrollment_date)}
                            />
                            <DetailItem
                                label="Start Date"
                                value={formatDate(enrollment.start_date)}
                            />
                            <DetailItem
                                label="Expected Completion"
                                value={formatDate(
                                    enrollment.expected_completion_date
                                )}
                            />
                            <DetailItem
                                label="Completed At"
                                value={formatDateTime(enrollment.completed_at)}
                            />
                            <DetailItem
                                label="Last Accessed"
                                value={formatDateTime(
                                    enrollment.last_accessed_at
                                )}
                            />
                            <DetailItem
                                label="Cancelled At"
                                value={formatDateTime(enrollment.cancelled_at)}
                            />
                            <DetailItem
                                label="Cancellation Reason"
                                value={enrollment.cancellation_reason}
                            />
                            <DetailItem
                                label="Deleted"
                                value={yesNo(enrollment.soft_delete)}
                            />
                            <DetailItem
                                label="Created At"
                                value={formatDateTime(enrollment.created_at)}
                            />
                            <DetailItem
                                label="Updated At"
                                value={formatDateTime(enrollment.updated_at)}
                            />
                        </Box>
                    </Stack>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

export default function AdminEnrollmentsPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [statuses, setStatuses] = useState([]);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [snackbar, setSnackbar] = useState("");

    const loadStatuses = useCallback(async () => {
        try {
            const values = await adminEnrollmentApi.getStatuses();
            setStatuses(Array.isArray(values) ? values : []);
        } catch {
            setStatuses([]);
        }
    }, []);

    const loadRows = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const firstPage = await adminEnrollmentApi.getAll({
                page: 1,
                limit: 100,
                status: status || undefined,
            });

            const totalPages = Number(firstPage.pagination?.totalPages ?? 1);
            const allRows = [...firstPage.rows];

            for (let page = 2; page <= totalPages; page += 1) {
                const nextPage = await adminEnrollmentApi.getAll({
                    page,
                    limit: 100,
                    status: status || undefined,
                });

                allRows.push(...nextPage.rows);
            }

            setRows(allRows);
        } catch (requestError) {
            setRows([]);
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        const timer = window.setTimeout(loadStatuses, 0);

        return () => window.clearTimeout(timer);
    }, [loadStatuses]);

    useEffect(() => {
        const timer = window.setTimeout(loadRows, 0);

        return () => window.clearTimeout(timer);
    }, [loadRows]);

    const handleView = useCallback(async (row) => {
        if (!row?.id) return;

        setDetailOpen(true);
        setDetail(row);
        setDetailError("");
        setDetailLoading(true);

        try {
            const data = await adminEnrollmentApi.getById(row.id);
            setDetail(data);
        } catch (requestError) {
            setDetailError(getErrorMessage(requestError));
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const handleCloseDetail = useCallback(() => {
        setDetailOpen(false);
        setDetail(null);
        setDetailError("");
        setDetailLoading(false);
    }, []);

    const handleRefresh = useCallback(() => {
        loadRows();
        setSnackbar("Enrollments refreshed.");
    }, [loadRows]);

    const filterControls = useMemo(
        () => (
            <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="enrollment-status-filter">
                    Status
                </InputLabel>
                <Select
                    labelId="enrollment-status-filter"
                    label="Status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                >
                    <MenuItem value="">All statuses</MenuItem>
                    {statuses.map((value) => (
                        <MenuItem key={value} value={value}>
                            {value}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        ),
        [status, statuses]
    );

    return (
        <Box>
            <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", md: "center" }}
                spacing={1.5}
                sx={{ mb: 2 }}
            >
                <Typography
                    variant="h5"
                    sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
                >
                    Enrollment Management
                </Typography>
                {filterControls}
            </Stack>

            <DataTable
                title="Enrollments"
                rows={rows}
                columns={COLUMNS}
                loading={loading}
                error={error}
                onRefresh={handleRefresh}
                onView={handleView}
                searchPlaceholder="Search enrollment, student, course, instructor..."
                emptyMessage="No enrollments found."
                minWidth={2900}
            />

            <EnrollmentDetailDialog
                open={detailOpen}
                enrollment={detail}
                loading={detailLoading}
                error={detailError}
                onClose={handleCloseDetail}
            />

            <Snackbar
                open={Boolean(snackbar)}
                autoHideDuration={2500}
                onClose={() => setSnackbar("")}
                message={snackbar}
            />
        </Box>
    );
}
