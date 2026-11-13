
import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";

import DataTable from "../../component/tables/DataTable";
import { getMyAccess } from "../../service/Authapi";

import {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    approveUser,
    rejectUser,
} from "../../service/UserApi";

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const USER_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeAccessCode(value) {
    return String(value ?? "").trim().toUpperCase();
}

function extractAccessCode(value) {
    return normalizeAccessCode(
        typeof value === "string"
            ? value
            : value?.code ?? value?.permissionCode ?? value?.permission_code
    );
}

const STATUS_STYLES = {
    PENDING: { label: "Pending" },
    APPROVED: { label: "Approved" },
    REJECTED: { label: "Rejected" },
    ACTIVE: { label: "Active" },
    INACTIVE: { label: "Inactive" },
    LOCKED: { label: "Locked" },
    UNLOCKED: { label: "Unlocked" },
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function createEmptyUser() {
    return {
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        phoneNumber: "",
        roleId: "",
        roleName: "",
        status: "PENDING",
        isActive: true,
        isLocked: false,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
    };
}

function toBoolean(value, defaultValue = false) {
    if (value === null || value === undefined || value === "") {
        return defaultValue;
    }

    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;

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

function normalizeStatus(status) {
    return status == null ? "" : String(status).trim().toUpperCase();
}

function getStatusLabel(status) {
    const normalized = normalizeStatus(status);
    return STATUS_STYLES[normalized]?.label ?? (status || "Not specified");
}

function getRoleName(user) {
    if (!user) return "";

    if (typeof user.roleName === "string" && user.roleName) {
        return user.roleName;
    }

    if (typeof user.role === "string") {
        return user.role;
    }

    if (user.role && typeof user.role === "object") {
        return (
            user.role.code ??
            user.role.roleCode ??
            user.role.roleName ??
            user.role.name ??
            ""
        );
    }

    if (Array.isArray(user.roles)) {
        return user.roles
            .map((role) => {
                if (typeof role === "string") return role;

                return (
                    role?.code ??
                    role?.roleCode ??
                    role?.roleName ??
                    role?.name ??
                    ""
                );
            })
            .filter(Boolean)
            .join(", ");
    }

    return "";
}

function getRoleId(user) {
    if (!user) return "";

    if (user.roleId !== null && user.roleId !== undefined) {
        return String(user.roleId);
    }

    if (user.role && typeof user.role === "object") {
        const id = user.role.roleId ?? user.role.id;
        return id == null ? "" : String(id);
    }

    if (Array.isArray(user.roles) && user.roles.length === 1) {
        const role = user.roles[0];

        if (typeof role === "object" && role) {
            const id = role.id ?? role.roleId;
            return id == null ? "" : String(id);
        }
    }

    return "";
}

function normalizeUser(user = {}) {
    return {
        ...user,
        id: user.id == null ? user.id : String(user.id),
        userId: user.userId == null ? user.userId : String(user.userId),
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        username: user.username ?? "",
        email: user.email ?? "",
        phoneNumber: user.phoneNumber ?? user.phone ?? "",
        roleId: getRoleId(user),
        roleName: getRoleName(user),
        status: normalizeStatus(
            user.status ?? user.approvalStatus ?? user.registrationStatus ?? "PENDING"
        ),
        isActive: toBoolean(
            user.isActive ?? user.is_active ?? user.active,
            true
        ),
        isLocked: toBoolean(
            user.isLocked ?? user.is_locked ?? user.locked,
            false
        ),
        emailVerifiedAt: user.emailVerifiedAt ?? user.email_verified_at ?? null,
        phoneVerifiedAt: user.phoneVerifiedAt ?? user.phone_verified_at ?? null,
    };
}

function extractUsers(response) {
    const body = response?.data ?? response;
    const data = body?.data ?? body;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.users)) return data.users;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.content)) return data.content;
    if (Array.isArray(data?.rows)) return data.rows;

    return [];
}

function extractUser(response) {
    const body = response?.data ?? response;
    const data = body?.data ?? body;

    if (data?.user && typeof data.user === "object") {
        return data.user;
    }

    return data;
}

function unwrapAccessResponse(response) {
    let value = response?.data ?? response;

    while (
        value &&
        !Array.isArray(value) &&
        typeof value === "object" &&
        value.data !== undefined
    ) {
        value = value.data;
    }

    return value ?? {};
}

function getAccessArray(source, keys) {
    for (const key of keys) {
        if (Array.isArray(source?.[key])) return source[key];
    }

    return [];
}

function getErrorMessage(error, fallback) {
    return (
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        error?.message ??
        fallback
    );
}

function isPendingInstructor(user) {
    const status = normalizeStatus(
        user?.status ?? user?.approvalStatus ?? user?.registrationStatus
    );

    if (status !== "PENDING") return false;

    const roles = Array.isArray(user?.roles)
        ? user.roles
        : [user?.role ?? user?.roleName].filter(Boolean);

    return roles.some((role) => {
        const value =
            typeof role === "string"
                ? role
                : role?.code ??
                  role?.roleCode ??
                  role?.roleName ??
                  role?.name ??
                  "";

        return String(value).trim().toUpperCase() === "INSTRUCTOR";
    });
}

function buildUpdatePayload(form) {
    return {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        isActive: Boolean(form.isActive),
        isLocked: Boolean(form.isLocked),
        emailVerifiedAt: form.emailVerifiedAt ?? null,
        phoneVerifiedAt: form.phoneVerifiedAt ?? null,
    };
}

function validateUserForm(form) {
    const errors = {};

    if (!form.firstName.trim()) {
        errors.firstName = "First name is required.";
    }

    if (!form.username.trim()) {
        errors.username = "Username is required.";
    }

    if (!form.email.trim()) {
        errors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
        errors.email = "Enter a valid email address.";
    }

    if (form.phoneNumber.trim()) {
        const digits = form.phoneNumber.replace(/\D/g, "");

        if (
            !/^[+()\d\s.-]+$/.test(form.phoneNumber) ||
            digits.length < 7 ||
            digits.length > 15
        ) {
            errors.phoneNumber = "Enter a valid phone number containing 7 to 15 digits.";
        }
    }

    if (!form.status) {
        errors.status = "Select a user status.";
    }

    return errors;
}

// ---------------------------------------------------------
// Reusable status components
// ---------------------------------------------------------

function StatusChip({ status }) {
    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                px: 1.25,
                py: 0.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                fontSize: "0.8rem",
                fontWeight: 500,
            }}
        >
            {getStatusLabel(status)}
        </Box>
    );
}

function BooleanStatusIcon({ value, type = "active" }) {
    const isTrue = toBoolean(value);
    const locked = type === "locked";
    const title = locked
        ? isTrue
            ? "Locked"
            : "Unlocked"
        : isTrue
          ? "Active"
          : "Inactive";

    return (
        <Tooltip title={title} arrow>
            <Box
                component="span"
                role="img"
                aria-label={title}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    color: isTrue ? "#2e7d32" : "#d32f2f",
                }}
            >
                {locked ? (
                    isTrue ? (
                        <LockOutlinedIcon fontSize="small" />
                    ) : (
                        <LockOpenOutlinedIcon fontSize="small" />
                    )
                ) : isTrue ? (
                    <CheckCircleOutlineIcon fontSize="small" />
                ) : (
                    <CancelOutlinedIcon fontSize="small" />
                )}
            </Box>
        </Tooltip>
    );
}

// ---------------------------------------------------------
// User Management
// ---------------------------------------------------------

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [accessLoading, setAccessLoading] = useState(true);
    const [access, setAccess] = useState({ roles: [], permissions: [] });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [processingApprovalId, setProcessingApprovalId] = useState("");

    const [notification, setNotification] = useState({
        type: "success",
        message: "",
    });

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState("view");
    const [selectedUser, setSelectedUser] = useState(null);

    const [form, setForm] = useState(createEmptyUser);
    const [formErrors, setFormErrors] = useState({});

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [userToReject, setUserToReject] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");

    const roleCodes = useMemo(
        () => new Set((access.roles || []).map(extractAccessCode)),
        [access.roles]
    );
    const permissionCodes = useMemo(
        () => new Set((access.permissions || []).map(extractAccessCode)),
        [access.permissions]
    );
    const isAdmin = roleCodes.has("ADMIN");
    const canViewUsers = isAdmin || permissionCodes.has("USER_VIEW");
    const canUpdateUsers = isAdmin || permissionCodes.has("USER_UPDATE");
    const canDeleteUsers = isAdmin || permissionCodes.has("USER_DELETE");

    const showNotification = useCallback((type, message) => {
        setNotification({ type, message });
    }, []);

    const clearNotification = useCallback(() => {
        setNotification({ type: "success", message: "" });
    }, []);

    // -----------------------------------------------------
    // Load users
    // -----------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function initializePage() {
            try {
                const response = await getMyAccess();
                const data = unwrapAccessResponse(response);
                const roles = getAccessArray(data, ["roles", "userRoles"]);
                const permissions = getAccessArray(data, [
                    "permissions",
                    "effectivePermissions",
                    "effective_permissions",
                ]);
                const singleRole =
                    data.role ?? data.role_code ?? data.role_name;
                const nextAccess = {
                    roles: roles.length > 0 ? roles : singleRole ? [singleRole] : [],
                    permissions,
                };

                if (cancelled) return;

                setAccess(nextAccess);

                const hasViewPermission =
                    nextAccess.roles.map(extractAccessCode).includes("ADMIN") ||
                    nextAccess.permissions
                        .map(extractAccessCode)
                        .includes("USER_VIEW");

                if (hasViewPermission) {
                    try {
                        const usersResponse = await getUsers();
                        if (!cancelled) {
                            setUsers(
                                extractUsers(usersResponse).map(normalizeUser)
                            );
                        }
                    } catch (error) {
                        if (!cancelled) {
                            showNotification(
                                "error",
                                getErrorMessage(error, "Failed to load users.")
                            );
                        }
                    }
                } else {
                    setUsers([]);
                }
            } catch (error) {
                if (!cancelled) {
                    showNotification(
                        "error",
                        getErrorMessage(error, "Could not load user permissions.")
                    );
                }
            } finally {
                if (!cancelled) {
                    setAccessLoading(false);
                    setLoading(false);
                }
            }
        }

        initializePage();

        return () => {
            cancelled = true;
        };
    }, [showNotification]);

    const loadUsers = useCallback(async () => {
        if (accessLoading) return;

        if (!canViewUsers) {
            setUsers([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const response = await getUsers();
            setUsers(extractUsers(response).map(normalizeUser));
        } catch (error) {
            showNotification(
                "error",
                getErrorMessage(error, "Failed to load users.")
            );
        } finally {
            setLoading(false);
        }
    }, [accessLoading, canViewUsers, showNotification]);

    // -----------------------------------------------------
    // Open and close user drawer
    // -----------------------------------------------------

    const openDrawer = useCallback(
        (user, mode = "view") => {
            const normalized = normalizeUser(user);

            setSelectedUser(normalized);
            setForm({
                ...createEmptyUser(),
                ...normalized,
            });
            setFormErrors({});
            setDrawerMode(mode);
            setDrawerOpen(true);
            clearNotification();
        },
        [clearNotification]
    );

    const closeDrawer = useCallback(() => {
        if (saving) return;

        setDrawerOpen(false);
        setSelectedUser(null);
        setForm(createEmptyUser());
        setFormErrors({});
    }, [saving]);

    const handleFormChange = useCallback((field, value) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));

        setFormErrors((previous) => {
            const next = { ...previous };
            delete next[field];
            return next;
        });
    }, []);

    // -----------------------------------------------------
    // Edit user
    // -----------------------------------------------------

    const handleEdit = useCallback(
        async (user) => {
            if (!canUpdateUsers) return;

            const userId = user?.id ?? user?.userId;

            if (userId == null || String(userId).trim() === "") {
                showNotification("error", "Unable to identify this user.");
                return;
            }

            clearNotification();

            try {
                const response = await getUserById(String(userId));
                const details = normalizeUser(extractUser(response));

                openDrawer(
                    {
                        ...user,
                        ...details,
                        id: details.id ?? String(userId),
                    },
                    "edit"
                );
            } catch (error) {
                openDrawer(user, "edit");

                showNotification(
                    "warning",
                    getErrorMessage(
                        error,
                        "Could not load full user details. Editing the available row data."
                    )
                );
            }
        },
        [canUpdateUsers, clearNotification, openDrawer, showNotification]
    );

    // -----------------------------------------------------
    // Save user
    // -----------------------------------------------------

    const handleSave = useCallback(async () => {
        if (!canUpdateUsers) {
            showNotification("error", "You do not have permission to update users.");
            return;
        }

        if (!selectedUser) {
            showNotification("error", "No user is selected.");
            return;
        }

        const errors = validateUserForm(form);

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            showNotification("error", "Please correct the highlighted fields.");
            return;
        }

        const userId = selectedUser.id ?? selectedUser.userId;

        if (userId == null || String(userId).trim() === "") {
            showNotification("error", "Unable to identify this user.");
            return;
        }

        setSaving(true);
        clearNotification();

        try {
            await updateUser(String(userId), buildUpdatePayload(form));

            setDrawerOpen(false);
            setSelectedUser(null);
            setForm(createEmptyUser());
            setFormErrors({});

            await loadUsers();
            showNotification("success", "User updated successfully.");
        } catch (error) {
            showNotification(
                "error",
                getErrorMessage(error, "Failed to update user.")
            );
        } finally {
            setSaving(false);
        }
    }, [
        clearNotification,
        canUpdateUsers,
        form,
        loadUsers,
        selectedUser,
        showNotification,
    ]);

    // -----------------------------------------------------
    // Approve pending instructor
    // -----------------------------------------------------

    const handleApprove = useCallback(
        async (user) => {
            if (!canUpdateUsers) return;

            const userId = user?.id ?? user?.userId;

            if (userId == null || String(userId).trim() === "") {
                showNotification("error", "Unable to identify this instructor.");
                return;
            }

            if (!isPendingInstructor(user)) {
                showNotification(
                    "warning",
                    "Only pending instructors can be approved."
                );
                return;
            }

            const id = String(userId);

            setProcessingApprovalId(id);
            clearNotification();

            try {
                await approveUser(id);

                // Refresh from the backend so the updated approval status is shown.
                await loadUsers();
                window.dispatchEvent(new Event("admin-pending-approvals-changed"));

                showNotification(
                    "success",
                    `${user.username || user.email || "Instructor"} approved successfully.`
                );
            } catch (error) {
                showNotification(
                    "error",
                    getErrorMessage(error, "Failed to approve instructor.")
                );
            } finally {
                setProcessingApprovalId("");
            }
        },
        [canUpdateUsers, clearNotification, loadUsers, showNotification]
    );

    // -----------------------------------------------------
    // Reject pending instructor
    // -----------------------------------------------------

    const openRejectDialog = useCallback(
        (user) => {
            if (!canUpdateUsers) return;

            if (!isPendingInstructor(user)) {
                showNotification(
                    "warning",
                    "Only pending instructors can be rejected."
                );
                return;
            }

            setUserToReject(normalizeUser(user));
            setRejectionReason("");
            setRejectDialogOpen(true);
            clearNotification();
        },
        [canUpdateUsers, clearNotification, showNotification]
    );

    const closeRejectDialog = useCallback(() => {
        if (processingApprovalId) return;

        setRejectDialogOpen(false);
        setUserToReject(null);
        setRejectionReason("");
    }, [processingApprovalId]);

    const handleReject = useCallback(async () => {
        if (!canUpdateUsers) {
            showNotification("error", "You do not have permission to update users.");
            return;
        }

        if (!userToReject) return;

        const userId = userToReject.id ?? userToReject.userId;

        if (userId == null || String(userId).trim() === "") {
            showNotification("error", "Unable to identify this instructor.");
            return;
        }

        if (rejectionReason.trim().length > 5000) {
            showNotification(
                "error",
                "Rejection reason must not exceed 5000 characters."
            );
            return;
        }

        const id = String(userId);

        setProcessingApprovalId(id);
        clearNotification();

        try {
            // UserApi supports rejectUser(id, reason).
            await rejectUser(id, rejectionReason.trim());

            setRejectDialogOpen(false);
            setUserToReject(null);
            setRejectionReason("");

            await loadUsers();
            window.dispatchEvent(new Event("admin-pending-approvals-changed"));

            showNotification(
                "success",
                `${userToReject.username || userToReject.email || "Instructor"} rejected successfully.`
            );
        } catch (error) {
            showNotification(
                "error",
                getErrorMessage(error, "Failed to reject instructor.")
            );
        } finally {
            setProcessingApprovalId("");
        }
    }, [
        clearNotification,
        canUpdateUsers,
        loadUsers,
        rejectionReason,
        showNotification,
        userToReject,
    ]);

    // -----------------------------------------------------
    // Delete user
    // -----------------------------------------------------

    const openDeleteDialog = useCallback(
        (user) => {
            if (!canDeleteUsers) return;

            setUserToDelete(normalizeUser(user));
            setDeleteDialogOpen(true);
            clearNotification();
        },
        [canDeleteUsers, clearNotification]
    );

    const closeDeleteDialog = useCallback(() => {
        if (deleting) return;

        setDeleteDialogOpen(false);
        setUserToDelete(null);
    }, [deleting]);

    const handleDelete = useCallback(async () => {
        if (!canDeleteUsers) {
            showNotification("error", "You do not have permission to delete users.");
            return;
        }

        if (!userToDelete) return;

        const userId = userToDelete.id ?? userToDelete.userId;

        if (userId == null || String(userId).trim() === "") {
            showNotification("error", "Unable to identify this user.");
            return;
        }

        setDeleting(true);
        clearNotification();

        try {
            await deleteUser(String(userId));

            setUsers((previous) =>
                previous.filter(
                    (user) =>
                        String(user.id ?? user.userId) !== String(userId)
                )
            );

            setDeleteDialogOpen(false);
            setUserToDelete(null);

            showNotification("success", "User deleted successfully.");
        } catch (error) {
            showNotification(
                "error",
                getErrorMessage(error, "Failed to delete user.")
            );
        } finally {
            setDeleting(false);
        }
    }, [canDeleteUsers, clearNotification, showNotification, userToDelete]);

    // -----------------------------------------------------
    // DataTable columns
    // -----------------------------------------------------

    const columns = useMemo(
        () => [
            {
                field: "serialNumber",
                headerName: "S.No",
                minWidth: 75,
                maxWidth: 85,
                sortable: false,
                filterable: false,
                searchable: false,
                renderCell: (row) =>
                    users.findIndex(
                        (user) =>
                            String(user.id ?? user.userId) ===
                            String(row.id ?? row.userId)
                    ) + 1,
            },
            {
                field: "firstName",
                headerName: "First Name",
                minWidth: 140,
                flex: 1,
            },
            {
                field: "lastName",
                headerName: "Last Name",
                minWidth: 140,
                flex: 1,
            },
            {
                field: "username",
                headerName: "Username",
                minWidth: 150,
                flex: 1,
            },
            {
                field: "email",
                headerName: "Email",
                minWidth: 210,
                flex: 1,
            },
            {
                field: "phoneNumber",
                headerName: "Phone",
                minWidth: 140,
                renderCell: (row) => row.phoneNumber || "—",
            },
            {
                field: "roleName",
                headerName: "Role",
                minWidth: 130,
                renderCell: (row) => getRoleName(row) || "—",
            },
            {
                field: "status",
                headerName: "Status",
                minWidth: 130,
                renderCell: (row) => <StatusChip status={row.status} />,
            },
            {
                field: "isActive",
                headerName: "Active",
                minWidth: 90,
                maxWidth: 100,
                sortable: false,
                filterable: false,
                searchable: false,
                renderCell: (row) => (
                    <BooleanStatusIcon value={row.isActive} type="active" />
                ),
            },
            {
                field: "isLocked",
                headerName: "Locked",
                minWidth: 90,
                maxWidth: 100,
                sortable: false,
                filterable: false,
                searchable: false,
                renderCell: (row) => (
                    <BooleanStatusIcon value={row.isLocked} type="locked" />
                ),
            },
            {
                field: "actions",
                headerName: "Actions",
                minWidth: 250,
                sortable: false,
                filterable: false,
                searchable: false,
                renderCell: (row) => {
                    const pendingInstructor = isPendingInstructor(row);
                    const rowId = String(row.id ?? row.userId ?? "");
                    const isProcessing = processingApprovalId === rowId;

                    return (
                        <Stack
                            direction="row"
                            spacing={0.25}
                            alignItems="center"
                        >
                            {canViewUsers && (
                                <Tooltip title="View user">
                                    <IconButton
                                        size="small"
                                        aria-label="View user"
                                        onClick={() => openDrawer(row, "view")}
                                    >
                                        <VisibilityOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}

                            {canUpdateUsers && (
                                <Tooltip title="Edit user">
                                    <IconButton
                                        size="small"
                                        aria-label="Edit user"
                                        onClick={() => handleEdit(row)}
                                    >
                                        <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}

                            {pendingInstructor && canUpdateUsers && (
                                <>
                                    <Tooltip title="Approve instructor">
                                        <span>
                                            <IconButton
                                                size="small"
                                                color="success"
                                                aria-label="Approve instructor"
                                                disabled={isProcessing}
                                                onClick={() => handleApprove(row)}
                                            >
                                                {isProcessing ? (
                                                    <CircularProgress size={18} />
                                                ) : (
                                                    <CheckCircleOutlineIcon fontSize="small" />
                                                )}
                                            </IconButton>
                                        </span>
                                    </Tooltip>

                                    <Tooltip title="Reject instructor">
                                        <span>
                                            <IconButton
                                                size="small"
                                                color="warning"
                                                aria-label="Reject instructor"
                                                disabled={isProcessing}
                                                onClick={() => openRejectDialog(row)}
                                            >
                                                <CancelOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </>
                            )}

                            {canDeleteUsers && (
                                <Tooltip title="Delete user">
                                    <IconButton
                                        size="small"
                                        color="error"
                                        aria-label="Delete user"
                                        onClick={() => openDeleteDialog(row)}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Stack>
                    );
                },
            },
        ],
        [
            users,
            canViewUsers,
            canUpdateUsers,
            canDeleteUsers,
            processingApprovalId,
            handleEdit,
            handleApprove,
            openRejectDialog,
            openDeleteDialog,
            openDrawer,
        ]
    );

    const isReadOnly = drawerMode === "view" || !canUpdateUsers;
    const activeUsersCount = users.filter((user) => user.isActive).length;
    const pendingInstructorCount = users.filter(isPendingInstructor).length;

    // -----------------------------------------------------
    // Render
    // -----------------------------------------------------

    return (
        <Box
            sx={{
                p: { xs: 1.5, sm: 2.25, lg: 3 },
                backgroundColor: "transparent",
                color: "text.primary",
                minWidth: 0,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    mb: 2.5,
                    p: { xs: 2, sm: 2.5 },
                    border: "1px solid #e8eaf2",
                    borderRadius: 3,
                    background:
                        "linear-gradient(125deg, #ffffff 0%, #f3f6ff 100%)",
                    boxShadow: "0 8px 28px rgba(20, 35, 70, 0.06)",
                }}
            >
                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                        alignItems: { xs: "stretch", sm: "center" },
                        justifyContent: "space-between",
                    }}
                >
                    <Stack direction="row" spacing={1.75} alignItems="center">
                        <Avatar
                            variant="rounded"
                            sx={{
                                width: 52,
                                height: 52,
                                borderRadius: 2.5,
                                color: "#3659d9",
                                background:
                                    "linear-gradient(145deg, #e9edff, #dce5ff)",
                            }}
                        >
                            <PeopleAltOutlinedIcon />
                        </Avatar>
                        <Box>
                            <Typography
                                variant="h5"
                                sx={{
                                    color: "#17213b",
                                    fontWeight: 800,
                                    letterSpacing: "-0.025em",
                                }}
                            >
                                Users
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ mt: 0.35, color: "#68738d" }}
                            >
                                Review accounts, update profiles, and manage instructor approvals.
                            </Typography>
                        </Box>
                    </Stack>

                    <Box
                        sx={{
                            minWidth: { xs: 0, sm: 150 },
                            px: 2,
                            py: 1.25,
                            border: "1px solid rgba(78, 102, 184, 0.14)",
                            borderRadius: 2.5,
                            backgroundColor: "rgba(255, 255, 255, 0.72)",
                        }}
                    >
                        <Typography
                            sx={{
                                color: "#6c7690",
                                fontSize: 11,
                                fontWeight: 750,
                                letterSpacing: "0.07em",
                                textTransform: "uppercase",
                            }}
                        >
                            Total users
                        </Typography>
                        <Typography
                            sx={{
                                mt: 0.25,
                                color: "#17213b",
                                fontSize: 24,
                                fontWeight: 850,
                                lineHeight: 1.15,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {users.length}
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            {notification.message && (
                <Alert
                    severity={notification.type}
                    onClose={clearNotification}
                    sx={{ mb: 2 }}
                >
                    {notification.message}
                </Alert>
            )}

            {!accessLoading && !canViewUsers && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    This menu is available through your assigned permissions, but the user list requires the USER_VIEW permission.
                </Alert>
            )}

            {canViewUsers && (
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
                    {[
                        {
                            label: "All accounts",
                            value: users.length,
                            icon: <PeopleAltOutlinedIcon />,
                            color: "#4666dc",
                            background: "#edf0ff",
                        },
                        {
                            label: "Active accounts",
                            value: activeUsersCount,
                            icon: <CheckCircleOutlineIcon />,
                            color: "#16815f",
                            background: "#e7f7f0",
                        },
                        {
                            label: "Pending instructors",
                            value: pendingInstructorCount,
                            icon: <PendingActionsOutlinedIcon />,
                            color: "#bf7417",
                            background: "#fff3df",
                        },
                    ].map((metric) => (
                        <Paper
                            key={metric.label}
                            elevation={0}
                            sx={{
                                p: 2,
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                border: "1px solid #e8eaf2",
                                borderRadius: 2.5,
                                backgroundColor: "#fff",
                                boxShadow: "0 4px 16px rgba(20, 35, 70, 0.035)",
                            }}
                        >
                            <Avatar
                                variant="rounded"
                                sx={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 2,
                                    color: metric.color,
                                    backgroundColor: metric.background,
                                }}
                            >
                                {metric.icon}
                            </Avatar>
                            <Box>
                                <Typography
                                    sx={{
                                        color: "#6c7690",
                                        fontSize: 12,
                                        fontWeight: 650,
                                    }}
                                >
                                    {metric.label}
                                </Typography>
                                <Typography
                                    sx={{
                                        mt: 0.2,
                                        color: "#17213b",
                                        fontSize: 22,
                                        fontWeight: 800,
                                        lineHeight: 1.2,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {metric.value}
                                </Typography>
                            </Box>
                        </Paper>
                    ))}
                </Box>
            )}

            {(canViewUsers || accessLoading) && (
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 1, sm: 1.75 },
                        border: "1px solid #e8eaf2",
                        borderRadius: 3,
                        backgroundColor: "#fff",
                        boxShadow: "0 8px 28px rgba(20, 35, 70, 0.045)",
                        minWidth: 0,
                    }}
                >
                    <DataTable
                        title="User directory"
                        rows={users}
                        columns={columns}
                        loading={loading || accessLoading}
                        onRefresh={loadUsers}
                        getRowId={(row) => String(row.id ?? row.userId)}
                    />
                </Paper>
            )}

            {/* User details/edit drawer */}
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={closeDrawer}
                PaperProps={{
                    sx: {
                        width: { xs: "100%", sm: 520, md: 600 },
                        maxWidth: "100vw",
                        backgroundImage: "none",
                    },
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                    }}
                >
                    <Box
                        sx={{
                            px: 3,
                            py: 2.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Box>
                            <Typography variant="h6" fontWeight={700}>
                                {isReadOnly ? "User Details" : "Edit User"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {isReadOnly
                                    ? "View account information."
                                    : "Update the user's profile and account settings."}
                            </Typography>
                        </Box>

                        <IconButton
                            aria-label="Close user panel"
                            onClick={closeDrawer}
                            disabled={saving}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    <Divider />

                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            px: 3,
                            py: 3,
                        }}
                    >
                        {selectedUser && (
                            <Stack spacing={3}>
                                <Box>
                                    <Typography
                                        variant="subtitle2"
                                        fontWeight={700}
                                        sx={{ mb: 2 }}
                                    >
                                        Personal Information
                                    </Typography>

                                    <Stack spacing={2}>
                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={2}
                                        >
                                            <TextField
                                                fullWidth
                                                label="First Name"
                                                value={form.firstName}
                                                onChange={(event) =>
                                                    handleFormChange(
                                                        "firstName",
                                                        event.target.value
                                                    )
                                                }
                                                error={Boolean(formErrors.firstName)}
                                                helperText={formErrors.firstName}
                                                disabled={isReadOnly || saving}
                                                required
                                            />

                                            <TextField
                                                fullWidth
                                                label="Last Name"
                                                value={form.lastName}
                                                onChange={(event) =>
                                                    handleFormChange(
                                                        "lastName",
                                                        event.target.value
                                                    )
                                                }
                                                disabled={isReadOnly || saving}
                                            />
                                        </Stack>

                                        <TextField
                                            fullWidth
                                            label="Username"
                                            value={form.username}
                                            onChange={(event) =>
                                                handleFormChange(
                                                    "username",
                                                    event.target.value
                                                )
                                            }
                                            error={Boolean(formErrors.username)}
                                            helperText={formErrors.username}
                                            disabled={isReadOnly || saving}
                                            required
                                        />

                                        <TextField
                                            fullWidth
                                            label="Email"
                                            type="email"
                                            value={form.email}
                                            onChange={(event) =>
                                                handleFormChange(
                                                    "email",
                                                    event.target.value
                                                )
                                            }
                                            error={Boolean(formErrors.email)}
                                            helperText={formErrors.email}
                                            disabled={isReadOnly || saving}
                                            required
                                        />

                                        <TextField
                                            fullWidth
                                            label="Phone Number"
                                            value={form.phoneNumber}
                                            onChange={(event) =>
                                                handleFormChange(
                                                    "phoneNumber",
                                                    event.target.value
                                                )
                                            }
                                            error={Boolean(formErrors.phoneNumber)}
                                            helperText={
                                                formErrors.phoneNumber ||
                                                "Optional; include country code if applicable."
                                            }
                                            disabled={isReadOnly || saving}
                                        />
                                    </Stack>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography
                                        variant="subtitle2"
                                        fontWeight={700}
                                        sx={{ mb: 2 }}
                                    >
                                        Role and Status
                                    </Typography>

                                    <Stack spacing={2}>
                                        <TextField
                                            fullWidth
                                            label="Role"
                                            value={form.roleName}
                                            disabled
                                            helperText="Role assignment is managed by the backend."
                                        />

                                        <FormControl
                                            fullWidth
                                            error={Boolean(formErrors.status)}
                                            disabled={isReadOnly || saving}
                                        >
                                            <InputLabel id="user-status-label">
                                                Status
                                            </InputLabel>

                                            <Select
                                                labelId="user-status-label"
                                                label="Status"
                                                value={form.status}
                                                onChange={(event) =>
                                                    handleFormChange(
                                                        "status",
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                {USER_STATUSES.map((status) => (
                                                    <MenuItem
                                                        key={status}
                                                        value={status}
                                                    >
                                                        {getStatusLabel(status)}
                                                    </MenuItem>
                                                ))}
                                            </Select>

                                            {formErrors.status && (
                                                <Typography
                                                    variant="caption"
                                                    color="error"
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    {formErrors.status}
                                                </Typography>
                                            )}
                                        </FormControl>
                                    </Stack>
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography
                                        variant="subtitle2"
                                        fontWeight={700}
                                        sx={{ mb: 1 }}
                                    >
                                        Account Settings
                                    </Typography>

                                    <Stack spacing={1}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={toBoolean(form.isActive)}
                                                    onChange={(event) =>
                                                        handleFormChange(
                                                            "isActive",
                                                            event.target.checked
                                                        )
                                                    }
                                                    disabled={isReadOnly || saving}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography variant="body2">
                                                        Active Account
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Allow this user to access the platform.
                                                    </Typography>
                                                </Box>
                                            }
                                        />

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={toBoolean(form.isLocked)}
                                                    onChange={(event) =>
                                                        handleFormChange(
                                                            "isLocked",
                                                            event.target.checked
                                                        )
                                                    }
                                                    disabled={isReadOnly || saving}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography variant="body2">
                                                        Locked Account
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Restrict this user's account when locked.
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </Stack>
                                </Box>

                                {isReadOnly && (
                                    <>
                                        <Divider />
                                        <Box>
                                            <Typography
                                                variant="subtitle2"
                                                fontWeight={700}
                                                sx={{ mb: 2 }}
                                            >
                                                Current Account State
                                            </Typography>

                                            <Stack
                                                direction="row"
                                                spacing={2}
                                                flexWrap="wrap"
                                                useFlexGap
                                                alignItems="center"
                                            >
                                                <StatusChip status={form.status} />
                                                <BooleanStatusIcon
                                                    value={form.isActive}
                                                    type="active"
                                                />
                                                <BooleanStatusIcon
                                                    value={form.isLocked}
                                                    type="locked"
                                                />
                                            </Stack>
                                        </Box>
                                    </>
                                )}
                            </Stack>
                        )}
                    </Box>

                    <Divider />

                    <Box sx={{ px: 3, py: 2 }}>
                        <Stack
                            direction="row"
                            justifyContent="flex-end"
                            spacing={1.5}
                        >
                            <Button
                                variant="outlined"
                                onClick={closeDrawer}
                                disabled={saving}
                            >
                                {isReadOnly ? "Close" : "Cancel"}
                            </Button>

                            {!isReadOnly && (
                                <Button
                                    variant="contained"
                                    onClick={handleSave}
                                    disabled={saving}
                                    startIcon={
                                        saving ? (
                                            <CircularProgress
                                                size={18}
                                                color="inherit"
                                            />
                                        ) : null
                                    }
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </Button>
                            )}
                        </Stack>
                    </Box>
                </Box>
            </Drawer>

            {/* Reject instructor dialog */}
            <Dialog
                open={rejectDialogOpen}
                onClose={closeRejectDialog}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Reject Instructor Registration</DialogTitle>

                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Reject registration for{" "}
                        <strong>
                            {userToReject?.username ||
                                userToReject?.email ||
                                "this instructor"}
                        </strong>
                        ? You can optionally provide a reason.
                    </Typography>

                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={6}
                        label="Rejection reason (optional)"
                        value={rejectionReason}
                        onChange={(event) =>
                            setRejectionReason(event.target.value)
                        }
                        inputProps={{ maxLength: 5000 }}
                        helperText={`${rejectionReason.length}/5000 characters`}
                        disabled={Boolean(processingApprovalId)}
                    />
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={closeRejectDialog}
                        disabled={Boolean(processingApprovalId)}
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleReject}
                        disabled={Boolean(processingApprovalId)}
                        startIcon={
                            processingApprovalId ? (
                                <CircularProgress size={18} color="inherit" />
                            ) : (
                                <CancelOutlinedIcon />
                            )
                        }
                    >
                        {processingApprovalId ? "Processing..." : "Reject"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog
                open={deleteDialogOpen}
                onClose={closeDeleteDialog}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>Delete User</DialogTitle>

                <DialogContent>
                    <Typography variant="body2">
                        Are you sure you want to delete{" "}
                        <strong>
                            {userToDelete?.username ||
                                userToDelete?.email ||
                                "this user"}
                        </strong>
                        ? This action cannot be undone.
                    </Typography>
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={closeDeleteDialog}
                        disabled={deleting}
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleDelete}
                        disabled={deleting}
                        startIcon={
                            deleting ? (
                                <CircularProgress size={18} color="inherit" />
                            ) : (
                                <DeleteOutlineIcon />
                            )
                        }
                    >
                        {deleting ? "Deleting..." : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
