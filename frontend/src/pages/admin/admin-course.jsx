
 // src/pages/admin/admin-course.jsx

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Paper,
    Snackbar,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";

import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";

import DataTable from "../../component/tables/DataTable";
import courseApi from "../../service/courseApi";

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString();
};

const formatPrice = (value, currencyCode = "INR") => {
    if (value === null || value === undefined || value === "") {
        return "-";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) return String(value);

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currencyCode || "INR",
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currencyCode || "INR"} ${amount.toFixed(2)}`;
    }
};

const getStatusColor = (status) => {
    switch (String(status || "").toUpperCase()) {
        case "APPROVED":
        case "PUBLISHED":
        case "ACTIVE":
            return "success";

        case "PENDING":
            return "warning";

        case "REJECTED":
        case "ARCHIVED":
        case "INACTIVE":
            return "error";

        case "DRAFT":
        case "NOT_SUBMITTED":
            return "default";

        default:
            return "info";
    }
};

const getErrorText = (error) =>
    error?.message || "Unable to complete the request.";

const isPendingCourse = (course) =>
    String(course?.approval_status || "").toUpperCase() === "PENDING" &&
    String(course?.status || "").toUpperCase() === "DRAFT";

// ---------------------------------------------------------
// Small reusable display helpers
// ---------------------------------------------------------

function StatusChip({ value }) {
    const text = String(value || "UNKNOWN").replaceAll("_", " ");

    return (
        <Chip
            size="small"
            label={text}
            color={getStatusColor(value)}
            variant={
                ["DRAFT", "NOT_SUBMITTED", "UNKNOWN"].includes(
                    String(value || "").toUpperCase()
                )
                    ? "outlined"
                    : "filled"
            }
            sx={{
                fontWeight: 700,
                fontSize: 11,
                textTransform: "capitalize",
            }}
        />
    );
}

function DetailItem({ label, value }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography
                variant="caption"
                sx={{
                    display: "block",
                    color: "text.secondary",
                    mb: 0.4,
                }}
            >
                {label}
            </Typography>

            <Typography
                variant="body2"
                sx={{
                    fontWeight: 600,
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-wrap",
                }}
            >
                {value === null ||
                value === undefined ||
                value === ""
                    ? "-"
                    : String(value)}
            </Typography>
        </Box>
    );
}

// ---------------------------------------------------------
// Admin Course Page
// ---------------------------------------------------------

export default function AdminCoursePage({ initialTab = 0 }) {
    const [activeTab, setActiveTab] = useState(initialTab);

    const [allCourses, setAllCourses] = useState([]);
    const [pendingCourses, setPendingCourses] = useState([]);

    const [loading, setLoading] = useState(false);
    const [pageError, setPageError] = useState("");

    const [selectedCourse, setSelectedCourse] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectCourseTarget, setRejectCourseTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectError, setRejectError] = useState("");

    const [actionLoading, setActionLoading] = useState(false);

    const [notice, setNotice] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const showNotice = useCallback((message, severity = "success") => {
        setNotice({
            open: true,
            message,
            severity,
        });
    }, []);

    // -----------------------------------------------------
    // Load course list
    // -----------------------------------------------------

    const loadCourses = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            if (activeTab === 0) {
                const courses = await courseApi.getAllCourses();
                setAllCourses(courses);
            } else {
                const courses = await courseApi.getPendingCourses();
                setPendingCourses(courses);
            }
        } catch (error) {
            setPageError(getErrorText(error));
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadCourses();
    }, [loadCourses]);

    const rows = activeTab === 0 ? allCourses : pendingCourses;

    // -----------------------------------------------------
    // View course and review bundle
    // -----------------------------------------------------

    const handleView = useCallback(async (course) => {
        if (!course?.id) {
            showNotice("The selected course has no valid ID.", "error");
            return;
        }

        setSelectedCourse(course);
        setDetailsOpen(true);
        setDetailsError("");
        setDetailsLoading(false);

        // The backend review-bundle service intentionally accepts
        // only courses awaiting approval. For other statuses, show
        // the summary fields already returned by the list endpoint.
        if (!isPendingCourse(course)) {
            return;
        }

        setDetailsLoading(true);

        try {
            const bundle = await courseApi.getReviewBundle(course.id);

            setSelectedCourse(
                bundle && typeof bundle === "object"
                    ? bundle
                    : course
            );
        } catch (error) {
            setDetailsError(getErrorText(error));
        } finally {
            setDetailsLoading(false);
        }
    }, [showNotice]);

    const closeDetails = () => {
        if (detailsLoading) return;

        setDetailsOpen(false);
        setDetailsError("");
    };

    // -----------------------------------------------------
    // Approve course
    // -----------------------------------------------------

    const handleApprove = useCallback(async (course) => {
        if (!course?.id) {
            showNotice("The selected course has no valid ID.", "error");
            return;
        }

        if (!isPendingCourse(course)) {
            showNotice(
                "Only pending draft courses can be approved.",
                "warning"
            );
            return;
        }

        const confirmed = window.confirm(
            `Approve and publish "${course.title || "this course"}"?`
        );

        if (!confirmed) return;

        setActionLoading(true);
        setPageError("");

        try {
            const result = await courseApi.approveCourse(course.id);

            showNotice(
                result?.message ||
                    `"${course.title || "Course"}" approved and published successfully.`
            );

            await loadCourses();
            window.dispatchEvent(new Event("admin-pending-approvals-changed"));
        } catch (error) {
            showNotice(getErrorText(error), "error");
        } finally {
            setActionLoading(false);
        }
    }, [loadCourses, showNotice]);

    // -----------------------------------------------------
    // Open reject dialog
    // -----------------------------------------------------

    const openRejectDialog = (course) => {
        if (!course?.id) {
            showNotice("The selected course has no valid ID.", "error");
            return;
        }

        if (!isPendingCourse(course)) {
            showNotice(
                "Only pending draft courses can be rejected.",
                "warning"
            );
            return;
        }

        setRejectCourseTarget(course);
        setRejectReason("");
        setRejectError("");
        setRejectOpen(true);
    };

    const closeRejectDialog = () => {
        if (actionLoading) return;

        setRejectOpen(false);
        setRejectCourseTarget(null);
        setRejectReason("");
        setRejectError("");
    };

    // -----------------------------------------------------
    // Submit rejection
    // -----------------------------------------------------

    const handleReject = async () => {
        const reason = rejectReason.trim();

        if (!reason) {
            setRejectError("Please enter a rejection reason.");
            return;
        }

        if (reason.length > 5000) {
            setRejectError(
                "The rejection reason cannot exceed 5000 characters."
            );
            return;
        }

        if (!rejectCourseTarget?.id) {
            setRejectError("The selected course ID is invalid.");
            return;
        }

        setActionLoading(true);
        setRejectError("");

        try {
            const result = await courseApi.rejectCourse(
                rejectCourseTarget.id,
                reason
            );

            setRejectOpen(false);
            setRejectCourseTarget(null);
            setRejectReason("");

            showNotice(
                result?.message ||
                    "Course rejected successfully."
            );

            await loadCourses();
            window.dispatchEvent(new Event("admin-pending-approvals-changed"));
        } catch (error) {
            setRejectError(getErrorText(error));
        } finally {
            setActionLoading(false);
        }
    };

    // -----------------------------------------------------
    // Table columns
    // -----------------------------------------------------

    const columns = useMemo(() => {
        const baseColumns = [
            {
                field: "course_code",
                headerName: "Course Code",
                minWidth: 130,
                valueGetter: (row) => row.course_code || "-",
            },
            {
                field: "title",
                headerName: "Course Title",
                minWidth: 220,
                maxWidth: 360,
                nowrap: false,
                valueGetter: (row) => row.title || "-",
                render: (value) => (
                    <Typography
                        variant="body2"
                        sx={{
                            minWidth: 180,
                            maxWidth: 340,
                            fontWeight: 650,
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {value || "-"}
                    </Typography>
                ),
            },
            {
                field: "category_name",
                headerName: "Category",
                minWidth: 150,
                nowrap: false,
                valueGetter: (row) => row.category_name || "-",
            },
            {
                field: "course_type",
                headerName: "Type",
                minWidth: 100,
                valueGetter: (row) => row.course_type || "-",
                render: (value) => (
                    <Chip
                        size="small"
                        label={value || "-"}
                        variant="outlined"
                    />
                ),
            },
            {
                field: "price",
                headerName: "Price",
                minWidth: 120,
                valueGetter: (row) =>
                    formatPrice(row.price, row.currency_code),
            },
            {
                field: "status",
                headerName: "Course Status",
                minWidth: 130,
                valueGetter: (row) => row.status || "-",
                render: (value) => <StatusChip value={value} />,
            },
            {
                field: "approval_status",
                headerName: "Approval",
                minWidth: 140,
                valueGetter: (row) => row.approval_status || "-",
                render: (value) => <StatusChip value={value} />,
            },
            {
                field: "submitted_at",
                headerName: "Submitted At",
                minWidth: 170,
                valueGetter: (row) => formatDate(row.submitted_at),
            },
        ];

        if (activeTab === 1) {
            baseColumns.push({
                field: "__review_actions",
                headerName: "Review",
                minWidth: 210,
                exportable: false,
                searchable: false,
                render: (_value, row) => (
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={
                                <CheckCircleOutlineOutlinedIcon />
                            }
                            disabled={actionLoading || !isPendingCourse(row)}
                            onClick={() => handleApprove(row)}
                            sx={{
                                textTransform: "none",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Approve
                        </Button>

                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<CancelOutlinedIcon />}
                            disabled={actionLoading || !isPendingCourse(row)}
                            onClick={() => openRejectDialog(row)}
                            sx={{
                                textTransform: "none",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Reject
                        </Button>
                    </Stack>
                ),
            });
        }

        return baseColumns;
    }, [activeTab, actionLoading, handleApprove]);

    // -----------------------------------------------------
    // Render
    // -----------------------------------------------------

    return (
        <Box sx={{ width: "100%", minWidth: 0, p: { xs: 1, sm: 2, md: 3 } }}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    alignItems: { xs: "stretch", sm: "center" },
                    justifyContent: "space-between",
                    mb: 2.5,
                }}
            >
                <Box>
                    <Typography
                        variant="h5"
                        sx={{ fontWeight: 800, mb: 0.5 }}
                    >
                        Course Management
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        Review instructor submissions and manage course
                        publication.
                    </Typography>
                </Box>

                
            </Stack>

            <Paper
                variant="outlined"
                sx={{
                    borderRadius: 3,
                    overflow: "hidden",
                    backgroundColor: "background.paper",
                }}
            >
                <Tabs
                    value={activeTab}
                    onChange={(_event, nextValue) => {
                        setActiveTab(nextValue);
                        setPageError("");
                    }}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        px: 2,
                        borderBottom: 1,
                        borderColor: "divider",
                        "& .MuiTab-root": {
                            minHeight: 58,
                            textTransform: "none",
                            fontWeight: 700,
                        },
                    }}
                >
                    <Tab
                        label={`All Courses (${allCourses.length})`}
                        id="course-tab-all"
                        aria-controls="course-panel"
                    />

                    <Tab
                        label={`Pending Approval (${pendingCourses.length})`}
                        id="course-tab-pending"
                        aria-controls="course-panel"
                    />
                </Tabs>

                <Box
                    role="tabpanel"
                    id="course-panel"
                    aria-labelledby={
                        activeTab === 0
                            ? "course-tab-all"
                            : "course-tab-pending"
                    }
                    sx={{ p: { xs: 1.5, sm: 2.5 } }}
                >
                    {pageError && (
                        <Alert
                            severity="error"
                            sx={{ mb: 2 }}
                            action={
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={loadCourses}
                                >
                                    Retry
                                </Button>
                            }
                        >
                            {pageError}
                        </Alert>
                    )}

                    <DataTable
                        title={
                            activeTab === 0
                                ? "All Courses"
                                : "Courses Awaiting Approval"
                        }
                        rows={rows}
                        columns={columns}
                        loading={loading}
                        error={null}
                        getRowId={(row) => String(row.id)}
                        onRefresh={loadCourses}
                        onView={handleView}
                        searchPlaceholder="Search by title, code, category, or status..."
                        emptyMessage={
                            activeTab === 0
                                ? "No courses found."
                                : "No courses are waiting for approval."
                        }
                        minWidth={1250}
                        initialRowsPerPage={10}
                        rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    />
                </Box>
            </Paper>

            {/* -------------------------------------------------
                Course details dialog
            -------------------------------------------------- */}

            <Dialog
                open={detailsOpen}
                onClose={closeDetails}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle sx={{ fontWeight: 800 }}>
                    Course Details
                </DialogTitle>

                <DialogContent dividers>
                    {detailsLoading ? (
                        <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{
                                py: 5,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <CircularProgress size={24} />
                            <Typography variant="body2">
                                Loading course details...
                            </Typography>
                        </Stack>
                    ) : (
                        <>
                            {detailsError && (
                                <Alert
                                    severity="error"
                                    sx={{ mb: 2 }}
                                >
                                    {detailsError}
                                </Alert>
                            )}

                            {selectedCourse && (
                                <Stack spacing={2.5}>
                                    <Box>
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                fontWeight: 800,
                                                overflowWrap: "anywhere",
                                            }}
                                        >
                                            {selectedCourse.title || "Untitled Course"}
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.5 }}
                                        >
                                            {selectedCourse.course_code || "-"}
                                        </Typography>
                                    </Box>

                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        useFlexGap
                                        flexWrap="wrap"
                                    >
                                        <StatusChip
                                            value={selectedCourse.status}
                                        />
                                        <StatusChip
                                            value={selectedCourse.approval_status}
                                        />
                                        {selectedCourse.course_type && (
                                            <Chip
                                                size="small"
                                                label={selectedCourse.course_type}
                                                variant="outlined"
                                            />
                                        )}
                                    </Stack>

                                    <Divider />

                                    <Box
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns: {
                                                xs: "1fr",
                                                sm: "repeat(2, minmax(0, 1fr))",
                                            },
                                            gap: 2.5,
                                        }}
                                    >
                                        <DetailItem
                                            label="Category"
                                            value={selectedCourse.category_name}
                                        />

                                        <DetailItem
                                            label="Price"
                                            value={formatPrice(
                                                selectedCourse.price,
                                                selectedCourse.currency_code
                                            )}
                                        />

                                        <DetailItem
                                            label="Level"
                                            value={selectedCourse.level}
                                        />

                                        <DetailItem
                                            label="Language"
                                            value={selectedCourse.language_code}
                                        />

                                        <DetailItem
                                            label="Duration (minutes)"
                                            value={selectedCourse.duration_minutes}
                                        />

                                        <DetailItem
                                            label="Maximum Students"
                                            value={selectedCourse.max_students}
                                        />

                                        <DetailItem
                                            label="Submitted At"
                                            value={formatDate(
                                                selectedCourse.submitted_at
                                            )}
                                        />

                                        <DetailItem
                                            label="Published At"
                                            value={formatDate(
                                                selectedCourse.published_at
                                            )}
                                        />

                                        <DetailItem
                                            label="Reviewed At"
                                            value={formatDate(
                                                selectedCourse.reviewed_at
                                            )}
                                        />

                                        <DetailItem
                                            label="Rejection Reason"
                                            value={selectedCourse.rejection_reason}
                                        />
                                    </Box>

                                    <Divider />

                                    <Box>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{ fontWeight: 800, mb: 1 }}
                                        >
                                            Short Description
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            sx={{
                                                whiteSpace: "pre-wrap",
                                                overflowWrap: "anywhere",
                                            }}
                                        >
                                            {selectedCourse.short_description || "-"}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{ fontWeight: 800, mb: 1 }}
                                        >
                                            Description
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            sx={{
                                                whiteSpace: "pre-wrap",
                                                overflowWrap: "anywhere",
                                            }}
                                        >
                                            {selectedCourse.description || "-"}
                                        </Typography>
                                    </Box>

                                    <Divider />

                                    <Box>
                                        <Typography
                                            variant="h6"
                                            sx={{ fontWeight: 800, mb: 1.5 }}
                                        >
                                            Course Modules and Lessons
                                        </Typography>

                                        {Array.isArray(selectedCourse.modules) &&
                                        selectedCourse.modules.length > 0 ? (
                                            <Stack spacing={2}>
                                                {selectedCourse.modules.map(
                                                    (module, moduleIndex) => (
                                                        <Paper
                                                            key={String(
                                                                module.id ??
                                                                    moduleIndex
                                                            )}
                                                            variant="outlined"
                                                            sx={{
                                                                p: 2,
                                                                borderRadius: 2,
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="subtitle1"
                                                                sx={{
                                                                    fontWeight: 750,
                                                                    overflowWrap:
                                                                        "anywhere",
                                                                }}
                                                            >
                                                                {module.title ||
                                                                    module.name ||
                                                                    `Module ${moduleIndex + 1}`}
                                                            </Typography>

                                                            {module.description && (
                                                                <Typography
                                                                    variant="body2"
                                                                    color="text.secondary"
                                                                    sx={{ mt: 0.5 }}
                                                                >
                                                                    {module.description}
                                                                </Typography>
                                                            )}

                                                            {Array.isArray(
                                                                module.lessons
                                                            ) &&
                                                            module.lessons.length > 0 ? (
                                                                <Stack
                                                                    spacing={1}
                                                                    sx={{ mt: 1.5 }}
                                                                >
                                                                    {module.lessons.map(
                                                                        (
                                                                            lesson,
                                                                            lessonIndex
                                                                        ) => (
                                                                            <Box
                                                                                key={String(
                                                                                    lesson.id ??
                                                                                        lessonIndex
                                                                                )}
                                                                                sx={{
                                                                                    pl: 1.5,
                                                                                    borderLeft:
                                                                                        "3px solid",
                                                                                    borderColor:
                                                                                        "divider",
                                                                                }}
                                                                            >
                                                                                <Typography
                                                                                    variant="body2"
                                                                                    sx={{
                                                                                        fontWeight: 650,
                                                                                    }}
                                                                                >
                                                                                    {lesson.title ||
                                                                                        lesson.name ||
                                                                                        `Lesson ${lessonIndex + 1}`}
                                                                                </Typography>

                                                                                {lesson.description && (
                                                                                    <Typography
                                                                                        variant="caption"
                                                                                        color="text.secondary"
                                                                                    >
                                                                                        {lesson.description}
                                                                                    </Typography>
                                                                                )}
                                                                            </Box>
                                                                        )
                                                                    )}
                                                                </Stack>
                                                            ) : (
                                                                <Typography
                                                                    variant="body2"
                                                                    color="text.secondary"
                                                                    sx={{ mt: 1 }}
                                                                >
                                                                    No lessons found for this module.
                                                                </Typography>
                                                            )}
                                                        </Paper>
                                                    )
                                                )}
                                            </Stack>
                                        ) : (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {isPendingCourse(selectedCourse) &&
                                                !detailsError
                                                    ? "This course has no modules."
                                                    : "Module and lesson details are available from the review endpoint for pending courses only."}
                                            </Typography>
                                        )}
                                    </Box>
                                </Stack>
                            )}
                        </>
                    )}
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    {selectedCourse &&
                        isPendingCourse(selectedCourse) && (
                            <>
                                <Button
                                    color="error"
                                    variant="outlined"
                                    disabled={actionLoading || detailsLoading}
                                    onClick={() => {
                                        setDetailsOpen(false);
                                        openRejectDialog(selectedCourse);
                                    }}
                                >
                                    Reject
                                </Button>

                                <Button
                                    color="success"
                                    variant="contained"
                                    disabled={actionLoading || detailsLoading}
                                    onClick={async () => {
                                        setDetailsOpen(false);
                                        await handleApprove(selectedCourse);
                                    }}
                                >
                                    Approve and Publish
                                </Button>
                            </>
                        )}

                    <Button onClick={closeDetails} disabled={detailsLoading}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* -------------------------------------------------
                Reject course dialog
            -------------------------------------------------- */}

            <Dialog
                open={rejectOpen}
                onClose={closeRejectDialog}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle sx={{ fontWeight: 800 }}>
                    Reject Course
                </DialogTitle>

                <DialogContent>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2, mt: 0.5 }}
                    >
                        Provide a reason so the instructor understands what
                        needs to be corrected.
                    </Typography>

                    {rejectCourseTarget && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Course: {rejectCourseTarget.title || "Untitled Course"}
                        </Alert>
                    )}

                    <TextField
                        fullWidth
                        required
                        multiline
                        minRows={4}
                        maxRows={10}
                        label="Rejection reason"
                        placeholder="Explain why this course cannot be approved..."
                        value={rejectReason}
                        onChange={(event) => {
                            setRejectReason(event.target.value);
                            if (rejectError) setRejectError("");
                        }}
                        error={Boolean(rejectError)}
                        helperText={
                            rejectError ||
                            `${rejectReason.length}/5000 characters`
                        }
                        inputProps={{ maxLength: 5000 }}
                    />
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    <Button
                        onClick={closeRejectDialog}
                        disabled={actionLoading}
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleReject}
                        disabled={actionLoading}
                        startIcon={
                            actionLoading ? (
                                <CircularProgress
                                    size={16}
                                    color="inherit"
                                />
                            ) : (
                                <CancelOutlinedIcon />
                            )
                        }
                    >
                        {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* -------------------------------------------------
                Notifications
            -------------------------------------------------- */}

            <Snackbar
                open={notice.open}
                autoHideDuration={5000}
                onClose={(_event, reason) => {
                    if (reason === "clickaway") return;

                    setNotice((current) => ({
                        ...current,
                        open: false,
                    }));
                }}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
            >
                <Alert
                    severity={notice.severity}
                    variant="filled"
                    onClose={() =>
                        setNotice((current) => ({
                            ...current,
                            open: false,
                        }))
                    }
                    sx={{ width: "100%" }}
                >
                    {notice.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
