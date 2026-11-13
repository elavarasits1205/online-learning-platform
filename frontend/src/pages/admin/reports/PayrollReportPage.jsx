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
import {
    payrollDropdownApi,
} from "../../../service/payroll.api";
import { adminReportApi } from "../../../service/adminReportApi";
import ReportSummaryCards from "./ReportSummaryCards";
import {
    formatDate,
    formatMoney,
    getReportErrorMessage,
} from "./reportUtils";

const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

const STATUS_OPTIONS = [
    "DRAFT",
    "CALCULATED",
    "APPROVED",
    "PAID",
    "CANCELLED",
];

export default function PayrollReportPage() {
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [filters, setFilters] = useState({
        periodId: "",
        instructorId: "",
        status: "",
    });

    const [periods, setPeriods] = useState([]);
    const [instructors, setInstructors] = useState([]);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const optionsLoadedRef = useRef(false);

    const loadOptions = useCallback(async () => {
        if (optionsLoadedRef.current) return;

        setOptionsLoading(true);

        try {
            const [periodRows, instructorRows] = await Promise.all([
                payrollDropdownApi.getPeriods({ page: 1, limit: 100 }),
                payrollDropdownApi.getInstructors({ page: 1, limit: 100 }),
            ]);

            setPeriods(periodRows);
            setInstructors(instructorRows);
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

            if (filters.periodId) params.periodId = filters.periodId;
            if (filters.instructorId) params.instructorId = filters.instructorId;
            if (filters.status) params.status = filters.status;

            const result = await adminReportApi.payroll.getAll(params);

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
        { field: "payroll_number", label: "Payroll Number", minWidth: 160 },
        { field: "period_code", label: "Period Code", minWidth: 140 },
        {
            field: "period_start",
            label: "Period Start",
            minWidth: 130,
            render: (value) => formatDate(value),
        },
        {
            field: "period_end",
            label: "Period End",
            minWidth: 130,
            render: (value) => formatDate(value),
        },
        { field: "instructor_code", label: "Instructor Code", minWidth: 140 },
        {
            field: "instructor_name",
            label: "Instructor",
            minWidth: 180,
            valueGetter: (row) =>
                row.instructor_name || row.instructor_username || "-",
        },
        {
            field: "total_earnings",
            label: "Course Earnings",
            minWidth: 130,
            render: (value, row) => formatMoney(value, row.currency_code),
        },
        {
            field: "incentive_amount",
            label: "Referral Enrollment Incentive",
            minWidth: 150,
            render: (value, row) => formatMoney(value, row.currency_code),
        },
        {
            field: "incentive_notes",
            label: "Referral Incentive Calculation",
            minWidth: 180,
        },
        {
            field: "total_deductions",
            label: "Deductions",
            minWidth: 130,
            render: (value, row) => formatMoney(value, row.currency_code),
        },
        {
            field: "net_amount",
            label: "Net Amount",
            minWidth: 140,
            render: (value, row) => formatMoney(value, row.currency_code),
        },
        {
            field: "paid_amount",
            label: "Paid Amount",
            minWidth: 140,
            render: (value, row) => formatMoney(value, row.currency_code),
        },
        { field: "status", label: "Status", minWidth: 120 },
        {
            field: "paid_at",
            label: "Paid At",
            minWidth: 170,
            render: (value) => formatDate(value),
        },
    ];

    const cards = [
        {
            label: "Total Payrolls",
            value: summary?.total_payrolls ?? 0,
        },
        {
            label: "Total Earnings",
            value: formatMoney(summary?.total_earnings),
        },
        {
            label: "Referral Enrollment Incentives",
            value: formatMoney(summary?.total_incentives),
        },
        {
            label: "Total Deductions",
            value: formatMoney(summary?.total_deductions),
        },
        {
            label: "Net Amount",
            value: formatMoney(summary?.total_net_amount),
        },
        {
            label: "Paid Amount",
            value: formatMoney(summary?.total_paid_amount),
        },
        {
            label: "Approved Payrolls",
            value: summary?.approved_payrolls ?? 0,
        },
    ];

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
            <Typography
                variant="h5"
                sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
            >
                Payroll Report
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                Review instructor payroll totals by period, instructor and
                status.
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
                        label="Payroll Period"
                        value={filters.periodId}
                        disabled={optionsLoading}
                        onChange={(event) =>
                            setFilters((previous) => ({
                                ...previous,
                                periodId: event.target.value,
                            }))
                        }
                    >
                        <MenuItem value="">All periods</MenuItem>

                        {periods.map((period) => (
                            <MenuItem
                                key={String(period.id)}
                                value={String(period.id)}
                            >
                                {`${period.period_code || period.id} (${
                                    formatDate(period.period_start)
                                } - ${formatDate(period.period_end)})`}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Instructor"
                        value={filters.instructorId}
                        disabled={optionsLoading}
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
            </Grid>

            <ReportSummaryCards cards={cards} />

            <DataTable
                title="Payroll Report Details"
                rows={rows}
                columns={columns}
                loading={loading}
                error={null}
                getRowId={(row) => String(row.instructor_payroll_id)}
                onRefresh={loadReport}
                searchPlaceholder="Search payroll, instructor or period..."
                emptyMessage="No payroll records found."
                minWidth={1600}
                initialRowsPerPage={10}
            />
        </Box>
    );
}
