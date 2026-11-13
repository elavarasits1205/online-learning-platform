import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Stack,
    Typography,
    IconButton,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import DataTable from "../../../component/tables/DataTable";
import CrudFormDrawer from "../../../component/forms/CrudFormDrawer";
import { adminPaymentApi, getErrorMessage } from "../../../service/adminPaymentApi";

const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

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

const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const yesNo = (value) => (value ? "Yes" : "No");

const moneyColumn = (field, label) => ({
    field,
    headerName: label,
    minWidth: 130,
    valueGetter: (row) => money(row[field], row.currency_code),
    exportValue: (row) => money(row[field], row.currency_code),
});

const dateColumn = (field, label) => ({
    field,
    headerName: label,
    minWidth: 175,
    exportValue: (row) => formatDate(row[field]),
});

const activeColumn = {
    field: "is_active",
    headerName: "Active",
    minWidth: 100,
    valueGetter: (row) => yesNo(row.is_active),
    exportValue: (row) => yesNo(row.is_active),
};

const textColumn = (field, label, minWidth = 160) => ({
    field,
    headerName: label,
    minWidth,
});

const PAYMENT_COLUMNS = [
    textColumn("payment_number", "Payment No.", 175),
    textColumn("enrollment_number", "Enrollment No.", 175),
    textColumn("student_name", "Student", 190),
    textColumn("student_code", "Student Code", 140),
    textColumn("register_number", "Register No.", 150),
    textColumn("institution_name", "Institution", 190),
    textColumn("course_title", "Course", 200),
    textColumn("currency_code", "Currency", 100),
    moneyColumn("original_amount", "Original"),
    moneyColumn("discount_amount", "Discount"),
    moneyColumn("tax_amount", "Tax"),
    moneyColumn("final_amount", "Final"),
    moneyColumn("paid_amount", "Paid"),
    textColumn("status", "Status", 120),
    textColumn("payment_method", "Method", 140),
    textColumn("payment_gateway", "Gateway", 140),
    textColumn("gateway_order_id", "Gateway Order", 190),
    dateColumn("payment_due_at", "Due At"),
    dateColumn("paid_at", "Paid At"),
    dateColumn("failed_at", "Failed At"),
    textColumn("failure_reason", "Failure Reason", 180),
    dateColumn("cancelled_at", "Cancelled At"),
    textColumn("cancellation_reason", "Cancellation Reason", 190),
    activeColumn,
];

const TRANSACTION_COLUMNS = [
    textColumn("transaction_number", "Transaction No.", 190),
    textColumn("payment_number", "Payment No.", 175),
    textColumn("gateway_transaction_id", "Gateway Txn", 190),
    textColumn("gateway_order_id", "Gateway Order", 190),
    textColumn("payment_gateway", "Gateway", 140),
    textColumn("payment_method", "Method", 140),
    textColumn("transaction_type", "Type", 130),
    moneyColumn("amount", "Amount"),
    textColumn("currency_code", "Currency", 100),
    textColumn("status", "Status", 120),
    textColumn("gateway_status", "Gateway Status", 150),
    textColumn("gateway_response_code", "Response Code", 140),
    textColumn("gateway_response_message", "Response Message", 200),
    dateColumn("initiated_at", "Initiated At"),
    dateColumn("processed_at", "Processed At"),
    dateColumn("failed_at", "Failed At"),
    textColumn("failure_reason", "Failure Reason", 180),
    activeColumn,
];

const REFUND_COLUMNS = [
    textColumn("refund_number", "Refund No.", 170),
    textColumn("payment_number", "Payment No.", 175),
    textColumn("transaction_number", "Transaction No.", 190),
    textColumn("gateway_refund_id", "Gateway Refund", 190),
    moneyColumn("refund_amount", "Refund Amount"),
    textColumn("currency_code", "Currency", 100),
    textColumn("status", "Status", 120),
    textColumn("reason", "Reason", 190),
    dateColumn("requested_at", "Requested At"),
    dateColumn("processed_at", "Processed At"),
    dateColumn("failed_at", "Failed At"),
    textColumn("failure_reason", "Failure Reason", 180),
    activeColumn,
];

const WEBHOOK_COLUMNS = [
    textColumn("webhook_event_id", "Event ID", 190),
    textColumn("payment_number", "Payment No.", 175),
    textColumn("transaction_number", "Transaction No.", 190),
    textColumn("payment_gateway", "Gateway", 140),
    textColumn("event_type", "Event Type", 170),
    textColumn("event_status", "Event Status", 150),
    {
        field: "signature_verified",
        headerName: "Signature Verified",
        minWidth: 150,
        valueGetter: (row) => yesNo(row.signature_verified),
        exportValue: (row) => yesNo(row.signature_verified),
    },
    textColumn("processing_status", "Processing Status", 160),
    dateColumn("received_at", "Received At"),
    dateColumn("processed_at", "Processed At"),
    textColumn("processing_error", "Processing Error", 200),
    activeColumn,
];

const HIDDEN_DETAIL_FIELDS = new Set([
    "id",
    "payment_id",
    "payment_transaction_id",
    "enrollment_id",
    "student_id",
    "course_id",
    "institution_id",
    "created_by",
    "created_at",
    "updated_by",
    "updated_at",
    "soft_delete",
    "is_active",
]);

const RESOURCE_CONFIG = {
    payments: {
        title: "Payment Management",
        subtitle:
            "All student payments recorded internally by the platform.",
        columns: PAYMENT_COLUMNS,
        api: adminPaymentApi.payments,
        searchPlaceholder: "Search payment, student, course...",
        minWidth: 2600,
        statuses: [
            "PENDING",
            "PROCESSING",
            "PAID",
            "FAILED",
            "CANCELLED",
            "PARTIALLY_REFUNDED",
            "REFUNDED",
        ],
    },
    transactions: {
        title: "Payment Transactions",
        subtitle:
            "Internal payment attempts recorded for every payment.",
        columns: TRANSACTION_COLUMNS,
        api: adminPaymentApi.transactions,
        searchPlaceholder: "Search transaction or payment...",
        minWidth: 2200,
        statuses: [
            "INITIATED",
            "PROCESSING",
            "SUCCESS",
            "FAILED",
            "CANCELLED",
        ],
    },
    refunds: {
        title: "Refund Management",
        subtitle: "Refund requests and their internal outcomes.",
        columns: REFUND_COLUMNS,
        api: adminPaymentApi.refunds,
        searchPlaceholder: "Search refund or payment...",
        minWidth: 2100,
        statuses: [
            "INITIATED",
            "PROCESSING",
            "SUCCESS",
            "FAILED",
            "CANCELLED",
        ],
    },
    webhooks: {
        title: "Payment Webhooks",
        subtitle:
            "Gateway notifications received by the platform (empty while no external gateway is configured).",
        columns: WEBHOOK_COLUMNS,
        api: adminPaymentApi.webhooks,
        searchPlaceholder: "Search webhook event or payment...",
        minWidth: 2200,
        statuses: ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED"],
    },
};

export default function AdminPaymentTables({
    resource = "payments",
    api = null,
    title = null,
    subtitle = null,
    columns = null,
    searchPlaceholder = null,
    minWidth = null,
    statuses = null,
}) {
    const baseConfig = RESOURCE_CONFIG[resource] ?? RESOURCE_CONFIG.payments;

    const config = useMemo(
        () => ({
            ...baseConfig,
            api: api ?? baseConfig.api,
            title: title ?? baseConfig.title,
            subtitle: subtitle ?? baseConfig.subtitle,
            columns: columns ?? baseConfig.columns,
            searchPlaceholder:
                searchPlaceholder ?? baseConfig.searchPlaceholder,
            minWidth: minWidth ?? baseConfig.minWidth,
            statuses: statuses ?? baseConfig.statuses,
        }),
        [
            baseConfig,
            api,
            title,
            subtitle,
            columns,
            searchPlaceholder,
            minWidth,
            statuses,
        ]
    );

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pageError, setPageError] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [notification, setNotification] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const loadRows = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            const params = { page: 1, limit: 100 };

            if (statusFilter) {
                if (resource === "webhooks") {
                    params.processing_status = statusFilter;
                } else {
                    params.status = statusFilter;
                }
            }

            const result = await config.api.getAll(params);

            setRows(Array.isArray(result?.rows) ? result.rows : []);
        } catch (error) {
            setRows([]);
            setPageError(
                getErrorMessage(error, `Unable to load ${config.title}.`)
            );
        } finally {
            setLoading(false);
        }
    }, [config, resource, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadRows();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadRows]);

    const openDetail = useCallback(
        async (row) => {
            setDetail({ ...row });
            setDetailLoading(true);

            try {
                const full = await config.api.getById(row.id);

                if (full) setDetail(full);
            } catch (error) {
                setNotification({
                    open: true,
                    message: getErrorMessage(error, "Unable to load details."),
                    severity: "error",
                });
            } finally {
                setDetailLoading(false);
            }
        },
        [config]
    );

    const detailEntries = useMemo(() => {
        if (!detail) return [];

        const visibleEntries = Object.entries(detail).filter(
            ([key]) => !HIDDEN_DETAIL_FIELDS.has(key)
        );

        return [
            ...visibleEntries,
            ["is_active", yesNo(detail.is_active ?? !detail.soft_delete)],
        ].sort(([a], [b]) => a.localeCompare(b));
    }, [detail]);

    const canDeletePayments = resource === "payments" && !api;

    const handleDeletePayment = async () => {
        if (!deleteTarget || !canDeletePayments) return;

        setDeleting(true);
        try {
            await config.api.remove(deleteTarget.id);
            setDeleteTarget(null);
            setNotification({
                open: true,
                message: "Payment deleted successfully.",
                severity: "success",
            });
            await loadRows();
        } catch (error) {
            setNotification({
                open: true,
                message: getErrorMessage(error, "Unable to delete this payment."),
                severity: "error",
            });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
            <Stack spacing={0.5} sx={{ mb: 3 }}>
                <Typography
                    variant="h5"
                    sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
                >
                    {config.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {config.subtitle}
                </Typography>
            </Stack>

            {pageError && (
                <Alert
                    severity="error"
                    onClose={() => setPageError("")}
                    sx={{ mb: 2 }}
                >
                    {pageError}
                </Alert>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 190 }}>
                    <InputLabel id={`${resource}-status-filter`}>Status</InputLabel>
                    <Select
                        labelId={`${resource}-status-filter`}
                        label="Status"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <MenuItem value="">All statuses</MenuItem>
                        {config.statuses.map((status) => (
                            <MenuItem key={status} value={status}>
                                {status}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>

            <DataTable
                title={config.title}
                rows={rows}
                columns={config.columns}
                loading={loading}
                error={null}
                getRowId={(row) => String(row.id)}
                onRefresh={loadRows}
                onView={openDetail}
                onDelete={canDeletePayments ? setDeleteTarget : undefined}
                canDeleteRow={(row) =>
                    ["PENDING", "FAILED", "CANCELLED"].includes(
                        String(row?.status || "").toUpperCase()
                    )
                }
                deleteActionLabel="Delete payment"
                searchPlaceholder={config.searchPlaceholder}
                emptyMessage={`No ${config.title.toLowerCase()} found.`}
                minWidth={config.minWidth}
                initialRowsPerPage={10}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                pagination
            />

            <CrudFormDrawer
                open={Boolean(detail)}
                onClose={() => setDetail(null)}
                scroll="paper"
                aria-labelledby="payment-detail-title"
                slotProps={{
                    paper: {
                        sx: {
                            width: { xs: "100vw", sm: 620 },
                            maxWidth: "min(680px, 100vw)",
                        },
                    },
                }}
            >
                <DialogTitle
                    id="payment-detail-title"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        fontFamily: FONT_HEADING,
                        fontWeight: 800,
                    }}
                >
                    <Box>
                        <Typography component="span" sx={{ fontWeight: 800 }}>
                            {config.title.replace(/s$/, "")} Details
                        </Typography>
                        <Typography display="block" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Full record details
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={() => setDetail(null)}
                        aria-label="Close details"
                        edge="end"
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ flex: 1, overflowY: "auto", py: 2 }}>
                    {detailLoading ? (
                        <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : (
                        <Stack spacing={1.25} sx={{ pt: 1 }}>
                            {detailEntries.map(([key, value]) => (
                                <Stack
                                    key={key}
                                    direction="column"
                                    spacing={0.5}
                                    sx={{
                                        border: "1px solid #e7e8f0",
                                        borderRadius: 2,
                                        backgroundColor: "#fafaff",
                                        px: 1.5,
                                        py: 1.25,
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: "text.secondary",
                                            fontWeight: 700,
                                            textTransform: "capitalize",
                                        }}
                                    >
                                            {key === "is_active" ? "Active" : key.replaceAll("_", " ")}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}
                                    >
                                        {value === null || value === undefined
                                            ? "-"
                                            : typeof value === "object"
                                              ? JSON.stringify(value, null, 2)
                                              : String(value)}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </DialogContent>
            </CrudFormDrawer>

            <Dialog
                open={Boolean(deleteTarget)}
                onClose={() => !deleting && setDeleteTarget(null)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}>
                    Delete payment?
                </DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary">
                        This will hide payment {deleteTarget?.payment_number || "record"} from active payment lists. Settled payments cannot be deleted.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                    <Button
                        onClick={() => setDeleteTarget(null)}
                        disabled={deleting}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeletePayment}
                        disabled={deleting}
                        startIcon={
                            deleting ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                <DeleteOutlineRoundedIcon />
                            )
                        }
                        sx={{ textTransform: "none", fontWeight: 700, minWidth: 150 }}
                    >
                        {deleting ? "Deleting..." : "Delete payment"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={notification.open}
                autoHideDuration={3500}
                onClose={(_event, reason) => {
                    if (reason === "clickaway") return;
                    setNotification((previous) => ({
                        ...previous,
                        open: false,
                    }));
                }}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    severity={notification.severity}
                    variant="filled"
                    onClose={() =>
                        setNotification((previous) => ({
                            ...previous,
                            open: false,
                        }))
                    }
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

export function AdminPaymentsPage() {
    return <AdminPaymentTables resource="payments" />;
}

export function AdminPaymentReportPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pageError, setPageError] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const loadReport = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            const params = { page: 1, limit: 100 };
            if (statusFilter) params.status = statusFilter;
            const result = await adminPaymentApi.reports.getAll(params);
            setRows(Array.isArray(result?.rows) ? result.rows : []);
        } catch (error) {
            setRows([]);
            setPageError(getErrorMessage(error, "Unable to load payment reports."));
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const totals = useMemo(() => rows.reduce((result, row) => {
        const currency = String(row.currency_code || "INR").toUpperCase();
        const current = result.byCurrency.get(currency) || { final: 0, paid: 0, discounts: 0 };
        result.payments += Number(row.payment_count || 0);
        current.final += Number(row.final_total || 0);
        current.paid += Number(row.paid_total || 0);
        current.discounts += Number(row.discount_total || 0);
        result.byCurrency.set(currency, current);
        return result;
    }, { payments: 0, byCurrency: new Map() }), [rows]);

    const reportColumns = [
        { field: "report_month", label: "Month", headerName: "Month", minWidth: 130 },
        { field: "payment_status", label: "Payment Status", headerName: "Payment Status", minWidth: 160 },
        { field: "currency_code", label: "Currency", headerName: "Currency", minWidth: 110 },
        { field: "payment_count", label: "Payment Count", headerName: "Payment Count", minWidth: 130 },
        ...[
            ["original_total", "Original Amount"],
            ["discount_total", "Discounts"],
            ["tax_total", "Tax"],
            ["final_total", "Final Amount"],
            ["paid_total", "Paid Amount"],
        ].map(([field, label]) => ({
            field,
            label,
            headerName: label,
            minWidth: 150,
            valueGetter: (row) => money(row[field], row.currency_code),
            exportValue: (row) => money(row[field], row.currency_code),
        })),
    ];

    const summaryCards = [
        { label: "Payments represented", value: totals.payments.toLocaleString("en-IN") },
        ...[...totals.byCurrency.entries()].flatMap(([currency, amount]) => ([
            { label: `Final amount · ${currency}`, value: money(amount.final, currency) },
            { label: `Paid amount · ${currency}`, value: money(amount.paid, currency) },
            { label: `Discounts · ${currency}`, value: money(amount.discounts, currency) },
        ])),
    ];

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
            <Stack spacing={0.5} sx={{ mb: 2.5 }}>
                <Typography variant="h5" sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}>
                    Payment Reports
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Monthly payment totals grouped by status and currency.
                </Typography>
            </Stack>

            {pageError && (
                <Alert severity="error" onClose={() => setPageError("")} sx={{ mb: 2 }}>
                    {pageError}
                </Alert>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2.5 }}>
                <FormControl size="small" sx={{ width: { xs: "100%", sm: 320 } }}>
                    <InputLabel id="payment-report-status-label" shrink>Payment Status</InputLabel>
                    <Select
                        labelId="payment-report-status-label"
                        label="Payment Status"
                        value={statusFilter}
                        displayEmpty
                        inputProps={{ "aria-label": "Payment status filter" }}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <MenuItem value="">All payment statuses</MenuItem>
                        {RESOURCE_CONFIG.payments.statuses.map((status) => (
                            <MenuItem key={status} value={status}>{status}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2, mb: 2.5 }}>
                {summaryCards.map((card) => (
                    <Paper key={card.label} elevation={0} sx={{ border: "1px solid #e7e8f0", borderRadius: 2.5, p: 2 }}>
                        <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                        <Typography variant="h6" sx={{ mt: 0.75, fontWeight: 800 }}>{card.value}</Typography>
                    </Paper>
                ))}
            </Box>

            <DataTable
                title="Payment Report Summary"
                rows={rows}
                columns={reportColumns}
                loading={loading}
                error={null}
                getRowId={(row) => String(row.report_key)}
                onRefresh={loadReport}
                searchPlaceholder="Search month, status or currency..."
                emptyMessage="No payment report summaries found."
                minWidth={1200}
                initialRowsPerPage={10}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                pagination
            />
        </Box>
    );
}

export function AdminTransactionsPage() {
    return <AdminPaymentTables resource="transactions" />;
}

export function AdminRefundsPage() {
    return <AdminPaymentTables resource="refunds" />;
}

export function AdminWebhooksPage() {
    return <AdminPaymentTables resource="webhooks" />;
}
