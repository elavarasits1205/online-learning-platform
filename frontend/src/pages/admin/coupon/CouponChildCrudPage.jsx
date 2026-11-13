import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    Typography,
} from "@mui/material";

import DataTable from "../../../component/tables/DataTable";
import CrudFormDrawer from "../../../component/forms/CrudFormDrawer";
import CouponSectionTabs from "./CouponSectionTabs";
import { getErrorMessage } from "./couponPageUtils";

const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

function buildInitialFilters(filters) {
    const initial = {};

    filters.forEach((filter) => {
        initial[filter.name] = filter.defaultValue ?? "";
    });

    return initial;
}

export default function CouponChildCrudPage({
    title,
    subtitle,
    icon,
    tableTitle,
    addLabel = "Add",
    deleteActionLabel = "Delete",
    deleteSuccessMessage = "Record deleted successfully.",
    deleteConfirmMessage,
    canDeleteRow,
    searchPlaceholder = "Search...",
    emptyMessage = "No records found.",
    minWidth = 1200,
    columns = [],
    formFields = [],
    initialForm = {},
    api,
    loadDropdowns,
    rowToForm,
    formToPayload,
    validateForm,
    getRowLabel,
    filters = [],
    couponId = "",
    refreshOnFocus = false,
    refreshIntervalMs = 0,
    formMaxWidth = "sm",
    viewOnly = false,
    summary = null,
}) {
    const [rows, setRows] = useState([]);
    const rowRequestSequence = useRef(0);
    const [dropdowns, setDropdowns] = useState({});

    const [loading, setLoading] = useState(false);
    const [dropdownLoading, setDropdownLoading] = useState(false);

    const [pageError, setPageError] = useState("");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState("create");
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState({ ...initialForm });
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [filterValues, setFilterValues] = useState(() => {
        const initial = buildInitialFilters(filters);

        if (
            couponId &&
            Object.prototype.hasOwnProperty.call(initial, "coupon_id")
        ) {
            initial.coupon_id = String(couponId);
        }

        return initial;
    });

    const [notification, setNotification] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const readOnly = dialogMode === "view";

    const showNotification = useCallback(
        (message, severity = "success") => {
            setNotification({ open: true, message, severity });
        },
        []
    );

    const loadDropdownData = useCallback(async () => {
        setDropdownLoading(true);

        try {
            const data = await loadDropdowns();
            setDropdowns(data && typeof data === "object" ? data : {});
        } catch (error) {
            setDropdowns({});
            setPageError(
                getErrorMessage(error, "Unable to load dropdown data.")
            );
        } finally {
            setDropdownLoading(false);
        }
    }, [loadDropdowns]);

    const loadRows = useCallback(async ({ silent = false } = {}) => {
        const requestSequence = ++rowRequestSequence.current;
        if (!silent) setLoading(true);
        setPageError("");

        try {
            const params = { page: 1, limit: 100 };

            Object.entries(filterValues).forEach(([key, value]) => {
                if (value !== "" && value !== null && value !== undefined) {
                    params[key] = value;
                }
            });

            const result = await api.getAll(params);
            if (requestSequence !== rowRequestSequence.current) return;

            setRows(
                Array.isArray(result?.rows)
                    ? result.rows
                    : Array.isArray(result)
                      ? result
                      : []
            );
        } catch (error) {
            if (requestSequence !== rowRequestSequence.current) return;
            if (!silent) setRows([]);
            setPageError(
                getErrorMessage(error, "Unable to load records.")
            );
        } finally {
            if (requestSequence === rowRequestSequence.current) {
                setLoading(false);
            }
        }
    }, [api, filterValues]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadDropdownData();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadDropdownData]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadRows();
        }, 0);

        return () => clearTimeout(timer);
    }, [loadRows]);

    useEffect(() => {
        if (!refreshOnFocus) return undefined;

        const refresh = () => loadRows({ silent: true });
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [loadRows, refreshOnFocus]);

    useEffect(() => {
        if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs <= 0) {
            return undefined;
        }

        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                loadRows({ silent: true });
            }
        }, refreshIntervalMs);

        return () => window.clearInterval(interval);
    }, [loadRows, refreshIntervalMs]);

    const resetForm = useCallback(() => {
        setForm({ ...initialForm });
        setFormError("");
        setSelectedId(null);
    }, [initialForm]);

    const closeDialog = useCallback(() => {
        if (submitting) return;

        setDialogOpen(false);
        resetForm();
    }, [submitting, resetForm]);

    const handleAdd = useCallback(() => {
        resetForm();
        setDialogMode("create");
        setDialogOpen(true);
    }, [resetForm]);

    const openRowDialog = useCallback(
        async (row, mode) => {
            setFormError("");
            setForm({ ...initialForm });
            setDialogMode(mode);
            setSelectedId(String(row.id));
            setDialogOpen(true);

            if (mode === "create") return;

            setLoadingDetails(true);

            try {
                const detail = await api.getById(row.id);

                if (!detail) {
                    throw new Error("Record details were not returned.");
                }

                setForm(
                    typeof rowToForm === "function"
                        ? rowToForm(detail)
                        : { ...initialForm }
                );
            } catch (error) {
                setFormError(
                    getErrorMessage(
                        error,
                        "Unable to load record details."
                    )
                );
            } finally {
                setLoadingDetails(false);
            }
        },
        [api, initialForm, rowToForm]
    );

    const handleFieldChange = useCallback(
        (field, value) => {
            setForm((previous) => {
                const next = { ...previous, [field.name]: value };

                if (typeof field.onChange === "function") {
                    const patch = field.onChange(value, next, dropdowns);

                    if (patch && typeof patch === "object") {
                        return { ...next, ...patch };
                    }
                }

                return next;
            });

            setFormError("");
        },
        [dropdowns]
    );

    const handleSubmit = useCallback(
        async (event) => {
            event.preventDefault();

            if (readOnly) return;

            setFormError("");

            const validationError = validateForm(form, dropdowns);

            if (validationError) {
                setFormError(validationError);
                return;
            }

            setSubmitting(true);

            try {
                const payload = formToPayload(form);

                if (dialogMode === "create") {
                    await api.create(payload);
                    showNotification("Record created successfully.");
                } else {
                    await api.update(selectedId, payload);
                    showNotification("Record updated successfully.");
                }

                setDialogOpen(false);
                resetForm();
                await loadRows();
            } catch (error) {
                setFormError(
                    getErrorMessage(error, "Unable to save record.")
                );
            } finally {
                setSubmitting(false);
            }
        },
        [
            api,
            dialogMode,
            dropdowns,
            form,
            formToPayload,
            loadRows,
            readOnly,
            resetForm,
            selectedId,
            showNotification,
            validateForm,
        ]
    );

    const handleDelete = useCallback(
        async (row) => {
            const label =
                typeof getRowLabel === "function"
                    ? getRowLabel(row)
                    : row?.id;

            const confirmation =
                typeof deleteConfirmMessage === "function"
                    ? deleteConfirmMessage(label, row)
                    : deleteConfirmMessage ||
                      `Delete "${label}"? This action cannot be undone from this screen.`;
            const confirmed = window.confirm(confirmation);

            if (!confirmed) return;

            setPageError("");

            try {
                await api.remove(row.id);
                showNotification(
                    typeof deleteSuccessMessage === "function"
                        ? deleteSuccessMessage(label, row)
                        : deleteSuccessMessage
                );
                await loadRows();
            } catch (error) {
                setPageError(
                    getErrorMessage(error, "Unable to delete record.")
                );
            }
        },
        [
            api,
            deleteConfirmMessage,
            deleteSuccessMessage,
            getRowLabel,
            loadRows,
            showNotification,
        ]
    );

    const fixedCoupon = useMemo(() => {
        if (!couponId) return null;

        return (dropdowns.coupons || []).find(
            (coupon) => String(coupon.id) === String(couponId)
        );
    }, [couponId, dropdowns.coupons]);

    const renderField = (field) => {
        if (typeof field.hidden === "function" && field.hidden(form)) {
            return null;
        }

        const value = form[field.name] ?? "";
        const disabled =
            readOnly ||
            Boolean(field.readOnly) ||
            (typeof field.disabled === "function"
                ? field.disabled(form)
                : false);

        if (field.type === "switch") {
            return (
                <Stack
                    key={field.name}
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
                        <Typography variant="body2" fontWeight={700}>
                            {field.label}
                        </Typography>

                        {field.helperText && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {field.helperText}
                            </Typography>
                        )}
                    </Box>

                    <Switch
                        checked={Boolean(value)}
                        onChange={(event) =>
                            handleFieldChange(field, event.target.checked)
                        }
                        disabled={disabled}
                    />
                </Stack>
            );
        }

        if (field.type === "select") {
            const options =
                field.staticOptions ?? dropdowns[field.options] ?? [];

            return (
                <FormControl
                    key={field.name}
                    fullWidth
                    required={field.required}
                    size="small"
                    disabled={disabled}
                >
                    <InputLabel id={`${field.name}-label`}>
                        {field.label}
                    </InputLabel>

                    <Select
                        labelId={`${field.name}-label`}
                        label={field.label}
                        name={field.name}
                        value={value}
                        onChange={(event) =>
                            handleFieldChange(field, event.target.value)
                        }
                    >
                        {options.map((option, index) => {
                            const isStatic = Array.isArray(
                                field.staticOptions
                            );

                            const optionValue = isStatic
                                ? option.value
                                : field.optionValue
                                  ? field.optionValue(option)
                                  : String(option.id ?? index);

                            const optionLabel = isStatic
                                ? option.label
                                : field.optionLabel
                                  ? field.optionLabel(option)
                                  : String(
                                        option.name ?? option.id ?? index
                                    );

                            return (
                                <MenuItem
                                    key={optionValue || index}
                                    value={optionValue}
                                >
                                    {optionLabel}
                                </MenuItem>
                            );
                        })}
                    </Select>

                    {field.helperText && (
                        <FormHelperText>
                            {field.helperText}
                        </FormHelperText>
                    )}
                </FormControl>
            );
        }

        return (
            <TextField
                key={field.name}
                name={field.name}
                label={field.label}
                type={field.type ?? "text"}
                value={value}
                onChange={(event) =>
                    handleFieldChange(field, event.target.value)
                }
                required={field.required}
                fullWidth
                size="small"
                disabled={disabled}
                multiline={field.type === "textarea"}
                minRows={field.type === "textarea" ? 2 : undefined}
                helperText={field.helperText}
                slotProps={{
                    htmlInput: {
                        ...(field.type === "number"
                            ? {
                                  min: field.min ?? 0,
                                  step: field.step ?? "0.01",
                                  max: field.max,
                              }
                            : {}),
                        ...(field.maxLength
                            ? { maxLength: field.maxLength }
                            : {}),
                    },
                    inputLabel:
                        field.type === "datetime-local" ||
                        field.type === "date"
                            ? { shrink: true }
                            : undefined,
                }}
            />
        );
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
            <Stack
                direction="row"
                spacing={1.5}
                sx={{ mb: 3, alignItems: "center" }}
            >
                {icon && (
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
                        {icon}
                    </Box>
                )}

                <Box>
                    <Typography
                        variant="h5"
                        sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
                    >
                        {title}
                    </Typography>

                    {subtitle && (
                        <Typography variant="body2" color="text.secondary">
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </Stack>

            <CouponSectionTabs sx={{ mb: 2.5 }} />

            {pageError && (
                <Alert
                    severity="error"
                    onClose={() => setPageError("")}
                    sx={{ mb: 2 }}
                >
                    {pageError}
                </Alert>
            )}

            {couponId && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Showing records for coupon{" "}
                    <strong>
                        {fixedCoupon?.coupon_code || `ID ${couponId}`}
                    </strong>
                    .
                </Alert>
            )}

            {typeof summary === "function" && summary(rows, loading)}

            {filters.length > 0 && (
                <Box
                    sx={{
                        mb: 2,
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                        gap: 2,
                    }}
                >
                    {filters.map((filter) => {
                        const options =
                            filter.staticOptions ??
                            dropdowns[filter.options] ??
                            [];

                        return (
                            <FormControl
                                key={filter.name}
                                size="small"
                                fullWidth
                                sx={{ minWidth: 0, width: "100%" }}
                            >
                                <InputLabel
                                    id={`${tableTitle}-${filter.name}-label`}
                                >
                                    {filter.label}
                                </InputLabel>

                                <Select
                                    labelId={`${tableTitle}-${filter.name}-label`}
                                    label={filter.label}
                                    value={filterValues[filter.name] ?? ""}
                                    disabled={Boolean(
                                        couponId && filter.name === "coupon_id"
                                    )}
                                    onChange={(event) =>
                                        setFilterValues((previous) => ({
                                            ...previous,
                                            [filter.name]: event.target.value,
                                        }))
                                    }
                                >
                                    <MenuItem value="">
                                        {filter.allLabel ??
                                            `All ${filter.label.toLowerCase()}s`}
                                    </MenuItem>

                                    {options.map((option, index) => {
                                        const optionValue =
                                            filter.staticOptions
                                                ? option.value
                                                : filter.optionValue
                                                  ? filter.optionValue(option)
                                                  : String(
                                                        option.id ?? index
                                                    );

                                        const optionLabel =
                                            filter.staticOptions
                                                ? option.label
                                                : filter.optionLabel
                                                  ? filter.optionLabel(option)
                                                  : String(
                                                        option.name ??
                                                            option.id ??
                                                            index
                                                    );

                                        return (
                                            <MenuItem
                                                key={optionValue || index}
                                                value={optionValue}
                                            >
                                                {optionLabel}
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                        );
                    })}
                </Box>
            )}

            <DataTable
                title={tableTitle}
                rows={rows}
                columns={columns}
                loading={loading || dropdownLoading}
                error={null}
                getRowId={(row) => String(row.id)}
                onAdd={viewOnly ? undefined : handleAdd}
                onRefresh={loadRows}
                onView={(row) => openRowDialog(row, "view")}
                onEdit={viewOnly ? undefined : (row) => openRowDialog(row, "edit")}
                onDelete={viewOnly ? undefined : handleDelete}
                canDeleteRow={canDeleteRow}
                deleteActionLabel={deleteActionLabel}
                addLabel={addLabel}
                searchPlaceholder={searchPlaceholder}
                emptyMessage={emptyMessage}
                minWidth={minWidth}
                initialRowsPerPage={10}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                pagination
            />

            <CrudFormDrawer
                open={dialogOpen}
                onClose={closeDialog}
                fullWidth
                maxWidth={formMaxWidth}
                scroll="paper"
            >
                <Box component="form" onSubmit={handleSubmit}>
                    <DialogTitle
                        sx={{ fontFamily: FONT_HEADING, fontWeight: 800 }}
                    >
                        {dialogMode === "create"
                            ? `Create ${tableTitle.replace(/s$/, "")}`
                            : dialogMode === "edit"
                              ? `Edit ${tableTitle.replace(/s$/, "")}`
                              : `${tableTitle.replace(/s$/, "")} Details`}
                    </DialogTitle>

                    <Divider />

                    <DialogContent sx={{ pt: 3 }}>
                        {formError && (
                            <Alert
                                severity="error"
                                onClose={() => setFormError("")}
                                sx={{ mb: 2 }}
                            >
                                {formError}
                            </Alert>
                        )}

                        {loadingDetails ? (
                            <Stack
                                spacing={2}
                                sx={{
                                    py: 8,
                                    alignItems: "center",
                                }}
                            >
                                <CircularProgress />

                                <Typography color="text.secondary">
                                    Loading details...
                                </Typography>
                            </Stack>
                        ) : (
                            <Stack spacing={2}>
                                {formFields.map(renderField)}
                            </Stack>
                        )}
                    </DialogContent>

                    <Divider />

                    <DialogActions sx={{ p: 2.5 }}>
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
                                disabled={submitting || loadingDetails}
                                sx={{
                                    minWidth: 135,
                                    textTransform: "none",
                                    fontWeight: 700,
                                    bgcolor: "#6d4aff",
                                    "&:hover": { bgcolor: "#5134d7" },
                                }}
                            >
                                {submitting ? (
                                    <CircularProgress
                                        size={22}
                                        color="inherit"
                                    />
                                ) : dialogMode === "create" ? (
                                    "Create"
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        )}
                    </DialogActions>
                </Box>
            </CrudFormDrawer>

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
