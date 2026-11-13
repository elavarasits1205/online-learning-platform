// src/pages/admin/master-data/InstitutionPage.jsx

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Drawer,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    Snackbar,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";

import DataTable from "../../../component/tables/DataTable";

import {
    getInstitutions,
    getInstitutionById,
    createInstitution,
    updateInstitution,
    deleteInstitution,
} from "../../../service/institutionApi";

// ---------------------------------------------------------
// Design tokens
// ---------------------------------------------------------

const FONT_BODY = "var(--font-body, 'DM Sans', sans-serif)";
const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

const PRIMARY = "var(--color-primary, #6d4aff)";
const PRIMARY_DARK = "var(--color-primary-dark, #5134d7)";
const PRIMARY_LIGHT = "var(--color-primary-light, #eee9ff)";
const INK = "var(--color-ink, #17152b)";
const MUTED = "var(--color-muted, #6e7086)";

const FIELD_LIMITS = {
    code: 50,
    name: 200,
    institution_type: 50,
    email: 255,
    phone_number: 10,
    address_line1: 255,
    address_line2: 255,
    city: 100,
    state: 100,
    postal_code: 20,
    country: 100,
};

const NULLABLE_FIELDS = [
    "institution_type",
    "description",
    "email",
    "phone_number",
    "website_url",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "country",
    "logo_url",
];

const EMPTY_FORM = {
    code: "",
    name: "",
    institution_type: "",
    description: "",
    email: "",
    phone_number: "",
    website_url: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    logo_url: "",
    is_active: true,
};

const BASIC_FIELDS = [
    {
        name: "code",
        label: "Institution Code",
        required: true,
    },
    {
        name: "name",
        label: "Institution Name",
        required: true,
    },
    {
        name: "institution_type",
        label: "Institution Type",
    },
    {
        name: "email",
        label: "Email",
        type: "email",
    },
    {
        name: "phone_number",
        label: "Phone Number",
        type: "tel",
    },
    {
        name: "website_url",
        label: "Website URL",
        type: "url",
    },
];

const ADDRESS_FIELDS = [
    {
        name: "address_line1",
        label: "Address Line 1",
    },
    {
        name: "address_line2",
        label: "Address Line 2",
    },
    {
        name: "city",
        label: "City",
    },
    {
        name: "state",
        label: "State",
    },
    {
        name: "postal_code",
        label: "Postal Code",
    },
    {
        name: "country",
        label: "Country",
    },
];

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function emptyForm() {
    return { ...EMPTY_FORM };
}

function displayValue(value) {
    if (value === null || value === undefined || value === "") {
        return "-";
    }

    return String(value);
}

function isActive(value) {
    return value === true || value === "true";
}

function indiaPhoneDigits(value) {
    let digits = String(value ?? "").replace(/\D/g, "");

    if (digits.length > 10 && digits.startsWith("91")) {
        digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
        digits = digits.slice(1);
    }

    return digits.slice(0, 10);
}

function getApiError(error) {
    return (
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong. Please try again."
    );
}

function formFromInstitution(institution) {
    const form = { ...EMPTY_FORM };

    for (const field of Object.keys(EMPTY_FORM)) {
        if (
            institution?.[field] !== undefined &&
            institution?.[field] !== null
        ) {
            form[field] = institution[field];
        }
    }

    form.phone_number = indiaPhoneDigits(institution?.phone_number);
    form.is_active = isActive(institution?.is_active);

    return form;
}

function normalizePayload(form) {
    const payload = {};

    for (const [field, value] of Object.entries(form)) {
        if (field === "is_active") {
            payload[field] = Boolean(value);
            continue;
        }

        if (field === "phone_number") {
            const digits = indiaPhoneDigits(value);
            payload[field] = digits ? `+91${digits}` : null;
            continue;
        }

        const normalized = String(value ?? "").trim();

        payload[field] =
            normalized === "" && NULLABLE_FIELDS.includes(field)
                ? null
                : normalized;
    }

    return payload;
}

function validateForm(form) {
    const errors = {};

    const code = String(form.code ?? "").trim();
    const name = String(form.name ?? "").trim();

    if (!code) {
        errors.code = "Institution code is required.";
    } else if (code.length > FIELD_LIMITS.code) {
        errors.code = `Code must not exceed ${FIELD_LIMITS.code} characters.`;
    }

    if (!name) {
        errors.name = "Institution name is required.";
    } else if (name.length > FIELD_LIMITS.name) {
        errors.name = `Name must not exceed ${FIELD_LIMITS.name} characters.`;
    }

    for (const [field, maxLength] of Object.entries(FIELD_LIMITS)) {
        const value = String(form[field] ?? "").trim();

        if (value && value.length > maxLength) {
            errors[field] = `Must not exceed ${maxLength} characters.`;
        }
    }

    const email = String(form.email ?? "").trim();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = "Enter a valid email address.";
    }

    if (form.phone_number && indiaPhoneDigits(form.phone_number).length !== 10) {
        errors.phone_number = "Enter a valid 10-digit Indian phone number.";
    }

    for (const field of ["website_url"]) {
        const value = String(form[field] ?? "").trim();

        if (!value) continue;

        try {
            const url = new URL(value);

            if (!["http:", "https:"].includes(url.protocol)) {
                errors[field] = "Use a URL starting with http:// or https://.";
            }
        } catch {
            errors[field] = "Enter a valid URL.";
        }
    }

    return errors;
}

function normalizeListResponse(result) {
    if (Array.isArray(result)) return result;

    if (Array.isArray(result?.rows)) return result.rows;
    if (Array.isArray(result?.items)) return result.items;
    if (Array.isArray(result?.institutions)) return result.institutions;
    if (Array.isArray(result?.data)) return result.data;

    if (Array.isArray(result?.data?.rows)) return result.data.rows;
    if (Array.isArray(result?.data?.items)) return result.data.items;
    if (Array.isArray(result?.data?.institutions)) {
        return result.data.institutions;
    }

    return [];
}

function normalizeDetailResponse(result) {
    if (!result || typeof result !== "object") return null;

    if (result.institution && typeof result.institution === "object") {
        return result.institution;
    }

    if (
        result.data &&
        typeof result.data === "object" &&
        !Array.isArray(result.data)
    ) {
        if (
            result.data.institution &&
            typeof result.data.institution === "object"
        ) {
            return result.data.institution;
        }

        return result.data;
    }

    return result;
}

// ---------------------------------------------------------
// Institution Page
// ---------------------------------------------------------

export default function InstitutionPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    const [panelOpen, setPanelOpen] = useState(false);
    const [panelMode, setPanelMode] = useState("create");

    const [selectedInstitution, setSelectedInstitution] = useState(null);

    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState("");

    const [saving, setSaving] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    const [notification, setNotification] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const readOnly = panelMode === "view";

    useEffect(() => {
        if (!logoPreviewUrl.startsWith("blob:")) return undefined;

        return () => URL.revokeObjectURL(logoPreviewUrl);
    }, [logoPreviewUrl]);

    // -----------------------------------------------------
    // Notifications
    // -----------------------------------------------------

    const notify = useCallback((message, severity = "success") => {
        setNotification({
            open: true,
            message,
            severity,
        });
    }, []);

    const closeNotification = (_event, reason) => {
        if (reason === "clickaway") return;

        setNotification((current) => ({
            ...current,
            open: false,
        }));
    };

    // -----------------------------------------------------
    // Load institutions
    // -----------------------------------------------------

    const loadInstitutions = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            const result = await getInstitutions({
                page: 1,
                limit: 100,
            });

            setRows(normalizeListResponse(result));
        } catch (error) {
            setPageError(getApiError(error));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInstitutions();
    }, [loadInstitutions]);

    // -----------------------------------------------------
    // Panel open and close
    // -----------------------------------------------------

    const closePanel = () => {
        if (saving) return;

        setPanelOpen(false);
        setPanelMode("create");
        setSelectedInstitution(null);
        setForm(emptyForm());
        setFormErrors({});
        setLogoFile(null);
        setLogoPreviewUrl("");
        setDetailLoading(false);
    };

    const openCreatePanel = () => {
        setPanelMode("create");
        setSelectedInstitution(null);
        setForm(emptyForm());
        setFormErrors({});
        setLogoFile(null);
        setLogoPreviewUrl("");
        setDetailLoading(false);
        setPanelOpen(true);
    };

    const openInstitutionPanel = async (institution, mode) => {
        setPanelMode(mode);
        setSelectedInstitution(institution);
        setForm(formFromInstitution(institution));
        setFormErrors({});
        setLogoFile(null);
        setLogoPreviewUrl("");
        setPanelOpen(true);
        setDetailLoading(true);

        try {
            const result = await getInstitutionById(institution.id);
            const detail = normalizeDetailResponse(result);

            if (
                detail &&
                String(detail.id ?? institution.id) ===
                    String(institution.id)
            ) {
                setSelectedInstitution(detail);
                setForm(formFromInstitution(detail));
            }
        } catch (error) {
            notify(getApiError(error), "error");
        } finally {
            setDetailLoading(false);
        }
    };

    // -----------------------------------------------------
    // Form change handler
    // -----------------------------------------------------

    const handleFieldChange = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]:
                field === "phone_number" ? indiaPhoneDigits(value) : value,
        }));

        setFormErrors((current) => {
            if (!current[field] && !current.form) return current;

            const next = { ...current };

            delete next[field];
            delete next.form;

            return next;
        });
    };

    const handleLogoSelection = (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedTypes.includes(file.type)) {
            setLogoFile(null);
            setLogoPreviewUrl("");
            setFormErrors((current) => ({
                ...current,
                logo: "Choose a JPG, PNG, or WebP image.",
            }));
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setLogoFile(null);
            setLogoPreviewUrl("");
            setFormErrors((current) => ({
                ...current,
                logo: "The logo image must not exceed 5 MB.",
            }));
            return;
        }

        setLogoFile(file);
        setLogoPreviewUrl(URL.createObjectURL(file));
        setFormErrors((current) => {
            const next = { ...current };
            delete next.logo;
            delete next.form;
            return next;
        });
    };

    // -----------------------------------------------------
    // Create / update
    // -----------------------------------------------------

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (readOnly || saving || detailLoading) return;

        const errors = validateForm(form);

        if (formErrors.logo) {
            errors.logo = formErrors.logo;
        }

        setFormErrors(errors);

        if (Object.keys(errors).length > 0) return;

        const payload = normalizePayload(form);

        setSaving(true);

        try {
            if (panelMode === "create") {
                await createInstitution(payload, logoFile);
                notify("Institution created successfully.");
            } else if (panelMode === "edit" && selectedInstitution?.id) {
                await updateInstitution(
                    selectedInstitution.id,
                    payload,
                    logoFile
                );
                notify("Institution updated successfully.");
            } else {
                notify("Unable to determine the institution to update.", "error");
                return;
            }

            setPanelOpen(false);
            setPanelMode("create");
            setSelectedInstitution(null);
            setForm(emptyForm());
            setFormErrors({});
            setLogoFile(null);
            setLogoPreviewUrl("");

            await loadInstitutions();
        } catch (error) {
            const message = getApiError(error);

            setFormErrors((current) => ({
                ...current,
                form: message,
            }));

            notify(message, "error");
        } finally {
            setSaving(false);
        }
    };

    // -----------------------------------------------------
    // Delete
    // -----------------------------------------------------

    const handleDelete = async (institution) => {
        const confirmed = window.confirm(
            `Delete institution "${institution.name}" (${institution.code})?`
        );

        if (!confirmed) return;

        try {
            await deleteInstitution(institution.id);

            setRows((current) =>
                current.filter(
                    (row) => String(row.id) !== String(institution.id)
                )
            );

            notify("Institution deleted successfully.");
        } catch (error) {
            notify(getApiError(error), "error");
        }
    };

    // -----------------------------------------------------
    // Table columns
    // -----------------------------------------------------

    const columns = useMemo(
        () => [
            {
                field: "logo_url",
                headerName: "Logo",
                minWidth: 90,
                searchable: false,
                exportable: false,
                renderCell: (row) =>
                    row.logo_url ? (
                        <Box
                            component="img"
                            src={row.logo_url}
                            alt={`${row.name || "Institution"} logo`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            sx={{
                                display: "block",
                                width: 42,
                                height: 42,
                                objectFit: "contain",
                                borderRadius: 1.5,
                                border: "1px solid #e5e7ef",
                                backgroundColor: "#fff",
                                p: 0.4,
                            }}
                        />
                    ) : (
                        <Box
                            sx={{
                                width: 42,
                                height: 42,
                                display: "grid",
                                placeItems: "center",
                                borderRadius: 1.5,
                                backgroundColor: PRIMARY_LIGHT,
                                color: PRIMARY,
                            }}
                        >
                            <BusinessOutlinedIcon fontSize="small" />
                        </Box>
                    ),
            },
            {
                field: "code",
                headerName: "Code",
                minWidth: 125,
            },
            {
                field: "name",
                headerName: "Institution Name",
                minWidth: 200,
                nowrap: false,
            },
            {
                field: "institution_type",
                headerName: "Type",
                minWidth: 120,
                renderCell: (row) => displayValue(row.institution_type),
            },
            {
                field: "email",
                headerName: "Email",
                minWidth: 190,
                renderCell: (row) => displayValue(row.email),
            },
            {
                field: "phone_number",
                headerName: "Phone",
                minWidth: 130,
                renderCell: (row) => displayValue(row.phone_number),
            },
            {
                field: "city",
                headerName: "City",
                minWidth: 110,
                renderCell: (row) => displayValue(row.city),
            },
            {
                field: "country",
                headerName: "Country",
                minWidth: 110,
                renderCell: (row) => displayValue(row.country),
            },
            {
                field: "is_active",
                headerName: "Status",
                minWidth: 100,
                searchable: false,

                exportValue: (row) =>
                    isActive(row.is_active) ? "Active" : "Inactive",

                renderCell: (row) => {
                    const active = isActive(row.is_active);

                    return (
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.75}
                            sx={{
                                color: active ? "#219e7b" : MUTED,
                            }}
                        >
                            {active ? (
                                <CheckCircleRoundedIcon fontSize="small" />
                            ) : (
                                <CancelRoundedIcon fontSize="small" />
                            )}

                            <Typography variant="body2" fontSize={12}>
                                {active ? "Active" : "Inactive"}
                            </Typography>
                        </Stack>
                    );
                },
            },
        ],
        []
    );

    // -----------------------------------------------------
    // Reusable form field
    // -----------------------------------------------------

    const renderField = (field) => (
        <Grid item xs={12} sm={6} key={field.name}>
            <TextField
                fullWidth
                size="small"
                label={field.label}
                name={field.name}
                type={field.type || "text"}
                value={form[field.name] ?? ""}
                required={Boolean(field.required)}
                disabled={readOnly || saving || detailLoading}
                onChange={(event) =>
                    handleFieldChange(field.name, event.target.value)
                }
                InputProps={
                    field.name === "phone_number"
                        ? {
                              startAdornment: (
                                  <InputAdornment position="start">
                                      +91
                                  </InputAdornment>
                              ),
                          }
                        : undefined
                }
                error={Boolean(formErrors[field.name])}
                helperText={
                    formErrors[field.name] ||
                    (field.name === "phone_number"
                        ? "Enter a 10-digit Indian number; +91 is added automatically."
                        : " ")
                }
                inputProps={{
                    maxLength: FIELD_LIMITS[field.name],
                    inputMode:
                        field.name === "phone_number" ? "numeric" : undefined,
                }}
            />
        </Grid>
    );

    // -----------------------------------------------------
    // Right-side panel
    // -----------------------------------------------------

    const renderInstitutionPanel = () => (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100dvh",
                minHeight: 0,
                maxHeight: "100dvh",
                minWidth: 0,
                overflow: "hidden",
                borderRadius: { xs: 0, sm: "20px 0 0 20px" },
                backgroundColor: "background.paper",
                boxShadow: "-18px 0 55px rgba(21, 18, 48, 0.18)",
            }}
        >
            {/* Panel header */}
            <Box
                sx={{
                    px: { xs: 2, sm: 2.5 },
                    py: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    flex: "0 0 auto",
                }}
            >
                <Box minWidth={0}>
                    <Typography
                        id="institution-panel-title"
                        variant="h6"
                        sx={{
                            fontFamily: FONT_HEADING,
                            fontWeight: 750,
                            fontSize: 18,
                            color: INK,
                        }}
                    >
                        {panelMode === "create"
                            ? "Add Institution"
                            : panelMode === "edit"
                              ? "Edit Institution"
                              : "View Institution"}
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{
                            color: MUTED,
                            mt: 0.4,
                            fontSize: 12,
                        }}
                    >
                        {readOnly
                            ? "Review institution details."
                            : "Complete the details below."}
                    </Typography>
                </Box>

                <Tooltip title="Close panel" arrow>
                    <IconButton
                        onClick={closePanel}
                        disabled={saving}
                        aria-label="Close institution panel"
                        size="small"
                    >
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            <Divider />

            {/* Scrollable content */}
            <Box
                sx={{
                    flex: "1 1 0%",
                    minHeight: 0,
                    minWidth: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    overscrollBehavior: "contain",
                    px: { xs: 2, sm: 2.5 },
                    py: 2.5,
                }}
            >
                {detailLoading ? (
                    <Stack
                        alignItems="center"
                        justifyContent="center"
                        spacing={1.5}
                        sx={{ minHeight: 200 }}
                    >
                        <CircularProgress size={28} />

                        <Typography variant="body2" color="text.secondary">
                            Loading institution details...
                        </Typography>
                    </Stack>
                ) : (
                    <Stack spacing={2.5}>
                        {formErrors.form && (
                            <Alert severity="error">
                                {formErrors.form}
                            </Alert>
                        )}

                        {/* Basic information */}
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontFamily: FONT_HEADING,
                                    fontWeight: 750,
                                    color: INK,
                                    mb: 1.5,
                                }}
                            >
                                Basic Information
                            </Typography>

                            <Grid container spacing={1.5}>
                                {BASIC_FIELDS.map(renderField)}
                            </Grid>
                        </Box>

                        <Divider />

                        {/* Address */}
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontFamily: FONT_HEADING,
                                    fontWeight: 750,
                                    color: INK,
                                    mb: 1.5,
                                }}
                            >
                                Address
                            </Typography>

                            <Grid container spacing={1.5}>
                                {ADDRESS_FIELDS.map(renderField)}
                            </Grid>
                        </Box>

                        <Divider />

                        {/* Branding */}
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontFamily: FONT_HEADING,
                                    fontWeight: 750,
                                    color: INK,
                                    mb: 1.5,
                                }}
                            >
                                Branding and Description
                            </Typography>

                            <Grid container spacing={1.5}>
                                <Grid item xs={12} sm={6}>
                                    <Stack spacing={1}>
                                        <Typography
                                            variant="body2"
                                            fontWeight={600}
                                        >
                                            Institution Logo
                                        </Typography>

                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            spacing={1.5}
                                        >
                                            {logoPreviewUrl || form.logo_url ? (
                                                <Box
                                                    component="img"
                                                    src={
                                                        logoPreviewUrl ||
                                                        form.logo_url
                                                    }
                                                    alt="Institution logo preview"
                                                    sx={{
                                                        width: 56,
                                                        height: 56,
                                                        objectFit: "contain",
                                                        border: "1px solid #e5e7ef",
                                                        borderRadius: 1.5,
                                                        p: 0.5,
                                                        backgroundColor: "#fff",
                                                    }}
                                                />
                                            ) : (
                                                <Box
                                                    sx={{
                                                        width: 56,
                                                        height: 56,
                                                        display: "grid",
                                                        placeItems: "center",
                                                        color: PRIMARY,
                                                        backgroundColor: PRIMARY_LIGHT,
                                                        borderRadius: 1.5,
                                                    }}
                                                >
                                                    <BusinessOutlinedIcon />
                                                </Box>
                                            )}

                                            {!readOnly && (
                                                <Stack spacing={0.5}>
                                                    <Button
                                                        component="label"
                                                        variant="outlined"
                                                        size="small"
                                                        disabled={
                                                            saving ||
                                                            detailLoading
                                                        }
                                                    >
                                                        {logoFile
                                                            ? "Choose another image"
                                                            : form.logo_url
                                                              ? "Replace image"
                                                              : "Upload image"}
                                                        <input
                                                            hidden
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            onChange={
                                                                handleLogoSelection
                                                            }
                                                        />
                                                    </Button>

                                                    {logoFile && (
                                                        <Button
                                                            size="small"
                                                            color="inherit"
                                                            onClick={() => {
                                                                setLogoFile(null);
                                                                setLogoPreviewUrl(
                                                                    ""
                                                                );
                                                            }}
                                                            disabled={
                                                                saving ||
                                                                detailLoading
                                                            }
                                                        >
                                                            Remove selection
                                                        </Button>
                                                    )}
                                                </Stack>
                                            )}
                                        </Stack>

                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            JPG, PNG, or WebP. Maximum size: 5 MB.
                                            {logoFile
                                                ? ` Selected: ${logoFile.name}`
                                                : ""}
                                        </Typography>

                                        {formErrors.logo && (
                                            <Typography
                                                variant="caption"
                                                color="error"
                                            >
                                                {formErrors.logo}
                                            </Typography>
                                        )}
                                    </Stack>
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        multiline
                                        minRows={3}
                                        label="Description"
                                        name="description"
                                        value={form.description ?? ""}
                                        disabled={
                                            readOnly ||
                                            saving ||
                                            detailLoading
                                        }
                                        onChange={(event) =>
                                            handleFieldChange(
                                                "description",
                                                event.target.value
                                            )
                                        }
                                        helperText=" "
                                    />
                                </Grid>
                            </Grid>
                        </Box>

                        <Divider />

                        {/* Status */}
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontFamily: FONT_HEADING,
                                    fontWeight: 750,
                                    color: INK,
                                    mb: 1,
                                }}
                            >
                                Institution Status
                            </Typography>

                            <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                            >
                                <Switch
                                    checked={Boolean(form.is_active)}
                                    disabled={
                                        readOnly || saving || detailLoading
                                    }
                                    onChange={(event) =>
                                        handleFieldChange(
                                            "is_active",
                                            event.target.checked
                                        )
                                    }
                                    color="success"
                                    inputProps={{
                                        "aria-label": "Institution active status",
                                    }}
                                />

                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={0.75}
                                    sx={{
                                        color: form.is_active
                                            ? "#219e7b"
                                            : MUTED,
                                    }}
                                >
                                    {form.is_active ? (
                                        <CheckCircleRoundedIcon fontSize="small" />
                                    ) : (
                                        <CancelRoundedIcon fontSize="small" />
                                    )}

                                    <Typography
                                        variant="body2"
                                        fontWeight={650}
                                    >
                                        {form.is_active ? "Active" : "Inactive"}
                                    </Typography>
                                </Stack>
                            </Stack>
                        </Box>

                        {panelMode === "view" && selectedInstitution && (
                            <>
                                <Divider />

                                <Typography
                                    variant="caption"
                                    sx={{ color: MUTED }}
                                >
                                    Institution ID:{" "}
                                    {displayValue(selectedInstitution.id)}
                                </Typography>
                            </>
                        )}
                    </Stack>
                )}
            </Box>

            <Divider />

            {/* Fixed footer */}
            <Box
                sx={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 1,
                    flexWrap: "wrap",
                    px: { xs: 2, sm: 2.5 },
                    py: 1.5,
                    backgroundColor: "background.paper",
                }}
            >
                <Button
                    variant="outlined"
                    color="inherit"
                    onClick={closePanel}
                    disabled={saving}
                    sx={{
                        borderColor: "divider",
                    }}
                >
                    {readOnly ? "Close" : "Cancel"}
                </Button>

                {!readOnly && (
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={saving || detailLoading}
                        startIcon={
                            saving ? (
                                <CircularProgress
                                    size={16}
                                    color="inherit"
                                />
                            ) : (
                                <SaveOutlinedIcon />
                            )
                        }
                        sx={{
                            backgroundColor: PRIMARY,
                            "&:hover": {
                                backgroundColor: PRIMARY_DARK,
                            },
                        }}
                    >
                        {saving
                            ? "Saving..."
                            : panelMode === "create"
                              ? "Create"
                              : "Save Changes"}
                    </Button>
                )}
            </Box>
        </Box>
    );

    // -----------------------------------------------------
    // Main page
    // -----------------------------------------------------

    return (
        <Box
            sx={{
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                px: { xs: 1.5, sm: 2.5, md: 3 },
                py: { xs: 1.5, sm: 2.5, md: 3 },
                fontFamily: FONT_BODY,
            }}
        >
            {/* Page heading */}
            <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ mb: 3 }}
            >
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 2,
                        backgroundColor: PRIMARY_LIGHT,
                        color: PRIMARY,
                    }}
                >
                    <BusinessOutlinedIcon />
                </Box>

                <Box minWidth={0}>
                    <Typography
                        variant="h5"
                        sx={{
                            fontFamily: FONT_HEADING,
                            fontWeight: 800,
                            color: INK,
                        }}
                    >
                        Institution Management
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{
                            color: MUTED,
                            mt: 0.4,
                        }}
                    >
                        Manage institutions and their contact information.
                    </Typography>
                </Box>
            </Stack>

            {pageError && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={loadInstitutions}
                        >
                            Retry
                        </Button>
                    }
                >
                    {pageError}
                </Alert>
            )}

            {/* The full-width table stays in place while create/edit opens in a right-side drawer. */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: {
                        xs: "column",
                        lg: "row",
                    },
                    alignItems: "flex-start",
                    gap: { xs: 2.5, lg: 2 },
                    width: "100%",
                    minWidth: 0,
                }}
            >
                {/* Left: table */}
                <Box
                    sx={{
                        flex: "1 1 100%",
                        width: "100%",
                        minWidth: 0,
                        maxWidth: "100%",
                        overflow: "hidden",
                        transition: "width 180ms ease",
                    }}
                >
                    <DataTable
                        title="Institutions"
                        rows={rows}
                        columns={columns}
                        loading={loading}
                        error={null}
                        getRowId={(row) => String(row.id)}
                        onAdd={openCreatePanel}
                        onRefresh={loadInstitutions}
                        onView={(row) => openInstitutionPanel(row, "view")}
                        onEdit={(row) => openInstitutionPanel(row, "edit")}
                        onDelete={handleDelete}
                        addLabel="Add Institution"
                        searchPlaceholder="Search institutions..."
                        emptyMessage="No institutions have been added yet."
                        minWidth={850}
                        initialRowsPerPage={10}
                    />
                </Box>

                <Drawer
                    anchor="right"
                    open={panelOpen}
                    onClose={closePanel}
                    aria-labelledby="institution-panel-title"
                    slotProps={{
                        paper: {
                            role: "dialog",
                            "aria-modal": true,
                            sx: {
                                width: { xs: "100vw", sm: 560 },
                                maxWidth: "100vw",
                                height: "100dvh",
                                maxHeight: "100dvh",
                                overflow: "hidden",
                                borderRadius: { xs: 0, sm: "20px 0 0 20px" },
                            },
                        },
                    }}
                >
                    {renderInstitutionPanel()}
                </Drawer>
            </Box>

            {/* Notifications */}
            <Snackbar
                open={notification.open}
                autoHideDuration={4000}
                onClose={closeNotification}
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
            >
                <Alert
                    onClose={closeNotification}
                    severity={notification.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
