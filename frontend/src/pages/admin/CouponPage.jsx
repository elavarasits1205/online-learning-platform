import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Alert,
    Box,
    Button,
    CircularProgress,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import DataTable from "../../component/tables/DataTable";
import CrudFormDrawer from "../../component/forms/CrudFormDrawer";
import CouponSectionTabs from "./coupon/CouponSectionTabs";

import {
    getCoupons,
    getCouponInstitutions,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon,
} from "../../service/couponApi";

const INITIAL_FORM = {
    institution_id: "",
    institution_name: "",
    coupon_code: "",
    description: "",
    discount_type: "PERCENTAGE",
    discount_value: "10",
    minimum_amount: "0",
    maximum_discount_amount: "",
    valid_from: "",
    valid_until: "",
    usage_limit: "",
    used_count: "0",
    is_active: true,
};

const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function getInstitutionId(institution) {
    const id =
        institution?.id ??
        institution?.institution_id ??
        institution?.institutionId;

    return id == null ? "" : String(id);
}

function getInstitutionName(institution) {
    return (
        institution?.institution_name ??
        institution?.institutionName ??
        institution?.name ??
        ""
    );
}

function getInstitutionLabel(row) {
    const id = row?.institution_id ?? "";
    const name = row?.institution_name ?? "";

    if (id && name) return `${id} - ${name}`;

    return name || id || "-";
}

function formatAmount(value) {
    if (value === null || value === undefined || value === "") {
        return "-";
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number.toLocaleString(undefined, {
              maximumFractionDigits: 2,
          })
        : String(value);
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "-"
        : date.toLocaleString();
}

function toDateTimeLocal(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    );

    return localDate.toISOString().slice(0, 16);
}

function toIsoDate(value) {
    if (!value) return "";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? ""
        : date.toISOString();
}

function normalizeBoolean(value) {
    return (
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1"
    );
}

function getErrorMessage(error, fallback) {
    return (
        error?.response?.data?.message ??
        error?.message ??
        fallback
    );
}

function ActiveStatusIcon({ active }) {
    return (
        <Tooltip title={active ? "Active" : "Inactive"} arrow>
            <Box
                component="span"
                role="img"
                aria-label={active ? "Active" : "Inactive"}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    bgcolor: active ? "#e6f6ee" : "#fdeaea",
                    color: active ? "#168653" : "#d32f2f",
                }}
            >
                {active ? (
                    <CheckCircleIcon fontSize="small" />
                ) : (
                    <CancelIcon fontSize="small" />
                )}
            </Box>
        </Tooltip>
    );
}

// ---------------------------------------------------------
// Coupon page
// ---------------------------------------------------------

export default function CouponPage() {
    const [coupons, setCoupons] = useState([]);
    const [institutions, setInstitutions] = useState([]);

    const [loading, setLoading] = useState(false);
    const [institutionsLoading, setInstitutionsLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [pageError, setPageError] = useState("");
    const [formError, setFormError] = useState("");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState("create");
    const [selectedCouponId, setSelectedCouponId] = useState(null);

    const [form, setForm] = useState({ ...INITIAL_FORM });

    const [institutionFilter, setInstitutionFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [notification, setNotification] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const readOnly = dialogMode === "view";

    const showNotification = useCallback(
        (message, severity = "success") => {
            setNotification({
                open: true,
                message,
                severity,
            });
        },
        []
    );

    // -----------------------------------------------------
    // Load institutions
    // -----------------------------------------------------

    const loadInstitutions = useCallback(async () => {
        setInstitutionsLoading(true);

        try {
            const data = await getCouponInstitutions();

            setInstitutions(Array.isArray(data) ? data : []);
        } catch (error) {
            setInstitutions([]);

            setPageError(
                getErrorMessage(
                    error,
                    "Unable to load institutions."
                )
            );
        } finally {
            setInstitutionsLoading(false);
        }
    }, []);

    // -----------------------------------------------------
    // Load coupons
    // -----------------------------------------------------

    const loadCoupons = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            const params = {
                page: 1,
                limit: 100,
            };

            if (institutionFilter) {
                params.institution_id = String(institutionFilter);
            }

            if (statusFilter === "active") {
                params.is_active = true;
            } else if (statusFilter === "inactive") {
                params.is_active = false;
            }

            const result = await getCoupons(params);

            setCoupons(
                Array.isArray(result?.rows)
                    ? result.rows
                    : Array.isArray(result)
                      ? result
                      : []
            );
        } catch (error) {
            setCoupons([]);

            setPageError(
                getErrorMessage(
                    error,
                    "Unable to load coupons."
                )
            );
        } finally {
            setLoading(false);
        }
    }, [institutionFilter, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadInstitutions();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadInstitutions]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCoupons();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadCoupons]);

    // -----------------------------------------------------
    // Form helpers
    // -----------------------------------------------------

    const resetForm = () => {
        setForm({ ...INITIAL_FORM });
        setFormError("");
        setSelectedCouponId(null);
    };

    const closeDialog = () => {
        if (submitting) return;

        setDialogOpen(false);
        resetForm();
    };

    const handleAdd = () => {
        resetForm();
        setDialogMode("create");
        setDialogOpen(true);
    };

    const handleFieldChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleInstitutionChange = (event) => {
        const institutionId = String(event.target.value);

        const institution = institutions.find(
            (item) => getInstitutionId(item) === institutionId
        );

        setForm((previous) => ({
            ...previous,
            institution_id: institutionId,
            institution_name: institution
                ? getInstitutionName(institution)
                : "",
        }));

        setFormError("");
    };

    // -----------------------------------------------------
    // Open view/edit dialog
    // -----------------------------------------------------

    const openCouponDialog = async (row, mode) => {
        setFormError("");
        setForm({ ...INITIAL_FORM });
        setDialogMode(mode);
        setSelectedCouponId(String(row.id));
        setDialogOpen(true);

        try {
            const coupon = await getCouponById(row.id);

            if (!coupon) {
                throw new Error("Coupon details were not returned.");
            }

            const institutionId = String(
                coupon.institution_id ??
                    coupon.institutionId ??
                    ""
            );

            const matchedInstitution = institutions.find(
                (item) => getInstitutionId(item) === institutionId
            );

            setForm({
                institution_id: institutionId,
                institution_name:
                    coupon.institution_name ??
                    coupon.institutionName ??
                    (matchedInstitution
                        ? getInstitutionName(matchedInstitution)
                        : ""),
                coupon_code: coupon.coupon_code ?? "",
                description: coupon.description ?? "",
                discount_type: coupon.discount_type ?? "PERCENTAGE",
                discount_value: String(coupon.discount_value ?? ""),
                minimum_amount: String(coupon.minimum_amount ?? "0"),
                maximum_discount_amount:
                    coupon.maximum_discount_amount == null
                        ? ""
                        : String(coupon.maximum_discount_amount),
                valid_from: toDateTimeLocal(coupon.valid_from),
                valid_until: toDateTimeLocal(coupon.valid_until),
                usage_limit:
                    coupon.usage_limit == null
                        ? ""
                        : String(coupon.usage_limit),
                used_count: String(coupon.used_count ?? "0"),
                is_active: normalizeBoolean(coupon.is_active),
            });
        } catch (error) {
            setFormError(
                getErrorMessage(
                    error,
                    "Unable to load coupon details."
                )
            );
        }
    };

    // -----------------------------------------------------
    // Validation
    // -----------------------------------------------------

    const validateForm = () => {
        if (!form.institution_id) {
            return "Please select an institution.";
        }

        if (!form.coupon_code.trim()) {
            return "Coupon code is required.";
        }

        if (form.coupon_code.trim().length > 50) {
            return "Coupon code cannot exceed 50 characters.";
        }

        if (form.description.length > 255) {
            return "Description cannot exceed 255 characters.";
        }

        if (!["PERCENTAGE", "FIXED"].includes(form.discount_type)) {
            return "Select a valid discount type.";
        }

        const discount = Number(form.discount_value);
        const minimum = Number(form.minimum_amount);

        const maximum =
            form.maximum_discount_amount === ""
                ? null
                : Number(form.maximum_discount_amount);

        if (
            form.discount_value === "" ||
            !Number.isFinite(discount) ||
            discount < 0
        ) {
            return "Discount value must be a non-negative number.";
        }

        if (
            form.discount_type === "PERCENTAGE" &&
            discount > 100
        ) {
            return "Percentage discount cannot exceed 100.";
        }

        if (
            form.minimum_amount === "" ||
            !Number.isFinite(minimum) ||
            minimum < 0
        ) {
            return "Minimum amount must be a non-negative number.";
        }

        if (
            maximum !== null &&
            (!Number.isFinite(maximum) || maximum < 0)
        ) {
            return "Maximum discount must be a non-negative number.";
        }

        if (
            maximum !== null &&
            form.discount_type !== "PERCENTAGE"
        ) {
            return "Maximum discount amount is only valid for percentage coupons.";
        }

        if (!form.valid_from || !form.valid_until) {
            return "Valid-from and valid-until dates are required.";
        }

        const from = new Date(form.valid_from);
        const until = new Date(form.valid_until);

        if (
            Number.isNaN(from.getTime()) ||
            Number.isNaN(until.getTime())
        ) {
            return "Enter valid dates.";
        }

        if (until < from) {
            return "Valid-until must be on or after valid-from.";
        }

        if (
            form.usage_limit !== "" &&
            (!Number.isInteger(Number(form.usage_limit)) ||
                Number(form.usage_limit) < 1)
        ) {
            return "Usage limit must be a positive integer or left blank.";
        }

        if (
            !Number.isInteger(Number(form.used_count)) ||
            Number(form.used_count) < 0
        ) {
            return "Used count must be a non-negative integer.";
        }

        if (
            form.usage_limit !== "" &&
            Number(form.used_count) > Number(form.usage_limit)
        ) {
            return "Used count cannot exceed the usage limit.";
        }

        return "";
    };

    // -----------------------------------------------------
    // API payload
    // -----------------------------------------------------

    const buildPayload = () => ({
        // Institution ID remains internal and is sent to the API.
        institution_id: String(form.institution_id),
        institution_name: form.institution_name,
        coupon_code: form.coupon_code.trim(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        minimum_amount: Number(form.minimum_amount),
        maximum_discount_amount:
            form.maximum_discount_amount === ""
                ? null
                : Number(form.maximum_discount_amount),
        valid_from: toIsoDate(form.valid_from),
        valid_until: toIsoDate(form.valid_until),
        usage_limit:
            form.usage_limit === ""
                ? null
                : Number(form.usage_limit),
        used_count: Number(form.used_count),
        is_active: Boolean(form.is_active),
    });

    // -----------------------------------------------------
    // Create/update coupon
    // -----------------------------------------------------

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (readOnly) return;

        setFormError("");

        const validationError = validateForm();

        if (validationError) {
            setFormError(validationError);
            return;
        }

        setSubmitting(true);

        try {
            const payload = buildPayload();

            if (dialogMode === "create") {
                await createCoupon(payload);
                showNotification("Coupon created successfully.");
            } else {
                await updateCoupon(selectedCouponId, payload);
                showNotification("Coupon updated successfully.");
            }

            setDialogOpen(false);
            resetForm();

            await loadCoupons();
        } catch (error) {
            setFormError(
                getErrorMessage(error, "Unable to save coupon.")
            );
        } finally {
            setSubmitting(false);
        }
    };

    // -----------------------------------------------------
    // Delete coupon
    // -----------------------------------------------------

    const handleDelete = async (row) => {
        const confirmed = window.confirm(
            `Delete coupon "${row.coupon_code || row.id}"?`
        );

        if (!confirmed) return;

        setPageError("");

        try {
            await deleteCoupon(row.id);

            showNotification("Coupon deleted successfully.");

            await loadCoupons();
        } catch (error) {
            setPageError(
                getErrorMessage(error, "Unable to delete coupon.")
            );
        }
    };

    // -----------------------------------------------------
    // Table columns
    // -----------------------------------------------------

    const columns = useMemo(
        () => [
            {
                field: "institution_name",
                headerName: "Institution",
                minWidth: 200,
                valueGetter: getInstitutionLabel,
                exportValue: getInstitutionLabel,
            },
            {
                field: "coupon_code",
                headerName: "Coupon Code",
                minWidth: 140,
            },
            {
                field: "description",
                headerName: "Description",
                minWidth: 180,
                nowrap: false,
            },
            {
                field: "discount_type",
                headerName: "Discount Type",
                minWidth: 135,
            },
            {
                field: "discount_value",
                headerName: "Discount",
                minWidth: 110,
                valueGetter: (row) =>
                    row.discount_type === "PERCENTAGE"
                        ? `${formatAmount(row.discount_value)}%`
                        : formatAmount(row.discount_value),
                exportValue: (row) =>
                    row.discount_type === "PERCENTAGE"
                        ? `${formatAmount(row.discount_value)}%`
                        : formatAmount(row.discount_value),
            },
            {
                field: "minimum_amount",
                headerName: "Minimum Amount",
                minWidth: 130,
                exportValue: (row) =>
                    formatAmount(row.minimum_amount),
            },
            {
                field: "maximum_discount_amount",
                headerName: "Maximum Discount",
                minWidth: 145,
                exportValue: (row) =>
                    formatAmount(row.maximum_discount_amount),
            },
            {
                field: "valid_from",
                headerName: "Valid From",
                minWidth: 175,
                exportValue: (row) => formatDate(row.valid_from),
            },
            {
                field: "valid_until",
                headerName: "Valid Until",
                minWidth: 175,
                exportValue: (row) => formatDate(row.valid_until),
            },
            {
                field: "usage_limit",
                headerName: "Usage Limit",
                minWidth: 110,
                exportValue: (row) =>
                    row.usage_limit == null
                        ? "Unlimited"
                        : row.usage_limit,
            },
            {
                field: "used_count",
                headerName: "Used",
                minWidth: 80,
            },
            {
                field: "is_active",
                headerName: "Active",
                minWidth: 90,
                align: "center",
                valueGetter: (row) =>
                    normalizeBoolean(row.is_active)
                        ? "Active"
                        : "Inactive",
                exportValue: (row) =>
                    normalizeBoolean(row.is_active)
                        ? "Active"
                        : "Inactive",
                renderCell: (row) => (
                    <ActiveStatusIcon
                        active={normalizeBoolean(row.is_active)}
                    />
                ),
            },
        ],
        []
    );

    // -----------------------------------------------------
    // Render
    // -----------------------------------------------------

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
            {/* Header: no separate Add Coupon button */}

            <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{
                    mb: 3,
                    alignItems: {
                        xs: "stretch",
                        md: "center",
                    },
                    justifyContent: "space-between",
                }}
            >
                <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                >
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: 2,
                            color: "#6d4aff",
                            bgcolor: "#eee9ff",
                            flexShrink: 0,
                        }}
                    >
                        <LocalOfferOutlinedIcon />
                    </Box>

                    <Box>
                        <Typography
                            variant="h5"
                            sx={{
                                fontFamily: FONT_HEADING,
                                fontWeight: 800,
                            }}
                        >
                            Coupon Management
                        </Typography>

                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            Create and manage discount coupons.
                        </Typography>
                    </Box>
                </Stack>
            </Stack>

            <CouponSectionTabs sx={{ mb: 2.5 }} />

            {/* Page error */}

            {pageError && (
                <Alert
                    severity="error"
                    onClose={() => setPageError("")}
                    sx={{ mb: 2 }}
                >
                    {pageError}
                </Alert>
            )}

            {/* Filters */}

            <Box
                sx={{
                    mb: 2,
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                    gap: 2,
                }}
            >
                <FormControl
                    size="small"
                    fullWidth
                    sx={{ minWidth: 0, width: "100%" }}
                >
                    <InputLabel id="coupon-institution-filter-label">
                        Institution
                    </InputLabel>

                    <Select
                        labelId="coupon-institution-filter-label"
                        value={institutionFilter}
                        label="Institution"
                        onChange={(event) =>
                            setInstitutionFilter(event.target.value)
                        }
                    >
                        <MenuItem value="">All institutions</MenuItem>

                        {institutions.map((institution) => {
                            const id = getInstitutionId(institution);
                            const name = getInstitutionName(institution);

                            return (
                                <MenuItem key={id} value={id}>
                                    {id} - {name}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>

                <FormControl
                    size="small"
                    fullWidth
                    sx={{ minWidth: 0, width: "100%" }}
                >
                    <InputLabel id="coupon-status-filter-label">
                        Status
                    </InputLabel>

                    <Select
                        labelId="coupon-status-filter-label"
                        value={statusFilter}
                        label="Status"
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                    >
                        <MenuItem value="all">All statuses</MenuItem>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {/* Coupons table */}

            <DataTable
                title="Coupons"
                rows={coupons}
                columns={columns}
                loading={loading || institutionsLoading}
                error={null}
                getRowId={(row) => String(row.id)}
                onAdd={handleAdd}
                onRefresh={loadCoupons}
                onView={(row) => openCouponDialog(row, "view")}
                onEdit={(row) => openCouponDialog(row, "edit")}
                onDelete={handleDelete}
                addLabel="Add Coupon"
                searchPlaceholder="Search coupon or institution..."
                emptyMessage="No coupons found."
                minWidth={1700}
                initialRowsPerPage={10}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                pagination
            />

            {/* Add / Edit / View dialog */}

            <CrudFormDrawer
                open={dialogOpen}
                onClose={closeDialog}
                fullWidth
                maxWidth="md"
                scroll="paper"
            >
                <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{
                        height: "100%",
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <DialogTitle
                        sx={{
                            fontFamily: FONT_HEADING,
                            fontWeight: 800,
                            flexShrink: 0,
                        }}
                    >
                        {dialogMode === "create"
                            ? "Create Coupon"
                            : dialogMode === "edit"
                              ? "Edit Coupon"
                              : "Coupon Details"}
                    </DialogTitle>

                    <Divider sx={{ flexShrink: 0 }} />

                    <DialogContent
                        sx={{
                            pt: 3,
                            flex: "1 1 0",
                            minHeight: 0,
                            overflowY: "auto",
                            overscrollBehaviorY: "contain",
                        }}
                    >
                        {formError && (
                            <Alert
                                severity="error"
                                onClose={() => setFormError("")}
                                sx={{ mb: 2 }}
                            >
                                {formError}
                            </Alert>
                        )}

                        <Stack spacing={2}>
                            {/* Institution dropdown.
                                Institution ID is stored internally only. */}

                            <FormControl
                                fullWidth
                                required
                                size="small"
                                disabled={
                                    readOnly || institutionsLoading
                                }
                            >
                                <InputLabel id="coupon-form-institution-label">
                                    Institution
                                </InputLabel>

                                <Select
                                    labelId="coupon-form-institution-label"
                                    value={form.institution_id}
                                    label="Institution"
                                    onChange={handleInstitutionChange}
                                >
                                    {institutions.map((institution) => {
                                        const id = getInstitutionId(institution);
                                        const name = getInstitutionName(institution);

                                        return (
                                            <MenuItem key={id} value={id}>
                                                {name || `Institution ${id}`}
                                            </MenuItem>
                                        );
                                    })}
                                </Select>

                                <FormHelperText>
                                    Choose the institution that owns this coupon.
                                </FormHelperText>
                            </FormControl>

                            <TextField
                                name="coupon_code"
                                label="Coupon Code"
                                value={form.coupon_code}
                                onChange={handleFieldChange}
                                required
                                fullWidth
                                size="small"
                                disabled={readOnly}
                                slotProps={{
                                    htmlInput: {
                                        maxLength: 50,
                                    },
                                }}
                            />

                            <TextField
                                name="description"
                                label="Description"
                                value={form.description}
                                onChange={handleFieldChange}
                                fullWidth
                                multiline
                                minRows={2}
                                size="small"
                                disabled={readOnly}
                                slotProps={{
                                    htmlInput: {
                                        maxLength: 255,
                                    },
                                }}
                            />

                            <FormControl
                                fullWidth
                                size="small"
                                disabled={readOnly}
                            >
                                <InputLabel id="coupon-discount-type-label">
                                    Discount Type
                                </InputLabel>

                                <Select
                                    labelId="coupon-discount-type-label"
                                    name="discount_type"
                                    value={form.discount_type}
                                    label="Discount Type"
                                    onChange={handleFieldChange}
                                >
                                    <MenuItem value="PERCENTAGE">
                                        Percentage
                                    </MenuItem>

                                    <MenuItem value="FIXED">
                                        Fixed amount
                                    </MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                name="discount_value"
                                label={
                                    form.discount_type === "PERCENTAGE"
                                        ? "Discount Percentage"
                                        : "Discount Amount"
                                }
                                type="number"
                                value={form.discount_value}
                                onChange={handleFieldChange}
                                required
                                fullWidth
                                size="small"
                                disabled={readOnly}
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: "0.01",
                                        max:
                                            form.discount_type === "PERCENTAGE"
                                                ? 100
                                                : undefined,
                                    },
                                }}
                            />

                            <TextField
                                name="minimum_amount"
                                label="Minimum Purchase Amount"
                                type="number"
                                value={form.minimum_amount}
                                onChange={handleFieldChange}
                                required
                                fullWidth
                                size="small"
                                disabled={readOnly}
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: "0.01",
                                    },
                                }}
                            />

                            <TextField
                                name="maximum_discount_amount"
                                label="Maximum Discount Amount (optional)"
                                type="number"
                                value={form.maximum_discount_amount}
                                onChange={handleFieldChange}
                                fullWidth
                                size="small"
                                disabled={
                                    readOnly ||
                                    form.discount_type !== "PERCENTAGE"
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: "0.01",
                                    },
                                }}
                            />

                            <TextField
                                name="valid_from"
                                label="Valid From"
                                type="datetime-local"
                                value={form.valid_from}
                                onChange={handleFieldChange}
                                required
                                fullWidth
                                size="small"
                                disabled={readOnly}
                                slotProps={{
                                    inputLabel: {
                                        shrink: true,
                                    },
                                }}
                            />

                            <TextField
                                name="valid_until"
                                label="Valid Until"
                                type="datetime-local"
                                value={form.valid_until}
                                onChange={handleFieldChange}
                                required
                                fullWidth
                                size="small"
                                disabled={readOnly}
                                slotProps={{
                                    inputLabel: {
                                        shrink: true,
                                    },
                                }}
                            />

                            <TextField
                                name="usage_limit"
                                label="Usage Limit (optional)"
                                type="number"
                                value={form.usage_limit}
                                onChange={handleFieldChange}
                                fullWidth
                                size="small"
                                disabled={readOnly}
                                slotProps={{
                                    htmlInput: {
                                        min: 1,
                                        step: 1,
                                    },
                                }}
                            />

                            <TextField
                                name="used_count"
                                label="Used Count (automatic)"
                                type="number"
                                value={form.used_count}
                                required
                                fullWidth
                                size="small"
                                disabled
                                helperText="Updated automatically when students redeem this coupon."
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: 1,
                                    },
                                }}
                            />

                            <Stack
                                direction="row"
                                sx={{
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    p: 1.5,
                                    border: "1px solid #e9e8f2",
                                    borderRadius: 2,
                                }}
                            >
                                <Box>
                                    <Typography
                                        variant="body2"
                                        fontWeight={700}
                                    >
                                        Coupon active
                                    </Typography>

                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        Enable or disable this coupon.
                                    </Typography>
                                </Box>

                                <Switch
                                    checked={Boolean(form.is_active)}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            is_active: event.target.checked,
                                        }))
                                    }
                                    disabled={readOnly}
                                />
                            </Stack>
                        </Stack>
                    </DialogContent>

                    <Divider sx={{ flexShrink: 0 }} />

                    <DialogActions
                        sx={{
                            p: 2.5,
                            flexShrink: 0,
                            bgcolor: "background.paper",
                        }}
                    >
                        <Button
                            onClick={closeDialog}
                            color="inherit"
                            disabled={submitting}
                            sx={{ textTransform: "none" }}
                        >
                            {readOnly ? "Close" : "Cancel"}
                        </Button>

                        {!readOnly && (
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={submitting}
                                sx={{
                                    minWidth: 135,
                                    textTransform: "none",
                                    fontWeight: 700,
                                    bgcolor: "#6d4aff",
                                    "&:hover": {
                                        bgcolor: "#5134d7",
                                    },
                                }}
                            >
                                {submitting ? (
                                    <CircularProgress
                                        size={22}
                                        color="inherit"
                                    />
                                ) : dialogMode === "create" ? (
                                    "Create Coupon"
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        )}
                    </DialogActions>
                </Box>
            </CrudFormDrawer>

            {/* Notifications */}

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
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
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
