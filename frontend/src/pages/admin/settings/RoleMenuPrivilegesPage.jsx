import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    Alert,
    Avatar,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    InputAdornment,
    InputLabel,
    IconButton,
    MenuItem,
    Pagination,
    Paper,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import HighlightOffRoundedIcon from "@mui/icons-material/HighlightOffRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import {
    getRoles,
    getPermissions,
    getRolePermissions,
    saveRolePrivileges,
} from "../../../service/roleMenuApi";

// =========================================================
// Helpers
// =========================================================

const normalizeId = (value) => {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    // Preserve PostgreSQL BIGINT identifiers as strings.
    return String(value);
};

const normalizeCode = (value) =>
    String(value ?? "")
        .trim()
        .toUpperCase();

const isEnabled = (value) =>
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true";

const getArray = (response) => {
    if (Array.isArray(response)) return response;

    const candidates = [
        response?.data?.data,
        response?.data,
        response?.items,
        response?.rows,
        response?.results,
    ];

    return candidates.find(Array.isArray) ?? [];
};

const getPermissionId = (permission) =>
    normalizeId(
        permission?.id ??
        permission?.permissionId ??
        permission?.permission_id
    );

const getRoleId = (role) =>
    normalizeId(
        role?.id ??
        role?.roleId ??
        role?.role_id
    );

const getRoleName = (role) =>
    role?.name ??
    role?.roleName ??
    role?.role_name ??
    role?.code ??
    getRoleId(role) ??
    "Unnamed role";

const getRoleCode = (role) =>
    normalizeCode(
        role?.code ??
        role?.roleCode ??
        role?.role_code ??
        role?.name ??
        role?.roleName ??
        role?.role_name
    );

const isAdminRole = (role) => {
    const identifiers = [
        role?.code,
        role?.roleCode,
        role?.role_code,
        role?.name,
        role?.roleName,
        role?.role_name,
    ];

    return identifiers.some((identifier) => {
        const normalized = normalizeCode(identifier);
        return /(^|[^A-Z0-9])ADMIN(ISTRATOR)?($|[^A-Z0-9])/.test(normalized);
    });
};

const getModuleName = (permission) => {
    const module = permission?.module;

    if (typeof module === "string") return module;

    return (
        module?.name ??
        module?.code ??
        permission?.moduleName ??
        permission?.module_name ??
        permission?.moduleCode ??
        permission?.module_code ??
        "Unassigned"
    );
};

const getResourceName = (permission) => {
    const resource = permission?.resource;

    if (typeof resource === "string") return resource;

    return (
        resource?.name ??
        resource?.code ??
        permission?.resourceName ??
        permission?.resource_name ??
        permission?.resourceCode ??
        permission?.resource_code ??
        "Unassigned"
    );
};

const getActionName = (permission) => {
    const action = permission?.action;

    if (action && typeof action === "object") {
        return action.name ?? action.code ?? "Unspecified";
    }

    return (
        permission?.actionName ??
        permission?.action_name ??
        permission?.actionCode ??
        permission?.action_code ??
        action ??
        "Unspecified"
    );
};

const getPermissionLabel = (permission) =>
    permission?.name ??
    permission?.permissionName ??
    permission?.permission_name ??
    permission?.code ??
    permission?.permissionCode ??
    permission?.permission_code ??
    "Unnamed permission";

const getPermissionCode = (permission) =>
    permission?.code ??
    permission?.permissionCode ??
    permission?.permission_code ??
    "";

const getAssignmentPermissionId = (assignment) =>
    normalizeId(
        assignment?.permissionId ??
        assignment?.permission_id ??
        assignment?.permission?.id
    );

const isSoftDeleted = (item) =>
    isEnabled(item?.softDelete ?? item?.soft_delete) ||
    item?.deletedAt != null ||
    item?.deleted_at != null;

const isManageableRole = (role) =>
    Boolean(getRoleId(role)) &&
    !isAdminRole(role) &&
    !isSoftDeleted(role) &&
    isEnabled(role?.isActive ?? role?.is_active ?? true);

const isPermissionActive = (permission) =>
    isEnabled(
        permission?.isActive ??
        permission?.is_active ??
        true
    );

const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message ??
    error?.message ??
    fallback;

// =========================================================
// Component
// =========================================================

export default function RoleMenuPrivilegesPage() {
    const navigate = useNavigate();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [assignments, setAssignments] = useState([]);

    const [selectedRoleId, setSelectedRoleId] = useState("");
    const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);

    const [searchText, setSearchText] = useState("");
    const [moduleFilter, setModuleFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const requestVersionRef = useRef(0);
    const selectedRoleIdRef = useRef("");

    // -----------------------------------------------------
    // Derived data
    // -----------------------------------------------------

    const activePermissions = useMemo(
        () => permissions.filter(
            (permission) => !isSoftDeleted(permission)
        ),
        [permissions]
    );

    const modules = useMemo(
        () =>
            [...new Set(activePermissions.map(getModuleName))]
                .sort((a, b) => String(a).localeCompare(String(b))),
        [activePermissions]
    );

    const selectedRole = roles.find(
        (role) => getRoleId(role) === selectedRoleId
    );

    const selectedRoleName = selectedRole
        ? getRoleName(selectedRole)
        : "No role selected";

    const filteredPermissions = useMemo(() => {
        const query = searchText.trim().toLowerCase();

        return activePermissions.filter((permission) => {
            const moduleName = getModuleName(permission);
            const resourceName = getResourceName(permission);
            const actionName = getActionName(permission);
            const permissionName = getPermissionLabel(permission);
            const code = getPermissionCode(permission);
            const isActive = isPermissionActive(permission);
            const id = getPermissionId(permission);
            const isGranted = selectedPermissionIds.includes(id);

            if (
                moduleFilter !== "ALL" &&
                moduleName !== moduleFilter
            ) {
                return false;
            }

            if (statusFilter === "GRANTED" && !isGranted) {
                return false;
            }

            if (statusFilter === "NOT_GRANTED" && isGranted) {
                return false;
            }

            if (statusFilter === "INACTIVE" && isActive) {
                return false;
            }

            if (!query) return true;

            const searchableText = [
                moduleName,
                resourceName,
                actionName,
                permissionName,
                code,
                id,
            ]
                .map((value) => String(value ?? ""))
                .join(" ")
                .toLowerCase();

            return searchableText.includes(query);
        });
    }, [
        activePermissions,
        searchText,
        moduleFilter,
        statusFilter,
        selectedPermissionIds,
    ]);

    const pageCount = Math.ceil(
        filteredPermissions.length / rowsPerPage
    );

    const effectivePage = Math.min(
        page,
        Math.max(0, pageCount - 1)
    );

    const displayedPermissions = useMemo(() => {
        const start = effectivePage * rowsPerPage;

        return filteredPermissions.slice(
            start,
            start + rowsPerPage
        );
    }, [filteredPermissions, effectivePage, rowsPerPage]);

    const displayedPermissionGroups = useMemo(() => {
        const groups = new Map();

        displayedPermissions.forEach((permission) => {
            const moduleName = getModuleName(permission);
            if (!groups.has(moduleName)) {
                groups.set(moduleName, []);
            }
            groups.get(moduleName).push(permission);
        });

        return [...groups.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([moduleName, modulePermissions]) => ({
                moduleName,
                permissions: modulePermissions,
            }));
    }, [displayedPermissions]);

    const selectablePermissionIds = useMemo(
        () =>
            activePermissions
                .filter(isPermissionActive)
                .map(getPermissionId)
                .filter(Boolean),
        [activePermissions]
    );

    const visibleSelectableIds = useMemo(
        () =>
            displayedPermissions
                .filter(isPermissionActive)
                .map(getPermissionId)
                .filter(Boolean),
        [displayedPermissions]
    );

    const allVisibleSelected =
        visibleSelectableIds.length > 0 &&
        visibleSelectableIds.every(
            (id) => selectedPermissionIds.includes(id)
        );

    const someVisibleSelected = visibleSelectableIds.some(
        (id) => selectedPermissionIds.includes(id)
    );

    const grantedCount = selectedPermissionIds.filter(
        (id) => selectablePermissionIds.includes(id)
    ).length;

    // -----------------------------------------------------
    // Assignment loading
    // -----------------------------------------------------

    const applyAssignments = useCallback((records) => {
        setAssignments(records);

        const selectedIds = records
            .filter(
                (assignment) =>
                    isEnabled(
                        assignment?.isActive ??
                        assignment?.is_active
                    ) &&
                    !isSoftDeleted(assignment)
            )
            .map(getAssignmentPermissionId)
            .filter(Boolean);

        setSelectedPermissionIds([...new Set(selectedIds)]);
    }, []);

    const loadAssignments = useCallback(
        async (roleId, requestVersion = null) => {
            if (!roleId) {
                setAssignments([]);
                setSelectedPermissionIds([]);
                return [];
            }

            const response = await getRolePermissions(roleId, {
                includeInactive: true,
            });

            if (
                requestVersion !== null &&
                requestVersion !== requestVersionRef.current
            ) {
                return null;
            }

            const records = getArray(response);
            applyAssignments(records);

            return records;
        },
        [applyAssignments]
    );

    // -----------------------------------------------------
    // Load roles and permissions
    // -----------------------------------------------------

    const loadData = useCallback(async () => {
        const requestVersion = ++requestVersionRef.current;

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const [rolesResponse, permissionsResponse] =
                await Promise.all([
                    getRoles(),
                    getPermissions(),
                ]);

            if (requestVersion !== requestVersionRef.current) {
                return;
            }

            // Only active, non-deleted, non-admin roles are editable here.
            const roleRecords = getArray(rolesResponse).filter(
                (role) =>
                    isManageableRole(role) &&
                    !isSoftDeleted(role) &&
                    isEnabled(
                        role?.isActive ??
                        role?.is_active ??
                        true
                    )
            );

            const permissionRecords = getArray(
                permissionsResponse
            );

            setRoles(roleRecords);
            setPermissions(permissionRecords);

            const previousRoleId = selectedRoleIdRef.current;

            const roleStillExists = roleRecords.some(
                (role) => getRoleId(role) === previousRoleId
            );

            // Keep the current selection if valid; otherwise prefer the
            // common application roles, then any other eligible role.
            const instructorRole = roleRecords.find(
                (role) => getRoleCode(role) === "INSTRUCTOR"
            );

            const studentRole = roleRecords.find(
                (role) => getRoleCode(role) === "STUDENT"
            );

            const nextRoleId = roleStillExists
                ? previousRoleId
                : getRoleId(instructorRole ?? studentRole ?? roleRecords[0]);

            selectedRoleIdRef.current = nextRoleId;
            setSelectedRoleId(nextRoleId);
            setPage(0);

            if (!nextRoleId) {
                setAssignments([]);
                setSelectedPermissionIds([]);
                return;
            }

            await loadAssignments(nextRoleId, requestVersion);
        } catch (loadError) {
            if (requestVersion === requestVersionRef.current) {
                setError(
                    getErrorMessage(
                        loadError,
                        "Unable to load roles and permissions."
                    )
                );
            }
        } finally {
            if (requestVersion === requestVersionRef.current) {
                setLoading(false);
            }
        }
    }, [loadAssignments]);

    useEffect(() => {
        loadData();

        return () => {
            requestVersionRef.current += 1;
        };
    }, [loadData]);

    // -----------------------------------------------------
    // Role selection
    // -----------------------------------------------------

    const handleRoleChange = async (event) => {
        const roleId = normalizeId(event.target.value);

        // Guard against selecting an inactive, deleted, or admin role.
        const roleIsAllowed = roles.some(
            (role) =>
                getRoleId(role) === roleId &&
                isManageableRole(role)
        );

        if (!roleIsAllowed) {
            setError("Select an active, non-admin role.");
            return;
        }

        const requestVersion = ++requestVersionRef.current;

        selectedRoleIdRef.current = roleId;

        setSelectedRoleId(roleId);
        setError("");
        setSuccess("");
        setPage(0);

        if (!roleId) {
            setAssignments([]);
            setSelectedPermissionIds([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            await loadAssignments(roleId, requestVersion);
        } catch (loadError) {
            if (requestVersion === requestVersionRef.current) {
                setError(
                    getErrorMessage(
                        loadError,
                        "Unable to load this role's permissions."
                    )
                );
            }
        } finally {
            if (requestVersion === requestVersionRef.current) {
                setLoading(false);
            }
        }
    };

    // -----------------------------------------------------
    // Permission selection
    // -----------------------------------------------------

    const handlePermissionToggle = (permissionId, checked) => {
        const id = normalizeId(permissionId);

        if (!id) return;

        setSelectedPermissionIds((current) => {
            if (checked) {
                return current.includes(id)
                    ? current
                    : [...current, id];
            }

            return current.filter((item) => item !== id);
        });

        setSuccess("");
        setError("");
    };

    const handleToggleVisible = (checked) => {
        setSelectedPermissionIds((current) => {
            if (checked) {
                return [
                    ...new Set([
                        ...current,
                        ...visibleSelectableIds,
                    ]),
                ];
            }

            return current.filter(
                (id) => !visibleSelectableIds.includes(id)
            );
        });

        setSuccess("");
        setError("");
    };

    const handleSelectAll = () => {
        setSelectedPermissionIds((current) => [
            ...new Set([
                ...current,
                ...selectablePermissionIds,
            ]),
        ]);

        setSuccess("");
        setError("");
    };

    const handleClearAll = () => {
        setSelectedPermissionIds([]);
        setSuccess("");
        setError("");
    };

    // -----------------------------------------------------
    // Reset and save
    // -----------------------------------------------------

    const handleReset = async () => {
        if (!selectedRoleId) return;

        const requestVersion = ++requestVersionRef.current;

        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await loadAssignments(
                selectedRoleId,
                requestVersion
            );
        } catch (resetError) {
            if (requestVersion === requestVersionRef.current) {
                setError(
                    getErrorMessage(
                        resetError,
                        "Unable to reset permissions."
                    )
                );
            }
        } finally {
            if (requestVersion === requestVersionRef.current) {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (!selectedRoleId) {
            setError("Please select a role before saving.");
            return;
        }

        // Verify the selected role before making any API calls.
        const roleToSave = roles.find(
            (role) => getRoleId(role) === selectedRoleId
        );

        if (!roleToSave || !isManageableRole(roleToSave)) {
            setError("Select an active, non-admin role before saving.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            await saveRolePrivileges({
                roleId: selectedRoleId,
                selectedPermissionIds: selectedPermissionIds.map(String),
                currentAssignments: assignments,
            });

            await loadAssignments(selectedRoleId);

            setSuccess(
                `Privileges for ${selectedRoleName} were saved successfully.`
            );
        } catch (saveError) {
            setError(
                getErrorMessage(
                    saveError,
                    "Unable to save role privileges."
                )
            );
        } finally {
            setSaving(false);
        }
    };

    // -----------------------------------------------------
    // Inline theme
    // -----------------------------------------------------

    const colors = {
        primary: "#6d4aff",
        primaryDark: "#5134d7",
        primaryLight: "#eee9ff",
        primaryTint: "#f8f7ff",
        ink: "#17152b",
        inkSoft: "#33285e",
        muted: "#6e7086",
        mutedLight: "#9694a8",
        border: "#e9e8f2",
        borderLight: "#f0eff6",
        green: "#16815f",
        greenBg: "#e7f7f0",
        greyBg: "#f5f4f8",
        white: "#ffffff",
    };

    const pageSx = {
        width: "100%",
        minWidth: 0,
        color: colors.ink,
        fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
    };

    const headingSx = {
        fontFamily: "var(--font-heading, 'Manrope', sans-serif)",
        fontWeight: 750,
        letterSpacing: "-0.025em",
        color: colors.ink,
    };

    const panelSx = {
        border: `1px solid ${colors.border}`,
        borderRadius: 3,
        backgroundColor: colors.white,
        boxShadow: "0 3px 16px rgba(23, 21, 43, 0.035)",
    };

    const fieldSx = {
        "& .MuiOutlinedInput-root": {
            borderRadius: 2,
            backgroundColor: colors.white,
            "& fieldset": {
                borderColor: colors.border,
            },
            "&:hover fieldset": {
                borderColor: "#c9c0f8",
            },
            "&.Mui-focused fieldset": {
                borderColor: colors.primary,
            },
        },
        "& .MuiInputLabel-root.Mui-focused": {
            color: colors.primary,
        },
    };

    // -----------------------------------------------------
    // Render
    // -----------------------------------------------------

    return (
        <Box sx={pageSx}>
            <Box
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    px: { xs: 1, sm: 1.5 },
                    py: 1,
                    mb: 2.5,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 2.5,
                    backgroundColor: "rgba(255, 255, 255, 0.94)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 8px 24px rgba(23, 21, 43, 0.09)",
                }}
            >
                <Tooltip title="Back to roles" arrow>
                    <IconButton
                        onClick={() => navigate("/admin/settings/roles")}
                        aria-label="Back to roles"
                        sx={{
                            width: 40,
                            height: 40,
                            flex: "0 0 auto",
                            border: `1px solid ${colors.border}`,
                            borderRadius: 2,
                            color: colors.inkSoft,
                        }}
                    >
                        <ArrowBackRoundedIcon />
                    </IconButton>
                </Tooltip>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: colors.ink }}>
                        Role menu privileges
                    </Typography>
                    <Typography
                        noWrap
                        sx={{ fontSize: 11, color: colors.muted }}
                    >
                        {selectedRoleName || "Select a role to manage access"}
                    </Typography>
                </Box>

                <Button
                    variant="text"
                    startIcon={<RestartAltRoundedIcon />}
                    onClick={handleReset}
                    disabled={loading || saving || !selectedRoleId}
                    sx={{
                        minHeight: 40,
                        px: { xs: 1, sm: 1.5 },
                        color: colors.muted,
                        textTransform: "none",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                    }}
                >
                    Reset
                </Button>

                <Button
                    variant="contained"
                    startIcon={
                        saving ? (
                            <CircularProgress size={17} color="inherit" />
                        ) : (
                            <SaveOutlinedIcon />
                        )
                    }
                    onClick={handleSave}
                    disabled={loading || saving || !selectedRoleId}
                    sx={{
                        minHeight: 40,
                        px: { xs: 1.25, sm: 2 },
                        borderRadius: 2,
                        bgcolor: colors.primary,
                        textTransform: "none",
                        fontWeight: 750,
                        whiteSpace: "nowrap",
                        boxShadow: "none",
                        "&:hover": { bgcolor: colors.primaryDark, boxShadow: "none" },
                    }}
                >
                    {saving ? "Saving..." : "Save privileges"}
                </Button>
            </Box>

            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    alignItems: { xs: "stretch", sm: "center" },
                    justifyContent: "space-between",
                    mb: 3,
                }}
            >
                <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", minWidth: 0 }}
                >
                    <Avatar
                        variant="rounded"
                        sx={{
                            width: 50,
                            height: 50,
                            borderRadius: 2.5,
                            bgcolor: colors.primaryLight,
                            color: colors.primary,
                        }}
                    >
                        <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 29 }} />
                    </Avatar>

                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            variant="h5"
                            sx={{
                                ...headingSx,
                                fontSize: { xs: 21, sm: 25 },
                            }}
                        >
                            Role Menu Privileges
                        </Typography>

                        <Typography
                            variant="body2"
                            sx={{ color: colors.muted, mt: 0.5, fontSize: 13 }}
                        >
                            Manage which features and actions each role can access.
                        </Typography>
                    </Box>
                </Stack>

                <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ flexWrap: "wrap" }}
                >
                    <Button
                        variant="outlined"
                        startIcon={<CheckCircleOutlineRoundedIcon />}
                        onClick={handleSelectAll}
                        disabled={
                            loading ||
                            saving ||
                            selectablePermissionIds.length === 0
                        }
                        sx={{
                            minHeight: 39,
                            px: 1.7,
                            borderRadius: 2,
                            borderColor: "#d8d0ff",
                            color: colors.primaryDark,
                            textTransform: "none",
                            fontWeight: 700,
                            "&:hover": {
                                borderColor: colors.primary,
                                bgcolor: colors.primaryTint,
                            },
                        }}
                    >
                        Select all
                    </Button>

                    <Button
                        variant="outlined"
                        startIcon={<HighlightOffRoundedIcon />}
                        onClick={handleClearAll}
                        disabled={
                            loading ||
                            saving ||
                            selectedPermissionIds.length === 0
                        }
                        sx={{
                            minHeight: 39,
                            px: 1.7,
                            borderRadius: 2,
                            borderColor: colors.border,
                            color: colors.muted,
                            textTransform: "none",
                            fontWeight: 700,
                            "&:hover": {
                                borderColor: "#d5d2e1",
                                bgcolor: "#faf9fc",
                            },
                        }}
                    >
                        Clear all
                    </Button>
                </Stack>
            </Stack>

            {error && (
                <Alert
                    severity="error"
                    onClose={() => setError("")}
                    sx={{ mb: 2, borderRadius: 2 }}
                >
                    {error}
                </Alert>
            )}

            {success && (
                <Alert
                    severity="success"
                    onClose={() => setSuccess("")}
                    sx={{ mb: 2, borderRadius: 2 }}
                >
                    {success}
                </Alert>
            )}

            {/* Summary cards */}

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1.5,
                    mb: 2.5,
                }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        ...panelSx,
                        p: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                    }}
                >
                    <Avatar
                        variant="rounded"
                        sx={{
                            bgcolor: "#eee9ff",
                            color: colors.primary,
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                        }}
                    >
                        <ShieldOutlinedIcon />
                    </Avatar>

                    <Box>
                        <Typography
                            sx={{
                                color: colors.muted,
                                fontSize: 11.5,
                                fontWeight: 650,
                            }}
                        >
                            Selected role
                        </Typography>

                        <Typography
                            sx={{
                                mt: 0.25,
                                fontWeight: 750,
                                fontSize: 15,
                                color: colors.ink,
                                overflowWrap: "anywhere",
                            }}
                        >
                            {selectedRoleName}
                        </Typography>
                    </Box>
                </Paper>

                <Paper
                    elevation={0}
                    sx={{
                        ...panelSx,
                        p: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                    }}
                >
                    <Avatar
                        variant="rounded"
                        sx={{
                            bgcolor: "#edf5ff",
                            color: "#3975c6",
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                        }}
                    >
                        <VpnKeyOutlinedIcon />
                    </Avatar>

                    <Box>
                        <Typography
                            sx={{
                                color: colors.muted,
                                fontSize: 11.5,
                                fontWeight: 650,
                            }}
                        >
                            Available permissions
                        </Typography>

                        <Typography
                            sx={{
                                mt: 0.25,
                                fontWeight: 750,
                                fontSize: 21,
                                color: colors.ink,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {activePermissions.length}
                        </Typography>
                    </Box>
                </Paper>

                <Paper
                    elevation={0}
                    sx={{
                        ...panelSx,
                        p: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                    }}
                >
                    <Avatar
                        variant="rounded"
                        sx={{
                            bgcolor: colors.greenBg,
                            color: colors.green,
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                        }}
                    >
                        <CheckCircleOutlineRoundedIcon />
                    </Avatar>

                    <Box>
                        <Typography
                            sx={{
                                color: colors.muted,
                                fontSize: 11.5,
                                fontWeight: 650,
                            }}
                        >
                            Selected permissions
                        </Typography>

                        <Stack
                            direction="row"
                            spacing={0.8}
                            sx={{ alignItems: "baseline", mt: 0.15 }}
                        >
                            <Typography
                                sx={{
                                    fontWeight: 800,
                                    fontSize: 21,
                                    color: colors.green,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {grantedCount}
                            </Typography>

                            <Typography
                                sx={{ color: colors.muted, fontSize: 12 }}
                            >
                                of {selectablePermissionIds.length} active
                            </Typography>
                        </Stack>
                    </Box>
                </Paper>
            </Box>

            {/* Filters and actions */}

            <Paper
                elevation={0}
                sx={{
                    ...panelSx,
                    p: { xs: 1.5, sm: 2.25 },
                    mb: 2.5,
                }}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: "center",
                        justifyContent: "space-between",
                        mb: 2,
                    }}
                >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <FilterAltOutlinedIcon
                            sx={{ color: colors.primary, fontSize: 20 }}
                        />

                        <Typography
                            sx={{
                                fontWeight: 750,
                                color: colors.ink,
                                fontSize: 14,
                            }}
                        >
                            Filters and actions
                        </Typography>
                    </Stack>

                    <Tooltip title="Refresh roles and permissions" arrow>
                        <span>
                            <IconButton
                                aria-label="Refresh roles and permissions"
                                onClick={loadData}
                                disabled={loading || saving}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    color: colors.primary,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: 2,
                                    "&:hover": {
                                        bgcolor: colors.primaryLight,
                                        borderColor: colors.primary,
                                    },
                                }}
                            >
                                {loading ? (
                                    <CircularProgress size={18} color="inherit" />
                                ) : (
                                    <RefreshRoundedIcon />
                                )}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, minmax(0, 1fr))",
                            lg: "repeat(3, minmax(0, 1fr))",
                        },
                        gap: 1.5,
                        alignItems: "center",
                    }}
                >
                    <FormControl size="small" fullWidth sx={fieldSx}>
                        <InputLabel id="role-privilege-role-label">
                            Select role
                        </InputLabel>

                        <Select
                            labelId="role-privilege-role-label"
                            value={selectedRoleId}
                            label="Select role"
                            onChange={handleRoleChange}
                            disabled={loading || saving}
                        >
                            {roles.length === 0 ? (
                                <MenuItem value="" disabled>
                                    No active non-admin roles available
                                </MenuItem>
                            ) : (
                                roles.map((role) => {
                                    const id = getRoleId(role);

                                    return (
                                        <MenuItem key={id} value={id}>
                                            {getRoleName(role)}
                                        </MenuItem>
                                    );
                                })
                            )}
                        </Select>
                    </FormControl>

                    <TextField
                        fullWidth
                        size="small"
                        value={searchText}
                        onChange={(event) => {
                            setSearchText(event.target.value);
                            setPage(0);
                        }}
                        placeholder="Search name, module, action or code..."
                        sx={fieldSx}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon
                                            sx={{
                                                color: colors.mutedLight,
                                                fontSize: 20,
                                            }}
                                        />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />

                    <FormControl size="small" fullWidth sx={fieldSx}>
                        <InputLabel id="permission-module-filter-label">
                            Module
                        </InputLabel>

                        <Select
                            labelId="permission-module-filter-label"
                            value={moduleFilter}
                            label="Module"
                            onChange={(event) => {
                                setModuleFilter(event.target.value);
                                setPage(0);
                            }}
                        >
                            <MenuItem value="ALL">All modules</MenuItem>

                            {modules.map((module) => (
                                <MenuItem key={module} value={module}>
                                    {module}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                </Box>

                <Divider sx={{ my: 2, borderColor: colors.borderLight }} />

                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{
                        alignItems: { xs: "stretch", sm: "center" },
                        justifyContent: "space-between",
                    }}
                >
                    <FormControl
                        size="small"
                        sx={{
                            minWidth: { xs: "100%", sm: 180 },
                            ...fieldSx,
                        }}
                    >
                        <InputLabel id="permission-status-filter-label">
                            Permission status
                        </InputLabel>

                        <Select
                            labelId="permission-status-filter-label"
                            value={statusFilter}
                            label="Permission status"
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setPage(0);
                            }}
                        >
                            <MenuItem value="ALL">All statuses</MenuItem>
                            <MenuItem value="GRANTED">Granted</MenuItem>
                            <MenuItem value="NOT_GRANTED">Not granted</MenuItem>
                            <MenuItem value="INACTIVE">Inactive</MenuItem>
                        </Select>
                    </FormControl>

                </Stack>
            </Paper>

            {/* Permission assignment cards */}
            <Paper
                elevation={0}
                sx={{ ...panelSx, overflow: "hidden" }}
            >
                <Box
                    sx={{
                        px: { xs: 1.5, sm: 2.25 },
                        py: 2,
                        display: "flex",
                        alignItems: { xs: "flex-start", md: "center" },
                        justifyContent: "space-between",
                        gap: 1.5,
                        flexWrap: "wrap",
                    }}
                >
                    <Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 15, color: colors.ink }}>
                                Permission assignments
                            </Typography>
                            <Chip
                                size="small"
                                label={filteredPermissions.length}
                                sx={{
                                    height: 22,
                                    bgcolor: colors.primaryLight,
                                    color: colors.primaryDark,
                                    fontWeight: 800,
                                    fontSize: 11,
                                }}
                            />
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5, color: colors.muted, fontSize: 12 }}>
                            Choose the permissions {selectedRoleName !== "No role selected" ? `for ${selectedRoleName}` : "for this role"}.
                        </Typography>
                    </Box>

                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        sx={{ alignItems: { xs: "stretch", sm: "center" } }}
                    >
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <Checkbox
                                size="small"
                                checked={allVisibleSelected}
                                indeterminate={!allVisibleSelected && someVisibleSelected}
                                onChange={(event) => handleToggleVisible(event.target.checked)}
                                disabled={loading || saving || visibleSelectableIds.length === 0}
                                inputProps={{ "aria-label": "Select all visible permissions" }}
                                sx={{ color: colors.mutedLight, "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: colors.primary } }}
                            />
                            <Typography sx={{ color: colors.inkSoft, fontSize: 12, fontWeight: 650 }}>
                                Select visible
                            </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: colors.muted, fontSize: 12 }}>
                            {filteredPermissions.length === 0
                                ? "No matching permissions"
                                : `Showing ${effectivePage * rowsPerPage + 1}–${Math.min((effectivePage + 1) * rowsPerPage, filteredPermissions.length)} of ${filteredPermissions.length}`}
                        </Typography>
                    </Stack>
                </Box>

                <Divider sx={{ borderColor: colors.border }} />

                {loading ? (
                    <Stack spacing={1.5} sx={{ alignItems: "center", py: 8 }}>
                        <CircularProgress size={28} thickness={4} sx={{ color: colors.primary }} />
                        <Typography sx={{ color: colors.muted, fontSize: 13 }}>Loading permissions...</Typography>
                    </Stack>
                ) : displayedPermissionGroups.length === 0 ? (
                    <Stack spacing={0.75} sx={{ alignItems: "center", py: 8, px: 2 }}>
                        <Avatar sx={{ width: 48, height: 48, mb: 0.5, bgcolor: "#f2f0fa", color: colors.muted }}>
                            <SearchRoundedIcon />
                        </Avatar>
                        <Typography sx={{ fontWeight: 750, color: colors.ink, fontSize: 14 }}>
                            No permissions found
                        </Typography>
                        <Typography sx={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
                            Try changing your search or filter settings.
                        </Typography>
                        {(searchText || moduleFilter !== "ALL" || statusFilter !== "ALL") && (
                            <Button
                                size="small"
                                onClick={() => {
                                    setSearchText("");
                                    setModuleFilter("ALL");
                                    setStatusFilter("ALL");
                                    setPage(0);
                                }}
                                sx={{ mt: 0.5, textTransform: "none", color: colors.primary, fontWeight: 700 }}
                            >
                                Clear filters
                            </Button>
                        )}
                    </Stack>
                ) : (
                    <Stack spacing={1.75} sx={{ p: { xs: 1.25, sm: 2 } }}>
                        {displayedPermissionGroups.map((group) => {
                            const groupGrantedCount = group.permissions.filter((permission) =>
                                selectedPermissionIds.includes(getPermissionId(permission))
                            ).length;

                            return (
                                <Paper
                                    key={group.moduleName}
                                    elevation={0}
                                    sx={{
                                        overflow: "hidden",
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: 2.5,
                                        backgroundColor: colors.white,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            px: { xs: 1.5, sm: 2 },
                                            py: 1.5,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 1,
                                            flexWrap: "wrap",
                                            background: "linear-gradient(100deg, #f8f7ff, #fbfcff)",
                                            borderBottom: `1px solid ${colors.borderLight}`,
                                        }}
                                    >
                                        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
                                            <Avatar
                                                variant="rounded"
                                                sx={{ width: 36, height: 36, borderRadius: 1.75, bgcolor: colors.primaryLight, color: colors.primary }}
                                            >
                                                <ShieldOutlinedIcon sx={{ fontSize: 20 }} />
                                            </Avatar>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={{ color: colors.ink, fontSize: 13.5, fontWeight: 800, overflowWrap: "anywhere" }}>
                                                    {group.moduleName}
                                                </Typography>
                                                <Typography sx={{ color: colors.muted, fontSize: 11 }}>
                                                    {group.permissions.length} permission{group.permissions.length === 1 ? "" : "s"} on this page
                                                </Typography>
                                            </Box>
                                        </Stack>
                                        <Chip
                                            size="small"
                                            icon={<CheckCircleOutlineRoundedIcon />}
                                            label={`${groupGrantedCount} granted`}
                                            sx={{
                                                height: 25,
                                                bgcolor: colors.greenBg,
                                                color: colors.green,
                                                fontSize: 10.5,
                                                fontWeight: 750,
                                                "& .MuiChip-icon": { color: "inherit", fontSize: 15 },
                                            }}
                                        />
                                    </Box>

                                    <Box
                                        sx={{
                                            p: { xs: 1.25, sm: 1.5 },
                                            display: "grid",
                                            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
                                            gap: 1.25,
                                        }}
                                    >
                                        {group.permissions.map((permission, index) => {
                                            const id = getPermissionId(permission);
                                            const active = isPermissionActive(permission);
                                            const checked = selectedPermissionIds.includes(id);

                                            return (
                                                <Paper
                                                    key={id || `${group.moduleName}-${index}`}
                                                    elevation={0}
                                                    sx={{
                                                        minWidth: 0,
                                                        p: 1.5,
                                                        border: `1px solid ${checked ? "#d8d0ff" : colors.borderLight}`,
                                                        borderRadius: 2,
                                                        backgroundColor: checked ? "#fcfbff" : colors.white,
                                                        transition: "border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease",
                                                        "&:hover": {
                                                            borderColor: active ? "#c9c0f8" : colors.borderLight,
                                                            boxShadow: active ? "0 4px 14px rgba(23, 21, 43, 0.05)" : "none",
                                                        },
                                                    }}
                                                >
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                                                        <Checkbox
                                                            size="small"
                                                            checked={checked}
                                                            disabled={!active || !id || loading || saving}
                                                            onChange={(event) => handlePermissionToggle(id, event.target.checked)}
                                                            inputProps={{ "aria-label": `Grant ${getPermissionLabel(permission)}` }}
                                                            sx={{ mt: -0.5, ml: -0.75, color: colors.mutedLight, "&.Mui-checked": { color: colors.primary } }}
                                                        />
                                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                                            <Stack
                                                                direction={{ xs: "column", sm: "row" }}
                                                                spacing={0.75}
                                                                sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", minWidth: 0 }}
                                                            >
                                                                <Typography sx={{ color: colors.ink, fontSize: 12.5, fontWeight: 750, overflowWrap: "anywhere" }}>
                                                                    {getPermissionLabel(permission)}
                                                                </Typography>
                                                                <Chip
                                                                    size="small"
                                                                    label={getActionName(permission)}
                                                                    sx={{
                                                                        height: 23,
                                                                        maxWidth: "100%",
                                                                        bgcolor: "#f1efff",
                                                                        color: colors.primaryDark,
                                                                        fontSize: 10,
                                                                        fontWeight: 800,
                                                                        borderRadius: 1.5,
                                                                        "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                                                                    }}
                                                                />
                                                            </Stack>
                                                            <Typography sx={{ mt: 0.6, color: colors.muted, fontSize: 11.5, overflowWrap: "anywhere" }}>
                                                                Resource: {getResourceName(permission)}
                                                            </Typography>
                                                            <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", mt: 1 }}>
                                                                <Chip
                                                                    size="small"
                                                                    label={`Code: ${getPermissionCode(permission) || "—"}`}
                                                                    sx={{
                                                                        height: 22,
                                                                        maxWidth: "100%",
                                                                        bgcolor: "#f7f7fa",
                                                                        color: colors.muted,
                                                                        fontSize: 9.5,
                                                                        fontFamily: "Consolas, 'Courier New', monospace",
                                                                        "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                                                                    }}
                                                                />
                                                                <Chip
                                                                    size="small"
                                                                    icon={!active ? <LockOutlinedIcon /> : checked ? <CheckCircleOutlineRoundedIcon /> : undefined}
                                                                    label={!active ? "Inactive" : checked ? "Granted" : "Not granted"}
                                                                    sx={{
                                                                        height: 22,
                                                                        bgcolor: !active ? "#f0eff4" : checked ? colors.greenBg : colors.greyBg,
                                                                        color: !active ? "#858197" : checked ? colors.green : "#77748a",
                                                                        fontSize: 9.5,
                                                                        fontWeight: 750,
                                                                        "& .MuiChip-icon": { color: "inherit", fontSize: 14, ml: 0.5 },
                                                                    }}
                                                                />
                                                            </Stack>
                                                        </Box>
                                                    </Stack>
                                                </Paper>
                                            );
                                        })}
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Stack>
                )}

                <Divider sx={{ borderColor: colors.border }} />
                <Box
                    sx={{
                        px: { xs: 1.5, sm: 2 },
                        py: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                        flexWrap: "wrap",
                    }}
                >
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Typography sx={{ color: colors.muted, fontSize: 11.5 }}>
                            Permissions per page
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 82 }}>
                            <Select
                                value={rowsPerPage}
                                onChange={(event) => {
                                    setRowsPerPage(Number(event.target.value));
                                    setPage(0);
                                }}
                                inputProps={{ "aria-label": "Permissions per page" }}
                                sx={{ ...fieldSx, fontSize: 12, height: 36 }}
                            >
                                {[5, 10, 25, 50, 100].map((size) => (
                                    <MenuItem key={size} value={size}>{size}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                    {pageCount > 1 && (
                        <Pagination
                            count={pageCount}
                            page={effectivePage + 1}
                            onChange={(_event, nextPage) => setPage(nextPage - 1)}
                            disabled={loading || saving}
                            size="small"
                            shape="rounded"
                            color="primary"
                            aria-label="Permission pages"
                        />
                    )}
                </Box>
            </Paper>

            <Stack
                direction="row"
                spacing={1}
                sx={{
                    alignItems: "flex-start",
                    mt: 1.5,
                    px: 0.5,
                }}
            >
                <LockOutlinedIcon
                    sx={{
                        mt: 0.15,
                        fontSize: 15,
                        color: colors.mutedLight,
                    }}
                />

                <Typography
                    sx={{
                        color: colors.muted,
                        fontSize: 11.5,
                        lineHeight: 1.6,
                    }}
                >
                    Changes are staged locally until you select{" "}
                    <strong>Save privileges</strong>. Inactive permissions
                    are displayed for reference and cannot be selected.
                    Active roles are managed here; inactive and deleted roles are unavailable.
                    Backend authorization must still enforce permissions
                    on protected API endpoints.
                </Typography>
            </Stack>
        </Box>
    );
}
