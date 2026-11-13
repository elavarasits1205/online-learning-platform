
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Alert,
    Box,
    Button,
    CircularProgress,
    DialogContent,
    Divider,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import SecurityIcon from "@mui/icons-material/Security";

import DataTable from "../../../component/tables/DataTable";
import CrudFormDrawer from "../../../component/forms/CrudFormDrawer";

import {
    getAllPermissions,
    getPermissionById,
    createPermission,
    updatePermission,
    deletePermission,
} from "../../../service/PermissionApi";

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const EMPTY_FORM = {
    code: "",
    moduleCode: "",
    resourceCode: "",
    actionCode: "",
    name: "",
    description: "",
    isActive: true,
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function getErrorMessage(error) {
    return (
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong. Please try again."
    );
}

function normalizeBoolean(value, fallback = true) {
    if (typeof value === "boolean") return value;

    if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
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

    return fallback;
}

function normalizePermission(permission = {}) {
    return {
        ...permission,
        id:
            permission.id === undefined || permission.id === null
                ? ""
                : String(permission.id),
        code: permission.code ?? "",
        moduleCode: permission.moduleCode ?? "",
        resourceCode: permission.resourceCode ?? "",
        actionCode: permission.actionCode ?? "",
        name: permission.name ?? "",
        description: permission.description ?? "",
        isActive: normalizeBoolean(permission.isActive, true),
    };
}

// ---------------------------------------------------------
// Status icon
// ---------------------------------------------------------

function ActiveStatusIcon({ isActive, size = "small" }) {
    const active = normalizeBoolean(isActive, false);

    return (
        <Tooltip title={active ? "Active" : "Inactive"}>
            <Box
                component="span"
                role="img"
                aria-label={active ? "Active" : "Inactive"}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    verticalAlign: "middle",
                }}
            >
                {active ? (
                    <CheckCircleRoundedIcon
                        fontSize={size}
                        sx={{ color: "success.main" }}
                    />
                ) : (
                    <CancelRoundedIcon
                        fontSize={size}
                        sx={{ color: "error.main" }}
                    />
                )}
            </Box>
        </Tooltip>
    );
}

// ---------------------------------------------------------
// Permission form
// ---------------------------------------------------------

function PermissionForm({
    mode,
    row,
    onClose,
    onSuccess,
    onError,
}) {
    const isCreate = mode === "create";
    const isView = mode === "view";
    const isEdit = mode === "edit";

    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Load the selected permission for View and Edit.
    useEffect(() => {
        let cancelled = false;

        async function loadPermission() {
            setFormError("");

            if (isCreate) {
                setForm({ ...EMPTY_FORM });
                setLoadingDetails(false);
                return;
            }

            const permissionId = row?.id;

            if (
                permissionId === undefined ||
                permissionId === null ||
                String(permissionId).trim() === ""
            ) {
                setFormError(
                    "Permission record could not be identified."
                );
                setLoadingDetails(false);
                return;
            }

            setLoadingDetails(true);

            try {
                // Keep PostgreSQL BIGINT IDs as strings.
                const response = await getPermissionById(
                    String(permissionId)
                );

                if (cancelled) return;

                if (!response?.success || !response?.data) {
                    throw new Error(
                        response?.message ||
                            "Unable to retrieve permission details."
                    );
                }

                setForm(normalizePermission(response.data));
            } catch (error) {
                if (!cancelled) {
                    const message = getErrorMessage(error);
                    setFormError(message);
                    onError?.(message);
                }
            } finally {
                if (!cancelled) {
                    setLoadingDetails(false);
                }
            }
        }

        loadPermission();

        return () => {
            cancelled = true;
        };
    }, [row?.id, mode, isCreate, onError]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const validateForm = () => {
        const requiredFields = [
            ["code", "Permission code"],
            ["moduleCode", "Module code"],
            ["resourceCode", "Resource code"],
            ["actionCode", "Action code"],
            ["name", "Permission name"],
        ];

        for (const [field, label] of requiredFields) {
            if (!String(form[field] ?? "").trim()) {
                return `${label} is required.`;
            }
        }

        const limits = {
            code: 150,
            moduleCode: 50,
            resourceCode: 100,
            actionCode: 50,
            name: 150,
        };

        for (const [field, maxLength] of Object.entries(limits)) {
            if (
                String(form[field] ?? "").trim().length > maxLength
            ) {
                return `${field} must not exceed ${maxLength} characters.`;
            }
        }

        if (String(form.description ?? "").length > 10000) {
            return "Description must not exceed 10000 characters.";
        }

        if (typeof form.isActive !== "boolean") {
            return "Permission status must be active or inactive.";
        }

        return "";
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isView || saving || loadingDetails) return;

        const validationError = validateForm();

        if (validationError) {
            setFormError(validationError);
            return;
        }

        setSaving(true);
        setFormError("");

        const payload = {
            code: form.code.trim(),
            moduleCode: form.moduleCode.trim(),
            resourceCode: form.resourceCode.trim(),
            actionCode: form.actionCode.trim(),
            name: form.name.trim(),
            description: form.description.trim(),
            isActive: form.isActive,
        };

        try {
            let response;

            if (isCreate) {
                response = await createPermission(payload);
            } else if (isEdit) {
                const permissionId = row?.id;

                if (
                    permissionId === undefined ||
                    permissionId === null ||
                    String(permissionId).trim() === ""
                ) {
                    throw new Error(
                        "Permission record could not be identified."
                    );
                }

                response = await updatePermission(
                    String(permissionId),
                    payload
                );
            } else {
                return;
            }

            if (!response?.success) {
                throw new Error(
                    response?.message || "Unable to save permission."
                );
            }

            await onSuccess?.(
                response.message ||
                    (isCreate
                        ? "Permission created successfully."
                        : "Permission updated successfully.")
            );
        } catch (error) {
            const message = getErrorMessage(error);
            setFormError(message);
            onError?.(message);
        } finally {
            setSaving(false);
        }
    };

    const readOnly = isView;

    if (loadingDetails) {
        return (
            <Stack
                alignItems="center"
                justifyContent="center"
                spacing={2}
                sx={{ py: 8 }}
            >
                <CircularProgress />

                <Typography color="text.secondary">
                    Loading permission details...
                </Typography>
            </Stack>
        );
    }

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
            }}
        >
            <Stack direction="row" spacing={1.5} alignItems="center">
                <SecurityIcon color="primary" fontSize="large" />

                <Box>
                    <Typography variant="h6" fontWeight={700}>
                        {isCreate
                            ? "Add Permission"
                            : isEdit
                              ? "Edit Permission"
                              : "Permission Details"}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        {isCreate
                            ? "Create a new permission."
                            : isEdit
                              ? "Update the selected permission."
                              : "View the selected permission details."}
                    </Typography>
                </Box>
            </Stack>

            <Divider />

            {formError && (
                <Alert
                    severity="error"
                    onClose={() => setFormError("")}
                >
                    {formError}
                </Alert>
            )}

            <TextField
                label="Permission Code"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                fullWidth
                size="small"
                disabled={readOnly}
                inputProps={{ maxLength: 150 }}
                placeholder="e.g. COURSE_CREATE"
            />

            <TextField
                label="Module Code"
                name="moduleCode"
                value={form.moduleCode}
                onChange={handleChange}
                required
                fullWidth
                size="small"
                disabled={readOnly}
                inputProps={{ maxLength: 50 }}
                placeholder="e.g. COURSE"
            />

            <TextField
                label="Resource Code"
                name="resourceCode"
                value={form.resourceCode}
                onChange={handleChange}
                required
                fullWidth
                size="small"
                disabled={readOnly}
                inputProps={{ maxLength: 100 }}
                placeholder="e.g. COURSE"
            />

            <TextField
                label="Action Code"
                name="actionCode"
                value={form.actionCode}
                onChange={handleChange}
                required
                fullWidth
                size="small"
                disabled={readOnly}
                inputProps={{ maxLength: 50 }}
                placeholder="e.g. CREATE"
            />

            <TextField
                label="Permission Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
                size="small"
                disabled={readOnly}
                inputProps={{ maxLength: 150 }}
                placeholder="e.g. Create Course"
            />

            <TextField
                label="Description"
                name="description"
                value={form.description}
                onChange={handleChange}
                fullWidth
                multiline
                minRows={3}
                size="small"
                disabled={readOnly}
                inputProps={{ maxLength: 10000 }}
                placeholder="Describe what this permission allows."
            />

            <Box
                sx={{
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                >
                    <Box>
                        <Typography fontWeight={600}>
                            Permission Status
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            {form.isActive
                                ? "This permission is active."
                                : "This permission is inactive."}
                        </Typography>
                    </Box>

                    {readOnly ? (
                        <ActiveStatusIcon
                            isActive={form.isActive}
                            size="medium"
                        />
                    ) : (
                        <FormControlLabel
                            sx={{ mr: 0 }}
                            label={form.isActive ? "Active" : "Inactive"}
                            control={
                                <Switch
                                    checked={form.isActive}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            isActive: event.target.checked,
                                        }))
                                    }
                                    color="success"
                                />
                            }
                        />
                    )}
                </Stack>
            </Box>

            <Divider sx={{ mt: 1 }} />

            <Stack
                direction="row"
                spacing={1.5}
                justifyContent="flex-end"
                sx={{ pb: 1 }}
            >
                <Button
                    variant="outlined"
                    onClick={onClose}
                    disabled={saving}
                >
                    {isView ? "Close" : "Cancel"}
                </Button>

                {!isView && (
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={saving || loadingDetails}
                        startIcon={
                            saving ? (
                                <CircularProgress
                                    size={16}
                                    color="inherit"
                                />
                            ) : undefined
                        }
                    >
                        {saving
                            ? "Saving..."
                            : isCreate
                              ? "Create Permission"
                              : "Save Changes"}
                    </Button>
                )}
            </Stack>
        </Box>
    );
}

// ---------------------------------------------------------
// Permission Management Page
// ---------------------------------------------------------

export default function PermissionManagementPage() {
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [pageSuccess, setPageSuccess] = useState("");

    // Dialog state controlled by this page.
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState("create");
    const [selectedPermission, setSelectedPermission] = useState(null);

    const loadPermissions = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            const response = await getAllPermissions();

            if (!response?.success) {
                throw new Error(
                    response?.message || "Unable to load permissions."
                );
            }

            setPermissions(
                Array.isArray(response.data)
                    ? response.data.map(normalizePermission)
                    : []
            );
        } catch (error) {
            setPageError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    const handleFormError = useCallback((message) => {
        setPageError(message);
    }, []);

    const openPermissionDialog = useCallback((mode, permission = null) => {
        setPageError("");
        setPageSuccess("");
        setDialogMode(mode);
        setSelectedPermission(
            permission ? normalizePermission(permission) : null
        );
        setDialogOpen(true);
    }, []);

    const closePermissionDialog = useCallback(() => {
        setDialogOpen(false);
        setSelectedPermission(null);
        setDialogMode("create");
    }, []);

    const handleAdd = useCallback(() => {
        openPermissionDialog("create");
    }, [openPermissionDialog]);

    const handleView = useCallback(
        (permission) => {
            openPermissionDialog("view", permission);
        },
        [openPermissionDialog]
    );

    const handleEdit = useCallback(
        (permission) => {
            openPermissionDialog("edit", permission);
        },
        [openPermissionDialog]
    );

    const handleDelete = useCallback(
        async (permission) => {
            if (
                permission?.id === undefined ||
                permission?.id === null ||
                String(permission.id).trim() === ""
            ) {
                setPageError(
                    "Permission record could not be identified."
                );
                return;
            }

            const confirmed = window.confirm(
                `Are you sure you want to delete "${permission.name}" (${permission.code})?`
            );

            if (!confirmed) return;

            setPageError("");
            setPageSuccess("");

            try {
                const response = await deletePermission(
                    String(permission.id)
                );

                if (!response?.success) {
                    throw new Error(
                        response?.message || "Unable to delete permission."
                    );
                }

                setPageSuccess(
                    response.message ||
                        "Permission deleted successfully."
                );

                await loadPermissions();
            } catch (error) {
                setPageError(getErrorMessage(error));
            }
        },
        [loadPermissions]
    );

    const handleFormSuccess = useCallback(
        async (message) => {
            // Refresh records before closing the form.
            await loadPermissions();

            setPageSuccess(message);
            setPageError("");
            closePermissionDialog();
        },
        [loadPermissions, closePermissionDialog]
    );

    const columns = useMemo(
        () => [
            {
                field: "code",
                headerName: "Permission Code",
                minWidth: 170,
            },
            {
                field: "moduleCode",
                headerName: "Module",
                minWidth: 120,
            },
            {
                field: "resourceCode",
                headerName: "Resource",
                minWidth: 130,
            },
            {
                field: "actionCode",
                headerName: "Action",
                minWidth: 110,
            },
            {
                field: "name",
                headerName: "Permission Name",
                minWidth: 180,
            },
            {
                field: "description",
                headerName: "Description",
                minWidth: 200,
                valueGetter: (row) => row?.description || "—",
                exportValue: (row) => row?.description || "",
            },
            {
                field: "isActive",
                headerName: "Status",
                minWidth: 90,
                align: "center",
                headerAlign: "center",
                searchable: false,
                exportValue: (row) =>
                    normalizeBoolean(row?.isActive, false)
                        ? "Active"
                        : "Inactive",
                renderCell: (row) => (
                    <ActiveStatusIcon
                        isActive={row?.isActive}
                        size="small"
                    />
                ),
            },
        ],
        []
    );

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 3 }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <SecurityIcon color="primary" sx={{ fontSize: 34 }} />

                    <Box>
                        <Typography variant="h5" fontWeight={700}>
                            Permission Management
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            Manage application modules, resources, and actions.
                        </Typography>
                    </Box>
                </Stack>
            </Stack>

            {pageError && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    onClose={() => setPageError("")}
                >
                    {pageError}
                </Alert>
            )}

            {pageSuccess && (
                <Alert
                    severity="success"
                    sx={{ mb: 2 }}
                    onClose={() => setPageSuccess("")}
                >
                    {pageSuccess}
                </Alert>
            )}

            <DataTable
                title="Permission Records"
                columns={columns}
                rows={permissions}
                loading={loading}
                getRowId={(permission) => String(permission.id)}
                onAdd={handleAdd}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={loadPermissions}
                addLabel="Add Permission"
                pagination
                minWidth={1200}
                emptyMessage="No permissions have been created yet."
            />

            {/* View / Edit / Add dialog */}
            <CrudFormDrawer
                open={dialogOpen}
                onClose={(_event, reason) => {
                    if (reason === "backdropClick") return;
                    closePermissionDialog();
                }}
                fullWidth
                maxWidth="sm"
                scroll="paper"
                aria-labelledby="permission-dialog-title"
            >
                <DialogContent
                    sx={{
                        p: { xs: 2, sm: 3 },
                    }}
                >
                    <PermissionForm
                        key={`${dialogMode}-${selectedPermission?.id ?? "new"}`}
                        mode={dialogMode}
                        row={selectedPermission}
                        onClose={closePermissionDialog}
                        onError={handleFormError}
                        onSuccess={handleFormSuccess}
                    />
                </DialogContent>
            </CrudFormDrawer>
        </Box>
    );
}
