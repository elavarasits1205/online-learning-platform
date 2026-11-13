import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControlLabel,
    IconButton,
    Snackbar,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import DataTable from "../../component/tables/DataTable";

import {
    getAllRoles,
    createRole,
    updateRole,
    deleteRole,
} from "../../service/RoleApi";

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const EMPTY_FORM = {
    code: "",
    name: "",
    description: "",
    isActive: true,
};

const FONT_BODY = "var(--font-body, 'DM Sans', sans-serif)";
const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";
const PRIMARY = "var(--color-primary, #6d4aff)";
const PRIMARY_DARK = "var(--color-primary-dark, #5134d7)";
const MUTED = "var(--color-muted, #6e7086)";

// ---------------------------------------------------------
// API response helpers
// ---------------------------------------------------------

function getErrorMessage(error) {
    return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Something went wrong. Please try again."
    );
}

function extractRoleList(result) {
    if (Array.isArray(result)) {
        return result;
    }

    if (Array.isArray(result?.data)) {
        return result.data;
    }

    if (Array.isArray(result?.roles)) {
        return result.roles;
    }

    if (Array.isArray(result?.data?.data)) {
        return result.data.data;
    }

    if (Array.isArray(result?.data?.roles)) {
        return result.data.roles;
    }

    if (Array.isArray(result?.data?.data?.roles)) {
        return result.data.data.roles;
    }

    return [];
}

function toBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value === 1;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        if (["true", "1", "yes", "active"].includes(normalized)) {
            return true;
        }

        if (["false", "0", "no", "inactive"].includes(normalized)) {
            return false;
        }
    }

    return defaultValue;
}

// Keep PostgreSQL BIGINT IDs as strings.
function normalizeRole(role) {
    return {
        ...role,
        id: role?.id == null ? "" : String(role.id),
        code: String(role?.code ?? role?.role_code ?? ""),
        name: String(role?.name ?? role?.role_name ?? ""),
        description: String(role?.description ?? ""),
        isActive: toBoolean(
            role?.isActive ?? role?.is_active,
            true
        ),
        softDelete: toBoolean(
            role?.softDelete ?? role?.soft_delete,
            false
        ),
    };
}

function getRoleStatus(isActive) {
    return toBoolean(isActive) ? "Active" : "Inactive";
}

function displayValue(value) {
    return value === null || value === undefined || value === ""
        ? "-"
        : String(value);
}

function normalizeForComparison(value) {
    return String(value ?? "").trim().toLowerCase();
}

function compareRoleIds(first, second) {
    const firstId = String(first?.id ?? "");
    const secondId = String(second?.id ?? "");

    if (
        /^[1-9]\d*$/.test(firstId) &&
        /^[1-9]\d*$/.test(secondId)
    ) {
        const a = BigInt(firstId);
        const b = BigInt(secondId);

        if (a < b) return -1;
        if (a > b) return 1;

        return 0;
    }

    return firstId.localeCompare(secondId);
}

// ---------------------------------------------------------
// Reusable detail components
// ---------------------------------------------------------

function RoleDetail({ label, value }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography
                variant="body2"
                sx={{
                    color: MUTED,
                    mb: 0.75,
                    fontFamily: FONT_BODY,
                }}
            >
                {label}
            </Typography>

            <Typography
                variant="body1"
                sx={{
                    color: "text.primary",
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-wrap",
                    fontFamily: FONT_BODY,
                }}
            >
                {displayValue(value)}
            </Typography>
        </Box>
    );
}

function RoleStatus({ isActive }) {
    const active = toBoolean(isActive, false);

    return (
        <Box>
            <Typography
                variant="body2"
                sx={{ color: MUTED, mb: 0.75 }}
            >
                Status
            </Typography>

            <Chip
                size="small"
                icon={
                    active ? (
                        <CheckCircleIcon />
                    ) : (
                        <CancelIcon />
                    )
                }
                label={getRoleStatus(active)}
                color={active ? "success" : "error"}
                variant="outlined"
                sx={{
                    minWidth: 105,
                    fontWeight: 600,
                    "& .MuiChip-icon": {
                        fontSize: 18,
                    },
                }}
            />
        </Box>
    );
}

// ---------------------------------------------------------
// Role Management Page
// ---------------------------------------------------------

export default function RoleManagementPage() {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pageError, setPageError] = useState("");

    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [formErrors, setFormErrors] = useState({});
    const [selectedRole, setSelectedRole] = useState(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState("create");

    const [notification, setNotification] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const isFormMode =
        drawerMode === "create" || drawerMode === "edit";

    const isReadOnly = drawerMode === "view";

    const drawerTitle = {
        create: "Add Role",
        view: "Role Details",
        edit: "Edit Role",
        delete: "Delete Role",
    }[drawerMode];

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

    const closeNotification = useCallback((_event, reason) => {
        if (reason === "clickaway") return;

        setNotification((current) => ({
            ...current,
            open: false,
        }));
    }, []);

    // -----------------------------------------------------
    // Load roles from backend
    // -----------------------------------------------------

    const loadRoles = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            const result = await getAllRoles();

            const roleList = extractRoleList(result)
                .map(normalizeRole)
                .filter((role) => role.id && !role.softDelete)
                .sort(compareRoleIds);

            setRoles(roleList);

            return roleList;
        } catch (error) {
            console.error("Failed to load roles:", error);

            const message = getErrorMessage(error);

            setPageError(message);
            setRoles([]);

            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRoles();
    }, [loadRoles]);

    // -----------------------------------------------------
    // Open Add panel
    // -----------------------------------------------------

    const handleAdd = useCallback(() => {
        setSelectedRole(null);
        setForm({ ...EMPTY_FORM });
        setFormErrors({});
        setDrawerMode("create");
        setDrawerOpen(true);
    }, []);

    // -----------------------------------------------------
    // Open View panel
    // -----------------------------------------------------

    const handleView = useCallback((row) => {
        const role = normalizeRole(row);

        setSelectedRole(role);

        setForm({
            code: role.code,
            name: role.name,
            description: role.description,
            isActive: role.isActive,
        });

        setFormErrors({});
        setDrawerMode("view");
        setDrawerOpen(true);
    }, []);

    // -----------------------------------------------------
    // Open Edit panel
    // -----------------------------------------------------

    const handleEdit = useCallback((row) => {
        const role = normalizeRole(row);

        setSelectedRole(role);

        setForm({
            code: role.code,
            name: role.name,
            description: role.description,
            isActive: role.isActive,
        });

        setFormErrors({});
        setDrawerMode("edit");
        setDrawerOpen(true);
    }, []);

    // -----------------------------------------------------
    // Open Delete confirmation panel
    // -----------------------------------------------------

    const handleDelete = useCallback((row) => {
        setSelectedRole(normalizeRole(row));
        setFormErrors({});
        setDrawerMode("delete");
        setDrawerOpen(true);
    }, []);

    // -----------------------------------------------------
    // Close right-side panel
    // -----------------------------------------------------

    const closeDrawer = useCallback(() => {
        if (saving) return;

        setDrawerOpen(false);
        setSelectedRole(null);
        setForm({ ...EMPTY_FORM });
        setFormErrors({});
        setDrawerMode("create");
    }, [saving]);

    // -----------------------------------------------------
    // Form handlers
    // -----------------------------------------------------

    const handleFormChange = useCallback((event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));

        setFormErrors((previous) => {
            const next = { ...previous };

            delete next[name];
            delete next.submit;

            return next;
        });
    }, []);

    const handleActiveChange = useCallback((event) => {
        setForm((previous) => ({
            ...previous,
            isActive: event.target.checked,
        }));
    }, []);

    // -----------------------------------------------------
    // Validation
    // -----------------------------------------------------

    const validateForm = useCallback(() => {
        const errors = {};

        const code = form.code.trim();
        const name = form.name.trim();
        const description = form.description.trim();

        if (!code) {
            errors.code = "Role code is required.";
        } else if (code.length > 50) {
            errors.code = "Role code cannot exceed 50 characters.";
        }

        if (!name) {
            errors.name = "Role name is required.";
        } else if (name.length > 100) {
            errors.name = "Role name cannot exceed 100 characters.";
        }

        if (description.length > 10000) {
            errors.description =
                "Description cannot exceed 10000 characters.";
        }

        const editingId =
            drawerMode === "edit"
                ? String(selectedRole?.id ?? "")
                : "";

        const otherRoles = roles.filter(
            (role) => String(role.id) !== editingId
        );

        if (
            code &&
            otherRoles.some(
                (role) =>
                    normalizeForComparison(role.code) ===
                    normalizeForComparison(code)
            )
        ) {
            errors.code = "This role code already exists.";
        }

        if (
            name &&
            otherRoles.some(
                (role) =>
                    normalizeForComparison(role.name) ===
                    normalizeForComparison(name)
            )
        ) {
            errors.name = "This role name already exists.";
        }

        setFormErrors(errors);

        return Object.keys(errors).length === 0;
    }, [form, roles, drawerMode, selectedRole]);

    // -----------------------------------------------------
    // Create / Update
    // -----------------------------------------------------

    const handleSubmit = useCallback(
        async (event) => {
            event.preventDefault();

            if (saving || !isFormMode) return;
            if (!validateForm()) return;

            const isEditing = drawerMode === "edit";

            if (isEditing && !selectedRole?.id) {
                notify(
                    "Cannot update the role because its ID is missing.",
                    "error"
                );
                return;
            }

            const payload = {
                code: form.code.trim().toUpperCase(),
                name: form.name.trim(),
                description: form.description.trim() || null,
                isActive: Boolean(form.isActive),
            };

            setSaving(true);

            try {
                if (isEditing) {
                    await updateRole(
                        String(selectedRole.id),
                        payload
                    );
                } else {
                    await createRole(payload);
                }

                await loadRoles();

                setDrawerOpen(false);
                setSelectedRole(null);
                setForm({ ...EMPTY_FORM });
                setFormErrors({});
                setDrawerMode("create");

                notify(
                    isEditing
                        ? "Role updated successfully."
                        : "Role created successfully."
                );
            } catch (error) {
                console.error("Failed to save role:", error);

                const message = getErrorMessage(error);

                setFormErrors((previous) => ({
                    ...previous,
                    submit: message,
                }));

                notify(message, "error");
            } finally {
                setSaving(false);
            }
        },
        [
            saving,
            isFormMode,
            validateForm,
            drawerMode,
            selectedRole,
            form,
            loadRoles,
            notify,
        ]
    );

    // -----------------------------------------------------
    // Confirm Delete
    // -----------------------------------------------------

    const confirmDelete = useCallback(async () => {
        if (saving) return;

        if (!selectedRole?.id) {
            notify(
                "Cannot delete the role because its ID is missing.",
                "error"
            );
            return;
        }

        setSaving(true);

        try {
            await deleteRole(String(selectedRole.id));
            await loadRoles();

            setDrawerOpen(false);
            setSelectedRole(null);
            setFormErrors({});
            setDrawerMode("create");

            notify("Role deleted successfully.");
        } catch (error) {
            console.error("Failed to delete role:", error);
            notify(getErrorMessage(error), "error");
        } finally {
            setSaving(false);
        }
    }, [saving, selectedRole, loadRoles, notify]);

    // -----------------------------------------------------
    // Table rows
    // -----------------------------------------------------

    const tableRows = useMemo(
        () =>
            [...roles]
                .sort(compareRoleIds)
                .map((role, index) => ({
                    ...role,
                    serialNumber: index + 1,
                    status: getRoleStatus(role.isActive),
                })),
        [roles]
    );

    // -----------------------------------------------------
    // Table columns
    // -----------------------------------------------------

    const columns = useMemo(
        () => [
            {
                field: "serialNumber",
                headerName: "S.No.",
                minWidth: 75,
                align: "center",
                searchable: false,
                sortable: false,
                filterable: false,
                exportable: false,
            },
            {
                field: "code",
                headerName: "Role Code",
                minWidth: 140,
            },
            {
                field: "name",
                headerName: "Role Name",
                minWidth: 170,
            },
            {
                field: "description",
                headerName: "Description",
                minWidth: 240,
                renderCell: (row) => (
                    <Typography
                        variant="body2"
                        sx={{
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                            minWidth: 0,
                        }}
                    >
                        {displayValue(row?.description)}
                    </Typography>
                ),
            },
            {
                field: "status",
                headerName: "Status",
                minWidth: 95,
                align: "center",
                searchable: true,
                sortable: true,
                renderCell: (row) => {
                    const active = toBoolean(row?.isActive, false);

                    return (
                        <Tooltip
                            title={active ? "Active" : "Inactive"}
                            arrow
                        >
                            <Box
                                component="span"
                                role="img"
                                aria-label={
                                    active ? "Active" : "Inactive"
                                }
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    lineHeight: 0,
                                }}
                            >
                                {active ? (
                                    <CheckCircleIcon
                                        sx={{
                                            color: "#16a34a",
                                            fontSize: 22,
                                        }}
                                    />
                                ) : (
                                    <CancelIcon
                                        sx={{
                                            color: "#dc2626",
                                            fontSize: 22,
                                        }}
                                    />
                                )}
                            </Box>
                        </Tooltip>
                    );
                },
                exportValue: (row) =>
                    getRoleStatus(row?.isActive),
            },
        ],
        []
    );

    // -----------------------------------------------------
    // Render
    // -----------------------------------------------------

    return (
        <Box
            sx={{
                width: "100%",
                minWidth: 0,
                mt: 1,
                mx: 0,
                px: { xs: 1, sm: 2 },
                pb: 2,
                boxSizing: "border-box",
                fontFamily: FONT_BODY,
                color: "var(--color-ink, #17152b)",
            }}
        >
            {/* Page heading */}
            <Box sx={{ mb: 2.5 }}>
                <Typography
                    variant="h5"
                    sx={{
                        fontFamily: FONT_HEADING,
                        fontWeight: 750,
                    }}
                >
                    Role Management
                </Typography>

                <Typography
                    variant="body2"
                    sx={{ color: MUTED, mt: 0.5 }}
                >
                    Create, view, update, and manage platform roles.
                </Typography>
            </Box>

            {/* Load error */}
            {pageError && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={loadRoles}
                        >
                            Retry
                        </Button>
                    }
                >
                    {pageError}
                </Alert>
            )}

            {/* Shared DataTable */}
            <DataTable
                title="Roles"
                columns={columns}
                rows={tableRows}
                loading={loading}
                getRowId={(role) => String(role.id)}
                onAdd={handleAdd}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={loadRoles}
                addLabel="Add Role"
                addIcon={<AddIcon />}
                searchPlaceholder="Search roles..."
                emptyMessage="No roles found."
                minWidth={820}
                pagination
            />

            {/* Right-side responsive panel */}
            {drawerOpen && (
                <Box
                    sx={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 1300,
                        display: "flex",
                        justifyContent: "flex-end",
                        overflow: "hidden",
                    }}
                >
                    {/* Backdrop */}
                    <Box
                        onClick={closeDrawer}
                        aria-hidden="true"
                        sx={{
                            position: "absolute",
                            inset: 0,
                            bgcolor: "rgba(15, 12, 30, 0.38)",
                        }}
                    />

                    {/* Panel */}
                    <Box
                        role="dialog"
                        aria-modal="true"
                        aria-label={drawerTitle}
                        sx={{
                            position: "relative",
                            zIndex: 1,
                            display: "flex",
                            flexDirection: "column",
                            width: {
                                xs: "100%",
                                sm: 460,
                                md: 520,
                            },
                            maxWidth: "100vw",
                            height: "100%",
                            minWidth: 0,
                            minHeight: 0,
                            boxSizing: "border-box",
                            bgcolor: "background.paper",
                            boxShadow: 8,
                            overflow: "hidden",
                        }}
                    >
                        {/* Panel header */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 2,
                                px: { xs: 2, sm: 3 },
                                py: 2.25,
                                flex: "0 0 auto",
                                borderBottom: 1,
                                borderColor: "divider",
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontFamily: FONT_HEADING,
                                        fontWeight: 750,
                                    }}
                                >
                                    {drawerTitle}
                                </Typography>

                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: MUTED,
                                        mt: 0.5,
                                    }}
                                >
                                    {drawerMode === "create"
                                        ? "Enter the details for the new role."
                                        : drawerMode === "edit"
                                          ? "Update the role information."
                                          : drawerMode === "view"
                                            ? "Review the selected role information."
                                            : "Review the role details before deleting it."}
                                </Typography>
                            </Box>

                            <Tooltip title="Close" arrow>
                                <span>
                                    <IconButton
                                        onClick={closeDrawer}
                                        disabled={saving}
                                        aria-label="Close role panel"
                                        size="small"
                                    >
                                        <CloseIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>

                        {/* Scrollable panel content */}
                        <Box
                            sx={{
                                px: { xs: 2, sm: 3 },
                                py: 3,
                                flex: "1 1 0%",
                                minHeight: 0,
                                minWidth: 0,
                                overflowY: "auto",
                                overflowX: "hidden",
                                overscrollBehavior: "contain",
                            }}
                        >
                            {/* Add / Edit form */}
                            {isFormMode && (
                                <Box
                                    component="form"
                                    id="role-form"
                                    onSubmit={handleSubmit}
                                    noValidate
                                >
                                    <Stack spacing={2.5}>
                                        {formErrors.submit && (
                                            <Alert severity="error">
                                                {formErrors.submit}
                                            </Alert>
                                        )}

                                        <TextField
                                            name="code"
                                            label="Role Code"
                                            value={form.code}
                                            onChange={handleFormChange}
                                            error={Boolean(formErrors.code)}
                                            helperText={
                                                formErrors.code ||
                                                "Example: STUDENT, INSTRUCTOR, ADMIN"
                                            }
                                            required
                                            fullWidth
                                            size="small"
                                            inputProps={{
                                                maxLength: 50,
                                            }}
                                            disabled={saving}
                                        />

                                        <TextField
                                            name="name"
                                            label="Role Name"
                                            value={form.name}
                                            onChange={handleFormChange}
                                            error={Boolean(formErrors.name)}
                                            helperText={
                                                formErrors.name || " "
                                            }
                                            required
                                            fullWidth
                                            size="small"
                                            inputProps={{
                                                maxLength: 100,
                                            }}
                                            disabled={saving}
                                        />

                                        <TextField
                                            name="description"
                                            label="Description"
                                            value={form.description}
                                            onChange={handleFormChange}
                                            error={Boolean(
                                                formErrors.description
                                            )}
                                            helperText={
                                                formErrors.description || " "
                                            }
                                            fullWidth
                                            multiline
                                            minRows={4}
                                            inputProps={{
                                                maxLength: 10000,
                                            }}
                                            disabled={saving}
                                        />

                                        <Divider />

                                        <Box>
                                            <Typography
                                                variant="subtitle2"
                                                sx={{
                                                    fontWeight: 700,
                                                    mb: 0.5,
                                                }}
                                            >
                                                Role Status
                                            </Typography>

                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={Boolean(
                                                            form.isActive
                                                        )}
                                                        onChange={
                                                            handleActiveChange
                                                        }
                                                        disabled={saving}
                                                        color="success"
                                                    />
                                                }
                                                label={
                                                    form.isActive
                                                        ? "Role is active"
                                                        : "Role is inactive"
                                                }
                                            />
                                        </Box>
                                    </Stack>
                                </Box>
                            )}

                            {/* View details: Role ID removed */}
                            {isReadOnly && selectedRole && (
                                <Stack spacing={2.75}>
                                    <RoleDetail
                                        label="Role Code"
                                        value={selectedRole.code}
                                    />

                                    <RoleDetail
                                        label="Role Name"
                                        value={selectedRole.name}
                                    />

                                    <RoleDetail
                                        label="Description"
                                        value={selectedRole.description}
                                    />

                                    <RoleStatus
                                        isActive={selectedRole.isActive}
                                    />
                                </Stack>
                            )}

                            {/* Delete confirmation: Role ID removed */}
                            {drawerMode === "delete" && selectedRole && (
                                <Stack spacing={2.5}>
                                    <Alert severity="warning">
                                        Are you sure you want to delete this
                                        role? The role will be soft-deleted
                                        and will no longer appear in the
                                        active role list.
                                    </Alert>

                                    <RoleDetail
                                        label="Role Code"
                                        value={selectedRole.code}
                                    />

                                    <RoleDetail
                                        label="Role Name"
                                        value={selectedRole.name}
                                    />

                                    <RoleDetail
                                        label="Description"
                                        value={selectedRole.description}
                                    />

                                    <RoleStatus
                                        isActive={selectedRole.isActive}
                                    />
                                </Stack>
                            )}
                        </Box>

                        {/* Fixed footer */}
                        <Divider />

                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: 1,
                                flexWrap: "wrap",
                                px: { xs: 2, sm: 3 },
                                py: 2,
                                flex: "0 0 auto",
                                borderTop: 1,
                                borderColor: "divider",
                                bgcolor: "background.paper",
                            }}
                        >
                            <Button
                                color="inherit"
                                onClick={closeDrawer}
                                disabled={saving}
                                sx={{ textTransform: "none" }}
                            >
                                {isReadOnly ? "Close" : "Cancel"}
                            </Button>

                            {isFormMode && (
                                <Button
                                    type="submit"
                                    form="role-form"
                                    variant="contained"
                                    disabled={saving}
                                    startIcon={
                                        saving ? (
                                            <CircularProgress
                                                size={16}
                                                color="inherit"
                                            />
                                        ) : drawerMode === "edit" ? (
                                            <SaveOutlinedIcon />
                                        ) : (
                                            <AddIcon />
                                        )
                                    }
                                    sx={{
                                        textTransform: "none",
                                        bgcolor: PRIMARY,
                                        "&:hover": {
                                            bgcolor: PRIMARY_DARK,
                                        },
                                    }}
                                >
                                    {saving
                                        ? "Saving..."
                                        : drawerMode === "edit"
                                          ? "Save Changes"
                                          : "Create Role"}
                                </Button>
                            )}

                            {drawerMode === "delete" && (
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={confirmDelete}
                                    disabled={saving}
                                    startIcon={
                                        saving ? (
                                            <CircularProgress
                                                size={16}
                                                color="inherit"
                                            />
                                        ) : (
                                            <DeleteOutlineOutlinedIcon />
                                        )
                                    }
                                    sx={{ textTransform: "none" }}
                                >
                                    {saving
                                        ? "Deleting..."
                                        : "Delete Role"}
                                </Button>
                            )}
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Notifications */}
            <Snackbar
                open={notification.open}
                autoHideDuration={4000}
                onClose={closeNotification}
                anchorOrigin={{
                    vertical: "bottom",
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
