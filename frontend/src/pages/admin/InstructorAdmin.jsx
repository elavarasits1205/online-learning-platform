
import React, {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    Alert,
    Avatar,
    Box,
    CircularProgress,
    Divider,
    Drawer,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";

import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";

// ============================================================
// IMPORT SHARED DATATABLE
// ============================================================

import DataTable from "../../component/tables/DataTable";

// ============================================================
// IMPORT INSTRUCTOR API
// ============================================================

import {
    getAllInstructors,
    getInstructorById,
} from "../../service/instructoradminApi";

// ============================================================
// RESPONSE HELPERS
// ============================================================

const extractInstructors = (response) => {
    const payload = response?.data ?? response;

    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    return [];
};

const extractInstructor = (response) => {
    const payload = response?.data ?? response;

    return payload?.data ?? payload;
};

// ============================================================
// FORMAT DATE
// ============================================================

const formatDate = (date) => {
    if (!date) return "Not available";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "Not available";
    }

    return parsedDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

// ============================================================
// STATUS ICON
// Active   = Green Tick
// Inactive = Red Cross
// No visible status text
// ============================================================

const StatusIcon = ({ active, title = "Instructor status" }) => {
    const isActive = active === true;

    return (
        <Tooltip
            title={`${title}: ${isActive ? "Active" : "Inactive"}`}
            arrow
        >
            <Box
                component="span"
                role="img"
                aria-label={`${title}: ${isActive ? "Active" : "Inactive"}`}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    backgroundColor: isActive
                        ? "#e6f7ed"
                        : "#fdecea",
                    color: isActive
                        ? "#16834a"
                        : "#d32f2f",
                }}
            >
                {isActive ? (
                    <CheckCircleOutlineOutlinedIcon
                        sx={{ fontSize: 21 }}
                    />
                ) : (
                    <CancelOutlinedIcon
                        sx={{ fontSize: 21 }}
                    />
                )}
            </Box>
        </Tooltip>
    );
};

// ============================================================
// REUSABLE DETAIL ITEM
// ============================================================

const DetailItem = ({
    icon,
    label,
    value,
}) => {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                py: 1.5,
                minWidth: 0,
            }}
        >
            <Box
                sx={{
                    width: 34,
                    height: 34,
                    minWidth: 34,
                    borderRadius: "9px",
                    backgroundColor: "#f3f0ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6d4aff",
                }}
            >
                {icon}
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    sx={{
                        fontSize: "11px",
                        color: "#85869a",
                        fontWeight: 600,
                        mb: 0.4,
                    }}
                >
                    {label}
                </Typography>

                <Typography
                    sx={{
                        fontSize: "13px",
                        color: "#292a3d",
                        fontWeight: 600,
                        overflowWrap: "anywhere",
                    }}
                >
                    {value || "Not available"}
                </Typography>
            </Box>
        </Box>
    );
};

// ============================================================
// INSTRUCTOR ADMIN PAGE
// ============================================================

const InstructorAdmin = () => {

    // ========================================================
    // STATES
    // ========================================================

    const [instructors, setInstructors] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [selectedInstructor, setSelectedInstructor] =
        useState(null);

    const [drawerOpen, setDrawerOpen] = useState(false);

    const [detailsLoading, setDetailsLoading] =
        useState(false);

    const [detailsError, setDetailsError] =
        useState("");

    // ========================================================
    // FETCH ALL INSTRUCTORS
    // ========================================================

    const fetchInstructors = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response = await getAllInstructors();

            const payload = response?.data ?? response;

            if (payload?.success === false) {
                throw new Error(
                    payload.message ||
                    "Unable to retrieve instructors."
                );
            }

            const instructorData =
                extractInstructors(response);

            setInstructors(instructorData);

        } catch (err) {
            console.error(
                "Get All Instructors Error:",
                err
            );

            setError(
                err.response?.data?.message ||
                err.message ||
                "Failed to load instructors."
            );

            setInstructors([]);

        } finally {
            setLoading(false);
        }
    }, []);

    // ========================================================
    // INITIAL API CALL
    // ========================================================

    useEffect(() => {
        fetchInstructors();
    }, [fetchInstructors]);

    // ========================================================
    // VIEW INSTRUCTOR DETAILS
    // ========================================================

    const handleViewInstructor = async (row) => {
        if (!row?.id) return;

        try {
            setDrawerOpen(true);
            setDetailsLoading(true);
            setDetailsError("");
            setSelectedInstructor(row);

            const response = await getInstructorById(
                String(row.id)
            );

            const payload = response?.data ?? response;

            if (payload?.success === false) {
                throw new Error(
                    payload.message ||
                    "Unable to retrieve instructor details."
                );
            }

            const instructor =
                extractInstructor(response);

            if (!instructor || !instructor.id) {
                throw new Error(
                    "Instructor details not found."
                );
            }

            setSelectedInstructor(instructor);

        } catch (err) {
            console.error(
                "Get Instructor Details Error:",
                err
            );

            setDetailsError(
                err.response?.data?.message ||
                err.message ||
                "Failed to retrieve instructor details."
            );

        } finally {
            setDetailsLoading(false);
        }
    };

    // ========================================================
    // CLOSE DRAWER
    // ========================================================

    const handleCloseDrawer = () => {
        setDrawerOpen(false);
        setSelectedInstructor(null);
        setDetailsError("");
    };

    // ========================================================
    // TABLE COLUMNS
    // ========================================================

    const columns = [
        {
            field: "instructor_code",
            headerName: "Instructor Code",
            minWidth: 145,
            flex: 1,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#6d4aff",
                    }}
                >
                    {row.instructor_code || "-"}
                </Typography>
            ),
        },

        {
            field: "first_name",
            headerName: "Instructor Name",
            minWidth: 190,
            flex: 1.4,

            renderCell: (row) => (
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.2}
                >
                    <Avatar
                        src={row.profile_image_url || undefined}
                        sx={{
                            width: 32,
                            height: 32,
                            fontSize: "12px",
                            bgcolor: "#6d4aff",
                        }}
                    >
                        {row.first_name?.charAt(0)?.toUpperCase() || "I"}
                    </Avatar>

                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            sx={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#292a3d",
                            }}
                        >
                            {[
                                row.first_name,
                                row.last_name,
                            ]
                                .filter(Boolean)
                                .join(" ") || "-"}
                        </Typography>

                        <Typography
                            sx={{
                                fontSize: "10px",
                                color: "#85869a",
                            }}
                        >
                            {row.designation || "Instructor"}
                        </Typography>
                    </Box>
                </Stack>
            ),
        },

        {
            field: "email",
            headerName: "Email",
            minWidth: 210,
            flex: 1.5,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#55566b",
                        overflowWrap: "anywhere",
                    }}
                >
                    {row.email || "-"}
                </Typography>
            ),
        },

        {
            field: "phone_number",
            headerName: "Phone Number",
            minWidth: 135,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#55566b",
                    }}
                >
                    {row.phone_number || "-"}
                </Typography>
            ),
        },

        {
            field: "qualification",
            headerName: "Qualification",
            minWidth: 145,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#55566b",
                    }}
                >
                    {row.qualification || "-"}
                </Typography>
            ),
        },

        {
            field: "specialization",
            headerName: "Specialization",
            minWidth: 150,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#55566b",
                    }}
                >
                    {row.specialization || "-"}
                </Typography>
            ),
        },

        {
            field: "experience_years",
            headerName: "Experience",
            minWidth: 110,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#55566b",
                    }}
                >
                    {row.experience_years != null
                        ? `${row.experience_years} Years`
                        : "-"}
                </Typography>
            ),
        },

        // ====================================================
        // STATUS COLUMN - ICON ONLY
        // ====================================================

        {
            field: "is_active",
            headerName: "Status",
            minWidth: 90,
            align: "center",

            renderCell: (row) => (
                <StatusIcon
                    active={row.is_active}
                    title="Instructor status"
                />
            ),

            // Keep meaningful values in exported files.
            exportValue: (row) =>
                row.is_active === true
                    ? "Active"
                    : "Inactive",
        },
    ];

    // ========================================================
    // SELECTED INSTRUCTOR DETAILS
    // ========================================================

    const instructor = selectedInstructor;

    const fullName = [
        instructor?.first_name,
        instructor?.last_name,
    ]
        .filter(Boolean)
        .join(" ");

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <Box
            sx={{
                width: "100%",
                minHeight: "100%",
                p: { xs: 1.5, sm: 2.5 },
                backgroundColor: "#f8f9fc",
            }}
        >

            {/* =================================================
                PAGE HEADER
            ================================================= */}

            <Box sx={{ mb: 2.5 }}>
                <Typography
                    sx={{
                        fontSize: {
                            xs: "19px",
                            sm: "22px",
                        },
                        fontWeight: 800,
                        color: "#292a3d",
                    }}
                >
                    Instructor Management
                </Typography>

                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#85869a",
                        mt: 0.5,
                    }}
                >
                    View and manage instructor information
                    in your learning platform.
                </Typography>
            </Box>

            {/* =================================================
                ERROR MESSAGE
            ================================================= */}

            {error && (
                <Alert
                    severity="error"
                    sx={{
                        mb: 2,
                        fontSize: "12px",
                    }}
                    action={
                        <Tooltip title="Retry">
                            <IconButton
                                size="small"
                                onClick={fetchInstructors}
                                color="inherit"
                            >
                                <Typography
                                    sx={{ fontSize: "11px" }}
                                >
                                    Retry
                                </Typography>
                            </IconButton>
                        </Tooltip>
                    }
                >
                    {error}
                </Alert>
            )}

            {/* =================================================
                SHARED DATATABLE
            ================================================= */}

            <DataTable
                title="Instructors"
                rows={instructors}
                columns={columns}
                loading={loading}
                error={error}
                getRowId={(row) => String(row.id)}
                onRefresh={fetchInstructors}
                onView={handleViewInstructor}
                searchPlaceholder="Search instructors..."
                emptyMessage="No instructors found."
                minWidth={1200}
                initialRowsPerPage={10}
                rowsPerPageOptions={[10, 25, 50, 100]}
                pagination={true}
            />

            {/* =================================================
                INSTRUCTOR DETAILS DRAWER
            ================================================= */}

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={handleCloseDrawer}
                PaperProps={{
                    sx: {
                        width: {
                            xs: "100%",
                            sm: 480,
                        },
                        maxWidth: "100%",
                        backgroundColor: "#f8f9fc",
                    },
                }}
            >

                {/* DRAWER HEADER */}

                <Box
                    sx={{
                        px: 2.5,
                        py: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#ffffff",
                        borderBottom: "1px solid #ececf2",
                    }}
                >
                    <Box>
                        <Typography
                            sx={{
                                fontSize: "16px",
                                fontWeight: 800,
                                color: "#292a3d",
                            }}
                        >
                            Instructor Details
                        </Typography>

                        <Typography
                            sx={{
                                fontSize: "11px",
                                color: "#85869a",
                                mt: 0.3,
                            }}
                        >
                            Instructor profile information
                        </Typography>
                    </Box>

                    <Tooltip title="Close">
                        <IconButton
                            onClick={handleCloseDrawer}
                            size="small"
                        >
                            <CloseOutlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* DRAWER CONTENT */}

                <Box
                    sx={{
                        p: 2.5,
                        overflowY: "auto",
                    }}
                >

                    {detailsLoading ? (
                        <Box
                            sx={{
                                minHeight: 250,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CircularProgress
                                size={30}
                                sx={{ color: "#6d4aff" }}
                            />
                        </Box>
                    ) : detailsError ? (
                        <Alert severity="error">
                            {detailsError}
                        </Alert>
                    ) : instructor ? (
                        <Stack spacing={2.5}>

                            {/* PROFILE CARD */}

                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2.5,
                                    border: "1px solid #ececf2",
                                    borderRadius: "12px",
                                    textAlign: "center",
                                }}
                            >
                                <Avatar
                                    src={
                                        instructor.profile_image_url ||
                                        undefined
                                    }
                                    sx={{
                                        width: 76,
                                        height: 76,
                                        mx: "auto",
                                        mb: 1.5,
                                        fontSize: "25px",
                                        bgcolor: "#6d4aff",
                                    }}
                                >
                                    {instructor.first_name
                                        ?.charAt(0)
                                        ?.toUpperCase() || "I"}
                                </Avatar>

                                <Typography
                                    sx={{
                                        fontSize: "17px",
                                        fontWeight: 800,
                                        color: "#292a3d",
                                    }}
                                >
                                    {fullName || "Instructor"}
                                </Typography>

                                <Typography
                                    sx={{
                                        fontSize: "12px",
                                        color: "#85869a",
                                        mt: 0.5,
                                    }}
                                >
                                    {instructor.designation ||
                                        "Instructor"}
                                </Typography>

                                <Typography
                                    sx={{
                                        fontSize: "11px",
                                        color: "#6d4aff",
                                        fontWeight: 700,
                                        mt: 1,
                                    }}
                                >
                                    {instructor.instructor_code || "-"}
                                </Typography>

                                {/* ICON ONLY STATUS */}

                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        mt: 1.5,
                                    }}
                                >
                                    <StatusIcon
                                        active={instructor.is_active}
                                        title="Instructor status"
                                    />
                                </Box>
                            </Paper>

                            {/* CONTACT INFORMATION */}

                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2,
                                    border: "1px solid #ececf2",
                                    borderRadius: "12px",
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: "13px",
                                        fontWeight: 800,
                                        color: "#292a3d",
                                        mb: 1,
                                    }}
                                >
                                    Contact Information
                                </Typography>

                                <Divider />

                                <DetailItem
                                    icon={
                                        <EmailOutlinedIcon fontSize="small" />
                                    }
                                    label="Email Address"
                                    value={instructor.email}
                                />

                                <Divider />

                                <DetailItem
                                    icon={
                                        <PhoneOutlinedIcon fontSize="small" />
                                    }
                                    label="Phone Number"
                                    value={instructor.phone_number}
                                />
                            </Paper>

                            {/* PROFESSIONAL INFORMATION */}

                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2,
                                    border: "1px solid #ececf2",
                                    borderRadius: "12px",
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: "13px",
                                        fontWeight: 800,
                                        color: "#292a3d",
                                        mb: 1,
                                    }}
                                >
                                    Professional Information
                                </Typography>

                                <Divider />

                                <DetailItem
                                    icon={
                                        <SchoolOutlinedIcon fontSize="small" />
                                    }
                                    label="Qualification"
                                    value={instructor.qualification}
                                />

                                <Divider />

                                <DetailItem
                                    icon={
                                        <WorkOutlineOutlinedIcon fontSize="small" />
                                    }
                                    label="Specialization"
                                    value={instructor.specialization}
                                />

                                <Divider />

                                <DetailItem
                                    icon={
                                        <BadgeOutlinedIcon fontSize="small" />
                                    }
                                    label="Designation"
                                    value={instructor.designation}
                                />

                                <Divider />

                                <DetailItem
                                    icon={
                                        <PersonOutlineOutlinedIcon fontSize="small" />
                                    }
                                    label="Experience"
                                    value={
                                        instructor.experience_years != null
                                            ? `${instructor.experience_years} Years`
                                            : null
                                    }
                                />

                                <Divider />

                                <DetailItem
                                    icon={
                                        <CalendarMonthOutlinedIcon fontSize="small" />
                                    }
                                    label="Joined Date"
                                    value={formatDate(
                                        instructor.joined_at
                                    )}
                                />
                            </Paper>

                            {/* BIO */}

                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2,
                                    border: "1px solid #ececf2",
                                    borderRadius: "12px",
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: "13px",
                                        fontWeight: 800,
                                        color: "#292a3d",
                                        mb: 1,
                                    }}
                                >
                                    About Instructor
                                </Typography>

                                <Divider />

                                <Typography
                                    sx={{
                                        fontSize: "12px",
                                        color: "#626378",
                                        lineHeight: 1.8,
                                        mt: 1.5,
                                        whiteSpace: "pre-wrap",
                                        overflowWrap: "anywhere",
                                    }}
                                >
                                    {instructor.bio ||
                                        "No biography available."}
                                </Typography>
                            </Paper>

                        </Stack>
                    ) : null}

                </Box>
            </Drawer>

        </Box>
    );
};

export default InstructorAdmin;
