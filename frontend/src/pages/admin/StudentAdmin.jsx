
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

// Material UI icons
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";

// Shared DataTable
import DataTable from "../../component/tables/DataTable";

// Student API
import {
    getAllStudents,
    getStudentById,
} from "../../service/studentservice";

// ============================================================
// RESPONSE HELPERS
// ============================================================

const getPayload = (response) => response?.data ?? response;

const extractStudents = (response) => {
    const payload = getPayload(response);

    if (payload?.success === false) {
        throw new Error(
            payload.message || "Unable to retrieve students."
        );
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload)) {
        return payload;
    }

    return [];
};

const extractStudent = (response) => {
    const payload = getPayload(response);

    if (payload?.success === false) {
        throw new Error(
            payload.message || "Unable to retrieve student details."
        );
    }

    return payload?.data?.data ?? payload?.data ?? payload;
};

// ============================================================
// DATE FORMATTERS
// ============================================================

const formatDate = (date) => {
    if (!date) return "Not available";

    if (
        typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        const [year, month, day] = date.split("-");
        return `${day}-${month}-${year}`;
    }

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

const formatDateTime = (date) => {
    if (!date) return "Not available";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "Not available";
    }

    return parsedDate.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const displayValue = (value) => {
    if (value === null || value === undefined || value === "") {
        return "Not available";
    }

    return String(value);
};

// ============================================================
// STATUS ICON ONLY
// ============================================================

const StatusIcon = ({ active, label }) => {
    const isActive = active === true;

    return (
        <Tooltip title={label || (isActive ? "Active" : "Inactive")}>
            <Box
                component="span"
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    verticalAlign: "middle",
                }}
            >
                {isActive ? (
                    <CheckCircleOutlineOutlinedIcon
                        sx={{
                            color: "#16834a",
                            fontSize: 21,
                        }}
                    />
                ) : (
                    <CancelOutlinedIcon
                        sx={{
                            color: "#c0392b",
                            fontSize: 21,
                        }}
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
}) => (
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
                    whiteSpace: "pre-wrap",
                }}
            >
                {displayValue(value)}
            </Typography>
        </Box>
    </Box>
);

// ============================================================
// DETAIL SECTION
// ============================================================

const DetailSection = ({ title, children }) => (
    <Paper
        elevation={0}
        sx={{
            p: 2,
            border: "1px solid #ececf2",
            borderRadius: "12px",
            backgroundColor: "#ffffff",
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
            {title}
        </Typography>

        <Divider />

        {children}
    </Paper>
);

// ============================================================
// STUDENT ADMIN PAGE
// ============================================================

const StudentAdmin = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    // ========================================================
    // FETCH ALL STUDENTS
    // ========================================================

    const fetchStudents = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response = await getAllStudents();
            const studentData = extractStudents(response);

            setStudents(studentData);
        } catch (err) {
            console.error("Get All Students Error:", err);

            setError(
                err.response?.data?.message ||
                err.message ||
                "Failed to load students."
            );

            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // ========================================================
    // INITIAL LOAD
    // ========================================================

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    // ========================================================
    // VIEW STUDENT DETAILS
    // ========================================================

    const handleViewStudent = async (row) => {
        if (!row?.id) return;

        try {
            setDrawerOpen(true);
            setDetailsLoading(true);
            setDetailsError("");
            setSelectedStudent(row);

            const response = await getStudentById(String(row.id));
            const student = extractStudent(response);

            if (!student || !student.id) {
                throw new Error("Student details not found.");
            }

            setSelectedStudent(student);
        } catch (err) {
            console.error("Get Student Details Error:", err);

            setDetailsError(
                err.response?.data?.message ||
                err.message ||
                "Failed to retrieve student details."
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
        setSelectedStudent(null);
        setDetailsError("");
    };

    // ========================================================
    // TABLE COLUMNS
    // ========================================================

    const columns = [
        {
            field: "student_code",
            headerName: "Student Code",
            minWidth: 135,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#6d4aff",
                    }}
                >
                    {row.student_code || "-"}
                </Typography>
            ),
        },

        {
            field: "user_name",
            headerName: "Student Name",
            minWidth: 190,

            renderCell: (row) => (
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.2}
                >
                    <Avatar
                        src={row.profile_image_url || undefined}
                        sx={{
                            width: 34,
                            height: 34,
                            fontSize: "12px",
                            fontWeight: 700,
                            bgcolor: "#6d4aff",
                        }}
                    >
                        {row.user_name?.charAt(0)?.toUpperCase() || "S"}
                    </Avatar>

                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            sx={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#292a3d",
                            }}
                        >
                            {row.user_name || "-"}
                        </Typography>

                        <Typography
                            sx={{
                                fontSize: "10px",
                                color: "#85869a",
                            }}
                        >
                            {row.username || "-"}
                        </Typography>
                    </Box>
                </Stack>
            ),
        },

        {
            field: "email",
            headerName: "Email",
            minWidth: 210,

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
            field: "register_number",
            headerName: "Register Number",
            minWidth: 145,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#55566b",
                    }}
                >
                    {row.register_number || "-"}
                </Typography>
            ),
        },

        {
            field: "institution_name",
            headerName: "Institution",
            minWidth: 190,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#55566b",
                    }}
                >
                    {row.institution_name || "-"}
                </Typography>
            ),
        },

        {
            field: "gender",
            headerName: "Gender",
            minWidth: 95,

            renderCell: (row) => (
                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#55566b",
                    }}
                >
                    {row.gender || "-"}
                </Typography>
            ),
        },

        // STUDENT STATUS: ICON ONLY

        {
            field: "is_active",
            headerName: "Student Status",
            minWidth: 115,
            align: "center",

            exportValue: (row) =>
                row.is_active === true ? "Active" : "Inactive",

            renderCell: (row) => (
                <StatusIcon
                    active={row.is_active}
                />
            ),
        },

        // ACCOUNT STATUS: ICON ONLY

        {
            field: "user_is_active",
            headerName: "Account Status",
            minWidth: 115,
            align: "center",

            exportValue: (row) =>
                row.user_is_active === true ? "Active" : "Inactive",

            renderCell: (row) => (
                <StatusIcon
                    active={row.user_is_active}
                />
            ),
        },
    ];

    // ========================================================
    // SELECTED STUDENT AND ADDRESSES
    // ========================================================

    const student = selectedStudent;

    const address = [
        student?.address_line1,
        student?.address_line2,
        student?.city,
        student?.state,
        student?.postal_code,
        student?.country,
    ]
        .filter(Boolean)
        .join(", ");

    const institutionAddress = [
        student?.institution_address_line1,
        student?.institution_address_line2,
        student?.institution_city,
        student?.institution_state,
        student?.institution_postal_code,
        student?.institution_country,
    ]
        .filter(Boolean)
        .join(", ");

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <Box
            sx={{
                width: "100%",
                minWidth: 0,
                minHeight: "100%",
                p: { xs: 1.5, sm: 2.5 },
                backgroundColor: "#f8f9fc",
            }}
        >
            {/* PAGE HEADER */}

            <Box sx={{ mb: 2.5 }}>
                <Typography
                    sx={{
                        fontSize: { xs: "19px", sm: "22px" },
                        fontWeight: 800,
                        color: "#292a3d",
                    }}
                >
                    Student Management
                </Typography>

                <Typography
                    sx={{
                        fontSize: "12px",
                        color: "#85869a",
                        mt: 0.5,
                    }}
                >
                    View and monitor registered students, their accounts
                    and institution details.
                </Typography>
            </Box>

            {/* ERROR MESSAGE */}

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 2, fontSize: "12px" }}
                    action={
                        <Tooltip title="Retry">
                            <IconButton
                                size="small"
                                color="inherit"
                                onClick={fetchStudents}
                            >
                                <Typography sx={{ fontSize: "11px" }}>
                                    Retry
                                </Typography>
                            </IconButton>
                        </Tooltip>
                    }
                >
                    {error}
                </Alert>
            )}

            {/* SHARED DATATABLE */}

            <DataTable
                title="Students"
                rows={students}
                columns={columns}
                loading={loading}
                error={null}
                getRowId={(row) => String(row.id)}
                onRefresh={fetchStudents}
                onView={handleViewStudent}
                searchPlaceholder="Search students..."
                emptyMessage="No students found."
                minWidth={1400}
                initialRowsPerPage={10}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                pagination={true}
            />

            {/* STUDENT DETAILS DRAWER */}

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={handleCloseDrawer}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", sm: 500 },
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
                            Student Details
                        </Typography>

                        <Typography
                            sx={{
                                fontSize: "11px",
                                color: "#85869a",
                                mt: 0.3,
                            }}
                        >
                            Complete student profile
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

                {/* DRAWER BODY */}

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
                        <Alert severity="error">{detailsError}</Alert>
                    ) : student ? (
                        <Stack spacing={2.5}>
                            {/* STUDENT PROFILE */}

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
                                    src={student.profile_image_url || undefined}
                                    sx={{
                                        width: 78,
                                        height: 78,
                                        mx: "auto",
                                        mb: 1.5,
                                        fontSize: "25px",
                                        fontWeight: 700,
                                        bgcolor: "#6d4aff",
                                    }}
                                >
                                    {student.user_name?.charAt(0)?.toUpperCase() || "S"}
                                </Avatar>

                                <Typography
                                    sx={{
                                        fontSize: "17px",
                                        fontWeight: 800,
                                        color: "#292a3d",
                                    }}
                                >
                                    {student.user_name || "Student"}
                                </Typography>

                                <Typography
                                    sx={{
                                        fontSize: "12px",
                                        color: "#85869a",
                                        mt: 0.5,
                                    }}
                                >
                                    @{student.username || "-"}
                                </Typography>

                                <Typography
                                    sx={{
                                        fontSize: "11px",
                                        color: "#6d4aff",
                                        fontWeight: 700,
                                        mt: 1,
                                    }}
                                >
                                    {student.student_code || "-"}
                                </Typography>

                                {/* PROFILE STATUS ICONS ONLY */}

                                <Stack
                                    direction="row"
                                    justifyContent="center"
                                    alignItems="center"
                                    gap={2}
                                    sx={{ mt: 1.5 }}
                                >
                                    <Tooltip
                                        title={
                                            student.is_active === true
                                                ? "Student Active"
                                                : "Student Inactive"
                                        }
                                    >
                                        <Box component="span">
                                            <StatusIcon
                                                active={student.is_active}
                                                label="Student status"
                                            />
                                        </Box>
                                    </Tooltip>

                                    <Tooltip
                                        title={
                                            student.user_is_active === true
                                                ? "Account Active"
                                                : "Account Inactive"
                                        }
                                    >
                                        <Box component="span">
                                            <StatusIcon
                                                active={student.user_is_active}
                                                label="Account status"
                                            />
                                        </Box>
                                    </Tooltip>
                                </Stack>
                            </Paper>

                            {/* PERSONAL INFORMATION */}

                            <DetailSection title="Personal Information">
                                <DetailItem
                                    icon={<PersonOutlineOutlinedIcon fontSize="small" />}
                                    label="Student Name"
                                    value={student.user_name}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<BadgeOutlinedIcon fontSize="small" />}
                                    label="Register Number"
                                    value={student.register_number}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<CalendarMonthOutlinedIcon fontSize="small" />}
                                    label="Date of Birth"
                                    value={formatDate(student.date_of_birth)}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<PersonOutlineOutlinedIcon fontSize="small" />}
                                    label="Gender"
                                    value={student.gender}
                                />
                            </DetailSection>

                            {/* CONTACT INFORMATION */}

                            <DetailSection title="Contact Information">
                                <DetailItem
                                    icon={<EmailOutlinedIcon fontSize="small" />}
                                    label="Email Address"
                                    value={student.email}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<PhoneOutlinedIcon fontSize="small" />}
                                    label="Phone Number"
                                    value={student.phone_number}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<AccountCircleOutlinedIcon fontSize="small" />}
                                    label="Username"
                                    value={student.username}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<LocationOnOutlinedIcon fontSize="small" />}
                                    label="Residential Address"
                                    value={address}
                                />
                            </DetailSection>

                            {/* ACADEMIC INFORMATION */}

                            <DetailSection title="Academic Information">
                                <DetailItem
                                    icon={<SchoolOutlinedIcon fontSize="small" />}
                                    label="Student Code"
                                    value={student.student_code}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<BadgeOutlinedIcon fontSize="small" />}
                                    label="Register Number"
                                    value={student.register_number}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<BusinessOutlinedIcon fontSize="small" />}
                                    label="Institution Name"
                                    value={student.institution_name}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<BadgeOutlinedIcon fontSize="small" />}
                                    label="Institution Code"
                                    value={student.institution_code}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<SchoolOutlinedIcon fontSize="small" />}
                                    label="Institution Type"
                                    value={student.institution_type}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<CalendarMonthOutlinedIcon fontSize="small" />}
                                    label="Joined Date"
                                    value={formatDate(student.joined_at)}
                                />
                            </DetailSection>

                            {/* INSTITUTION CONTACT */}

                            <DetailSection title="Institution Contact">
                                <DetailItem
                                    icon={<EmailOutlinedIcon fontSize="small" />}
                                    label="Institution Email"
                                    value={student.institution_email}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<PhoneOutlinedIcon fontSize="small" />}
                                    label="Institution Phone"
                                    value={student.institution_phone_number}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<BusinessOutlinedIcon fontSize="small" />}
                                    label="Website"
                                    value={student.institution_website_url}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<LocationOnOutlinedIcon fontSize="small" />}
                                    label="Institution Address"
                                    value={institutionAddress}
                                />

                                <Divider />

                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        py: 1,
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: "11px",
                                            color: "#85869a",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Institution Status
                                    </Typography>

                                    {student.institution_id ? (
                                        <StatusIcon
                                            active={student.institution_is_active}
                                        />
                                    ) : (
                                        <Typography
                                            sx={{
                                                fontSize: "12px",
                                                color: "#85869a",
                                            }}
                                        >
                                            Not assigned
                                        </Typography>
                                    )}
                                </Box>
                            </DetailSection>

                            {/* ACCOUNT INFORMATION */}

                            <DetailSection title="Account Information">
                                <DetailItem
                                    icon={<VerifiedUserOutlinedIcon fontSize="small" />}
                                    label="Approval Status"
                                    value={student.approval_status}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<AccountCircleOutlinedIcon fontSize="small" />}
                                    label="Account Locked"
                                    value={
                                        student.user_is_locked === true
                                            ? "Yes"
                                            : "No"
                                    }
                                />

                                <Divider />

                                <DetailItem
                                    icon={<EmailOutlinedIcon fontSize="small" />}
                                    label="Email Verified"
                                    value={formatDateTime(student.email_verified_at)}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<PhoneOutlinedIcon fontSize="small" />}
                                    label="Phone Verified"
                                    value={formatDateTime(student.phone_verified_at)}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<CalendarMonthOutlinedIcon fontSize="small" />}
                                    label="Last Login"
                                    value={formatDateTime(student.last_login_at)}
                                />

                                <Divider />

                                <DetailItem
                                    icon={<VerifiedUserOutlinedIcon fontSize="small" />}
                                    label="Password Changed"
                                    value={formatDateTime(student.password_changed_at)}
                                />
                            </DetailSection>

                            {/* STUDENT BIO */}

                            <DetailSection title="About Student">
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
                                    {student.bio || "No biography available."}
                                </Typography>
                            </DetailSection>
                        </Stack>
                    ) : null}
                </Box>
            </Drawer>
        </Box>
    );
};

export default StudentAdmin;
