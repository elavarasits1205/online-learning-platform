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
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";

import DataTable from "../../component/tables/DataTable";
import CrudFormDrawer from "../../component/forms/CrudFormDrawer";

import {
    getAllCourseCategories,
    getCourseCategoryById,
    createCourseCategory,
    updateCourseCategory,
    deleteCourseCategory,
} from "../../service/courseCategoryApi";

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const EMPTY_FORM = {
    code: "",
    name: "",
    description: "",
    parent_category_id: "",
    display_order: 0,
    is_active: true,
};

function getErrorMessage(error) {
    return (
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong. Please try again."
    );
}

// Keep PostgreSQL BIGINT IDs as strings.
function normalizeId(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    return String(value);
}

function normalizeBoolean(value, fallback = true) {
    if (typeof value === "boolean") return value;

    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        if (["true", "yes", "active"].includes(normalized)) {
            return true;
        }

        if (["false", "no", "inactive"].includes(normalized)) {
            return false;
        }
    }

    return fallback;
}

function normalizeCategory(category = {}) {
    return {
        ...category,
        id: normalizeId(category.id),
        code: category.code ?? "",
        name: category.name ?? "",
        description: category.description ?? "",
        parent_category_id:
            category.parent_category_id === null ||
            category.parent_category_id === undefined
                ? ""
                : String(category.parent_category_id),
        display_order: Number(category.display_order ?? 0),
        is_active: normalizeBoolean(category.is_active, true),
        soft_delete: normalizeBoolean(category.soft_delete, false),
    };
}

// ---------------------------------------------------------
// Status icon
// ---------------------------------------------------------

function CategoryStatusIcon({ isActive, size = "small" }) {
    const active = normalizeBoolean(isActive, false);

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
// Category form
// ---------------------------------------------------------

function CourseCategoryForm({
    mode,
    row,
    categories,
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

    // Load the selected category when viewing or editing.
    useEffect(() => {
        let cancelled = false;

        async function loadCategory() {
            setFormError("");

            if (isCreate) {
                setForm({ ...EMPTY_FORM });
                setLoadingDetails(false);
                return;
            }

            const id = row?.id;

            if (!id || !/^[1-9]\d*$/.test(String(id))) {
                setFormError("Invalid course category ID.");
                setLoadingDetails(false);
                return;
            }

            setLoadingDetails(true);

            try {
                const response = await getCourseCategoryById(String(id));

                if (cancelled) return;

                if (!response?.success || !response?.data) {
                    throw new Error(
                        response?.message ||
                            "Unable to load course category details."
                    );
                }

                setForm(normalizeCategory(response.data));
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

        loadCategory();

        return () => {
            cancelled = true;
        };
    }, [isCreate, row?.id]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));

        setFormError("");
    };

    const validateForm = () => {
        const code = String(form.code ?? "").trim();
        const name = String(form.name ?? "").trim();

        if (!code) {
            return "Category code is required.";
        }

        if (code.length > 50) {
            return "Category code must not exceed 50 characters.";
        }

        if (!name) {
            return "Category name is required.";
        }

        if (name.length > 150) {
            return "Category name must not exceed 150 characters.";
        }

        if (String(form.description ?? "").length > 10000) {
            return "Description must not exceed 10000 characters.";
        }

        if (
            !Number.isSafeInteger(Number(form.display_order)) ||
            Number(form.display_order) < 0
        ) {
            return "Display order must be a non-negative integer.";
        }

        if (form.parent_category_id) {
            if (
                !/^[1-9]\d*$/.test(String(form.parent_category_id))
            ) {
                return "Invalid parent category ID.";
            }

            if (
                isEdit &&
                String(form.parent_category_id) === String(row?.id)
            ) {
                return "A category cannot be its own parent.";
            }
        }

        if (typeof form.is_active !== "boolean") {
            return "Please select a valid category status.";
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

        const payload = {
            code: String(form.code).trim(),
            name: String(form.name).trim(),
            description: String(form.description ?? "").trim() || null,
            parent_category_id: form.parent_category_id
                ? String(form.parent_category_id)
                : null,
            display_order: Number(form.display_order),
            is_active: form.is_active,
        };

        setSaving(true);
        setFormError("");

        try {
            let response;

            if (isCreate) {
                response = await createCourseCategory(payload);
            } else if (isEdit) {
                response = await updateCourseCategory(
                    String(row.id),
                    payload
                );
            } else {
                return;
            }

            if (!response?.success) {
                throw new Error(
                    response?.message ||
                        "Unable to save course category."
                );
            }

            await onSuccess(
                response.message ||
                    (isCreate
                        ? "Course category created successfully."
                        : "Course category updated successfully.")
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
                    Loading category details...
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
                <CategoryOutlinedIcon
                    color="primary"
                    sx={{ fontSize: 34 }}
                />

                <Box>
                    <Typography variant="h6" fontWeight={700}>
                        {isCreate
                            ? "Add Course Category"
                            : isEdit
                              ? "Edit Course Category"
                              : "Course Category Details"}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        {isCreate
                            ? "Create a category for organizing courses."
                            : isEdit
                              ? "Update the selected course category."
                              : "View the selected category information."}
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
                label="Category Code"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                fullWidth
                size="small"
                disabled={readOnly}
                inputProps={{ maxLength: 50 }}
                placeholder="e.g. PROGRAMMING"
            />

            <TextField
                label="Category Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
                size="small"
                disabled={readOnly}
                inputProps={{ maxLength: 150 }}
                placeholder="e.g. Programming"
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
                placeholder="Describe this course category."
            />

            <FormControl fullWidth size="small">
                <InputLabel id="parent-category-label">
                    Parent Category
                </InputLabel>

                <Select
                    labelId="parent-category-label"
                    label="Parent Category"
                    name="parent_category_id"
                    value={form.parent_category_id}
                    onChange={handleChange}
                    disabled={readOnly}
                >
                    <MenuItem value="">
                        <em>No parent category</em>
                    </MenuItem>

                    {categories
                        .filter(
                            (category) =>
                                !isEdit ||
                                String(category.id) !== String(row?.id)
                        )
                        .map((category) => (
                            <MenuItem
                                key={String(category.id)}
                                value={String(category.id)}
                            >
                                {category.name} ({category.code})
                            </MenuItem>
                        ))}
                </Select>
            </FormControl>

            <TextField
                label="Display Order"
                name="display_order"
                type="text"
                value={form.display_order}
                onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9]/g, "");

                    setForm((previous) => ({
                        ...previous,
                        display_order: value === "" ? "" : Number(value),
                    }));

                    setFormError("");
                }}
                required
                fullWidth
                size="small"
                disabled={readOnly}
                inputProps={{
                    inputMode: "numeric",
                    pattern: "[0-9]*",
                    "aria-label": "Display order",
                }}
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
                            Category Status
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            {form.is_active
                                ? "This category is active."
                                : "This category is inactive."}
                        </Typography>
                    </Box>

                    {readOnly ? (
                        <CategoryStatusIcon
                            isActive={form.is_active}
                            size="medium"
                        />
                    ) : (
                        <FormControlLabel
                            sx={{ mr: 0 }}
                            label={form.is_active ? "Active" : "Inactive"}
                            control={
                                <Switch
                                    checked={form.is_active}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            is_active: event.target.checked,
                                        }))
                                    }
                                    color="success"
                                />
                            }
                        />
                    )}
                </Stack>
            </Box>

            {isView && (
                <TextField
                    label="Soft Deleted"
                    value={form.soft_delete ? "Yes" : "No"}
                    fullWidth
                    size="small"
                    disabled
                />
            )}

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
                              ? "Create Category"
                              : "Save Changes"}
                    </Button>
                )}
            </Stack>
        </Box>
    );
}

// ---------------------------------------------------------
// Course Category Management Page
// ---------------------------------------------------------

export default function CourseCategoryPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [pageSuccess, setPageSuccess] = useState("");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState("create");
    const [selectedCategory, setSelectedCategory] = useState(null);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        setPageError("");

        try {
            const response = await getAllCourseCategories();

            if (!response?.success) {
                throw new Error(
                    response?.message ||
                        "Unable to load course categories."
                );
            }

            const result = Array.isArray(response.data)
                ? response.data
                : [];

            setCategories(
                result
                    .map(normalizeCategory)
                    .filter((category) => !category.soft_delete)
            );
        } catch (error) {
            setPageError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const openDialog = useCallback((mode, category = null) => {
        setPageError("");
        setPageSuccess("");
        setDialogMode(mode);
        setSelectedCategory(
            category ? normalizeCategory(category) : null
        );
        setDialogOpen(true);
    }, []);

    const closeDialog = useCallback(() => {
        setDialogOpen(false);
        setSelectedCategory(null);
        setDialogMode("create");
    }, []);

    const handleAdd = useCallback(() => {
        openDialog("create");
    }, [openDialog]);

    const handleView = useCallback(
        (category) => openDialog("view", category),
        [openDialog]
    );

    const handleEdit = useCallback(
        (category) => openDialog("edit", category),
        [openDialog]
    );

    const handleFormError = useCallback((message) => {
        setPageError(message);
    }, []);

    const handleFormSuccess = useCallback(
        async (message) => {
            await loadCategories();
            setPageSuccess(message);
            setPageError("");
            closeDialog();
        },
        [loadCategories, closeDialog]
    );

    const handleDelete = useCallback(
        async (category) => {
            if (
                !category?.id ||
                !/^[1-9]\d*$/.test(String(category.id))
            ) {
                setPageError("Invalid course category ID.");
                return;
            }

            const confirmed = window.confirm(
                `Are you sure you want to delete "${category.name}" (${category.code})? This will soft-delete the category.`
            );

            if (!confirmed) return;

            setPageError("");
            setPageSuccess("");

            try {
                const response = await deleteCourseCategory(
                    String(category.id)
                );

                if (!response?.success) {
                    throw new Error(
                        response?.message ||
                            "Unable to delete course category."
                    );
                }

                setPageSuccess(
                    response.message ||
                        "Course category soft-deleted successfully."
                );

                await loadCategories();
            } catch (error) {
                setPageError(getErrorMessage(error));
            }
        },
        [loadCategories]
    );

    const columns = useMemo(
        () => [
            {
                field: "code",
                headerName: "Category Code",
                minWidth: 150,
            },
            {
                field: "name",
                headerName: "Category Name",
                minWidth: 180,
            },
            {
                field: "description",
                headerName: "Description",
                minWidth: 220,
                maxWidth: 350,
                nowrap: false,
                valueGetter: (row) => row?.description || "—",
                exportValue: (row) => row?.description || "",
            },
            {
                field: "parent_category_id",
                headerName: "Parent Category",
                minWidth: 170,
                valueGetter: (row) => {
                    if (!row?.parent_category_id) {
                        return "—";
                    }

                    const parent = categories.find(
                        (category) =>
                            String(category.id) ===
                            String(row.parent_category_id)
                    );

                    return parent
                        ? parent.name
                        : `Category ID ${row.parent_category_id}`;
                },
            },
            {
                field: "display_order",
                headerName: "Display Order",
                minWidth: 120,
                align: "center",
            },
            {
                field: "is_active",
                headerName: "Status",
                minWidth: 90,
                align: "center",
                searchable: false,
                exportValue: (row) =>
                    normalizeBoolean(row?.is_active, false)
                        ? "Active"
                        : "Inactive",
                renderCell: (row) => (
                    <CategoryStatusIcon
                        isActive={row?.is_active}
                        size="small"
                    />
                ),
            },
        ],
        [categories]
    );

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 3 }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <CategoryOutlinedIcon
                        color="primary"
                        sx={{ fontSize: 34 }}
                    />

                    <Box>
                        <Typography variant="h5" fontWeight={700}>
                            Course Category Management
                        </Typography>

                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            Create and manage course categories.
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
                title="Course Categories"
                rows={categories}
                columns={columns}
                loading={loading}
                getRowId={(category) => String(category.id)}
                onAdd={handleAdd}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRefresh={loadCategories}
                addLabel="Add Category"
                searchPlaceholder="Search categories..."
                emptyMessage="No course categories found."
                minWidth={1050}
                pagination
            />

            <CrudFormDrawer
                open={dialogOpen}
                onClose={(_event, reason) => {
                    if (reason === "backdropClick") return;
                    closeDialog();
                }}
                fullWidth
                maxWidth="sm"
                scroll="paper"
                aria-labelledby="course-category-dialog-title"
            >
                <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <CourseCategoryForm
                        key={`${dialogMode}-${selectedCategory?.id ?? "new"}`}
                        mode={dialogMode}
                        row={selectedCategory}
                        categories={categories}
                        onClose={closeDialog}
                        onError={handleFormError}
                        onSuccess={handleFormSuccess}
                    />
                </DialogContent>
            </CrudFormDrawer>
        </Box>
    );
}
