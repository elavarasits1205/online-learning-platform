import { useCallback, useEffect, useState } from "react";

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
import ReportSummaryCards from "./ReportSummaryCards";
import {
    formatDateTime,
    getReportErrorMessage,
} from "./reportUtils";

const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

const ROLE_OPTIONS = ["ADMIN", "INSTRUCTOR", "STUDENT"];
const APPROVAL_OPTIONS = ["PENDING", "APPROVED", "REJECTED"];

const yesNo = (value) => (value ? "Yes" : "No");

export default function UserReportPage() {
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [filters, setFilters] = useState({
        role: "",
        isActive: "",
        isLocked: "",
        approvalStatus: "",
    });

    const loadReport = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const params = {
                page: 1,
                limit: 100,
            };

            if (filters.role) params.role = filters.role;
            if (filters.isActive) params.isActive = filters.isActive;
            if (filters.isLocked) params.isLocked = filters.isLocked;
            if (filters.approvalStatus) {
                params.approvalStatus = filters.approvalStatus;
            }

            const result = await adminReportApi.users.getAll(params);

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
        const timer = window.setTimeout(loadReport, 0);

        return () => window.clearTimeout(timer);
    }, [loadReport]);

    const columns = [
        { field: "username", label: "Username", minWidth: 150 },
        {
            field: "full_name",
            label: "Full Name",
            minWidth: 180,
            valueGetter: (row) =>
                row.full_name ||
                [row.first_name, row.last_name].filter(Boolean).join(" ") ||
                "-",
        },
        { field: "email", label: "Email", minWidth: 220 },
        { field: "phone_number", label: "Phone", minWidth: 140 },
        {
            field: "roles",
            label: "Roles",
            minWidth: 140,
            valueGetter: (row) => row.roles || "-",
        },
        {
            field: "student_code",
            label: "Student Code",
            minWidth: 140,
            valueGetter: (row) => row.student_code || "-",
        },
        {
            field: "instructor_code",
            label: "Instructor Code",
            minWidth: 150,
            valueGetter: (row) => row.instructor_code || "-",
        },
        {
            field: "is_active",
            label: "Active",
            minWidth: 100,
            valueGetter: (row) => yesNo(row.is_active),
        },
        {
            field: "is_locked",
            label: "Locked",
            minWidth: 100,
            valueGetter: (row) => yesNo(row.is_locked),
        },
        {
            field: "approval_status",
            label: "Approval Status",
            minWidth: 150,
        },
        {
            field: "last_login_at",
            label: "Last Login",
            minWidth: 170,
            render: (value) => formatDateTime(value),
        },
        {
            field: "created_at",
            label: "Created At",
            minWidth: 170,
            render: (value) => formatDateTime(value),
        },
    ];

    const cards = [
        {
            label: "Total Users",
            value: summary?.total_users ?? 0,
        },
        {
            label: "Active Users",
            value: summary?.active_users ?? 0,
        },
        {
            label: "Inactive Users",
            value: summary?.inactive_users ?? 0,
        },
        {
            label: "Locked Users",
            value: summary?.locked_users ?? 0,
        },
        {
            label: "Pending Approval",
            value: summary?.pending_users ?? 0,
        },
        {
            label: "Admins",
            value: summary?.admin_users ?? 0,
        },
    ];

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
            <Typography
                variant="h5"
                sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
            >
                User Report
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                Review accounts, roles, approval status and recent activity.
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
                        label="Role"
                        value={filters.role}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                role: event.target.value,
                            }))
                        }
                    >
                        <MenuItem value="">All roles</MenuItem>

                        {ROLE_OPTIONS.map((role) => (
                            <MenuItem key={role} value={role}>
                                {role}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Active"
                        value={filters.isActive}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                isActive: event.target.value,
                            }))
                        }
                    >
                        <MenuItem value="">All accounts</MenuItem>
                        <MenuItem value="true">Active</MenuItem>
                        <MenuItem value="false">Inactive</MenuItem>
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Locked"
                        value={filters.isLocked}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                isLocked: event.target.value,
                            }))
                        }
                    >
                        <MenuItem value="">All accounts</MenuItem>
                        <MenuItem value="true">Locked</MenuItem>
                        <MenuItem value="false">Unlocked</MenuItem>
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Approval Status"
                        value={filters.approvalStatus}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                approvalStatus: event.target.value,
                            }))
                        }
                    >
                        <MenuItem value="">All statuses</MenuItem>

                        {APPROVAL_OPTIONS.map((status) => (
                            <MenuItem key={status} value={status}>
                                {status}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
            </Grid>

            <ReportSummaryCards cards={cards} />

            <DataTable
                title="User Report Details"
                rows={rows}
                columns={columns}
                loading={loading}
                error={null}
                getRowId={(row) => String(row.id)}
                onRefresh={loadReport}
                searchPlaceholder="Search username, email, name or code..."
                emptyMessage="No user records found."
                minWidth={1850}
                initialRowsPerPage={10}
            />
        </Box>
    );
}
