import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";

import DataTable from "../../../component/tables/DataTable";
import CrudFormDrawer from "../../../component/forms/CrudFormDrawer";
import { getMyAccess } from "../../../service/Authapi";

// ============================================================
// DESIGN TOKENS
// ============================================================

const COLORS = {
  primary: "#6d4aff",
  primaryDark: "#5134d7",
  primaryLight: "#eee9ff",
  text: "#17152b",
  muted: "#6e7086",
  border: "#e5e3ef",
  background: "#ffffff",
  danger: "#d64545",
};

// ============================================================
// FIELD STYLES
// These styles intentionally override common global CSS rules.
// ============================================================

const fieldSx = {
  width: "100%",
  "& .MuiInputLabel-root": {
    color: `${COLORS.muted} !important`,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "13px",
    fontWeight: 600,
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: `${COLORS.primary} !important`,
  },
  "& .MuiOutlinedInput-root": {
    width: "100%",
    minHeight: 54,
    borderRadius: "12px",
    backgroundColor: `${COLORS.background} !important`,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "14px",
    transition: "box-shadow 160ms ease, border-color 160ms ease",
    "& fieldset": {
      borderColor: `${COLORS.border} !important`,
      borderWidth: "1px",
    },
    "&:hover fieldset": {
      borderColor: `${COLORS.primary} !important`,
    },
    "&.Mui-focused fieldset": {
      borderColor: `${COLORS.primary} !important`,
      borderWidth: "1px",
    },
    "&.Mui-focused": {
      boxShadow: "0 0 0 3px rgba(109, 74, 255, 0.12)",
    },
    "&.Mui-error fieldset": {
      borderColor: `${COLORS.danger} !important`,
    },
  },
  "& .MuiOutlinedInput-input": {
    padding: "14px 15px",
    color: `${COLORS.text} !important`,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "14px",
  },
  "& .MuiSelect-select": {
    minHeight: "unset",
    display: "flex",
    alignItems: "center",
    padding: "14px 42px 14px 15px !important",
    whiteSpace: "nowrap",
    overflowX: "auto",
    overflowY: "hidden",
    textOverflow: "clip",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
    lineHeight: 1.35,
    color: `${COLORS.text} !important`,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "14px",
  },
  "& .MuiFormHelperText-root": {
    marginLeft: 0,
    marginTop: "6px",
    fontSize: "12px",
    lineHeight: 1.45,
  },
};

const checkboxSx = {
  color: COLORS.muted,
  "&.Mui-checked": {
    color: `${COLORS.primary} !important`,
  },
};

const primaryButtonSx = {
  backgroundColor: `${COLORS.primary} !important`,
  color: "#ffffff !important",
  borderRadius: "9px",
  minHeight: 42,
  px: 2.5,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 700,
  textTransform: "none",
  boxShadow: "none",
  "&:hover": {
    backgroundColor: `${COLORS.primaryDark} !important`,
    boxShadow: "none",
  },
  "&.Mui-disabled": {
    backgroundColor: "#c7bee9 !important",
    color: "#ffffff !important",
  },
};

// ============================================================
// HELPERS
// ============================================================

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong. Please try again.";

const validateId = (id) => {
  const value = String(id ?? "").trim();

  return /^[1-9]\d*$/.test(value) ? value : null;
};

const normalizeCode = (value) => String(value ?? "").trim().toUpperCase();

const normalizeCodes = (values) =>
  Array.isArray(values)
    ? values.map((value) =>
        normalizeCode(
          typeof value === "string"
            ? value
            : value?.code ?? value?.permissionCode ?? value?.permission_code
        )
      )
    : [];

const getInitialValue = (field) => {
  if (field.type === "boolean") {
    return field.defaultValue ?? true;
  }

  return field.defaultValue ?? "";
};

// Date inputs require YYYY-MM-DD. DATE values may arrive as plain date
// strings or as ISO timestamps depending on the API response.
const toDateInputValue = (value) => {
  if (value === null || value === undefined || value === "") return "";

  const stringValue = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  const date = new Date(stringValue);

  if (Number.isNaN(date.getTime())) {
    return stringValue.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isFieldVisible = (field, form, mode, roles = []) => {
  if (
    Array.isArray(field.roles) &&
    !field.roles.some((role) => roles.includes(normalizeCode(role)))
  ) {
    return false;
  }

  if (typeof field.visibleWhen !== "function") return true;
  return Boolean(field.visibleWhen(form, mode));
};

const isFieldRequired = (field, form) => {
  if (field.required) return true;
  if (typeof field.requiredWhen !== "function") return false;
  return Boolean(field.requiredWhen(form));
};

const createInitialForm = (fields) =>
  Object.fromEntries(
    fields.map((field) => [
      field.name,
      getInitialValue(field),
    ])
  );

const toPayloadValue = (field, value) => {
  if (field.type === "boolean") {
    return Boolean(value);
  }

  if (value === "" || value === undefined || value === null) {
    return null;
  }

  if (field.type === "number") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  if (field.type === "date") {
    return toDateInputValue(value);
  }

  // Keep BIGINT IDs as strings.
  return String(value);
};

const getDetailValue = (row, column) => {
  if (!row || typeof row !== "object" || !column) return "-";

  let value;

  if (typeof column.valueGetter === "function") {
    value = column.valueGetter(row);
  } else if (column.field) {
    value = row?.[column.field];
  }

  if (typeof column.render === "function") {
    return column.render(value, row) ?? "-";
  }

  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const getDropdownOptionValue = (option, field, fallbackKey) =>
  option[field.optionValue || fallbackKey] ?? option.value ?? option.id;

const getDropdownOptionLabel = (option, field, value, fallbackKey) => {
  if (typeof field.optionLabel === "function") return field.optionLabel(option);
  return option[field.optionLabel || fallbackKey] || option.label || String(value);
};

// ============================================================
// COMPONENT
// ============================================================

export default function PayrollResourcePage({ config }) {
  const {
    title,
    description,
    api,
    fields = [],
    columns = [],
    filters = [],
    rowWorkflowAction,
  } = config;

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowConfirmOpen, setWorkflowConfirmOpen] = useState(false);
  const [workflowRow, setWorkflowRow] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingRow, setViewingRow] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [form, setForm] = useState(() =>
    createInitialForm(fields)
  );

  const [fieldErrors, setFieldErrors] = useState({});

  const [options, setOptions] = useState({});
  const [optionsLoading, setOptionsLoading] = useState({});

  const [filterOptions, setFilterOptions] = useState({});
  const [filterOptionsLoading, setFilterOptionsLoading] = useState({});

  const [filterValues, setFilterValues] = useState({});

  const [access, setAccess] = useState({
    loading: Boolean(config.permissions),
    roles: [],
    permissions: [],
  });

  useEffect(() => {
    if (!config.permissions) {
      setAccess({ loading: false, roles: ["ADMIN"], permissions: [] });
      return undefined;
    }

    let cancelled = false;

    getMyAccess()
      .then((result) => {
        const value = result?.data ?? result ?? {};
        if (!cancelled) {
          setAccess({
            loading: false,
            roles: normalizeCodes(value.roles),
            permissions: normalizeCodes(value.permissions),
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAccess({ loading: false, roles: [], permissions: [] });
          setError(getErrorMessage(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config.permissions]);

  const isAdmin = access.roles.includes("ADMIN");
  const hasCapability = (action) =>
    !config.permissions ||
    isAdmin ||
    access.permissions.includes(config.permissions[action]);
  const canViewRows = hasCapability("view");
  const canManageByRole =
    !Array.isArray(config.mutationRoles) ||
    config.mutationRoles.some((role) =>
      access.roles.includes(normalizeCode(role))
    );
  const canCreate =
    canManageByRole && config.allowCreate !== false && hasCapability("create");
  const canUpdate =
    canManageByRole && config.allowUpdate !== false && hasCapability("update");
  const canDelete =
    canManageByRole && config.allowDelete !== false && hasCapability("delete");
  const canRunRowWorkflowAction = Boolean(
    rowWorkflowAction &&
      (isAdmin ||
        (rowWorkflowAction.permissions || []).every((permission) =>
          access.permissions.includes(normalizeCode(permission))
        ))
  );
  const canEditRecord = (row) =>
    canUpdate &&
    (typeof config.canEditRow !== "function" || config.canEditRow(row));
  const canDeleteRecord = (row) =>
    canDelete &&
    (typeof config.canDeleteRow !== "function" || config.canDeleteRow(row));
  const isWorkflowRowDisabled = (row) =>
    !canRunRowWorkflowAction ||
    !row ||
    !rowWorkflowAction?.getId?.(row) ||
    workflowBusy ||
    (typeof rowWorkflowAction.isDisabled === "function" &&
      rowWorkflowAction.isDisabled(row));
  const visibleFilters = filters.filter(
    (filter) =>
      !Array.isArray(filter.roles) ||
      filter.roles.some((role) => access.roles.includes(normalizeCode(role)))
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeleteRow, setSelectedDeleteRow] = useState(null);

  // ----------------------------------------------------------
  // LOAD TABLE DATA
  // ----------------------------------------------------------

  const loadRows = useCallback(async () => {
    if (config.permissions && (access.loading || !canViewRows)) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = {
        page: 1,
        limit: 100,
      };

      Object.entries(filterValues).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          params[key] = value;
        }
      });

      const result = await api.getAll(params);

      setRows(Array.isArray(result?.rows) ? result.rows : []);
    } catch (err) {
      setRows([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [access.loading, api, canViewRows, config.permissions, filterValues]);

  const openWorkflowConfirmation = (row) => {
    if (isWorkflowRowDisabled(row)) return;
    setError("");
    setSuccess("");
    setWorkflowRow(row);
    setWorkflowConfirmOpen(true);
  };

  const closeWorkflowConfirmation = () => {
    if (workflowBusy) return;
    setWorkflowConfirmOpen(false);
    setWorkflowRow(null);
  };

  const handleWorkflowAction = async () => {
    const periodId = workflowRow && rowWorkflowAction?.getId?.(workflowRow);
    if (!canRunRowWorkflowAction || !periodId || workflowBusy) return;

    setWorkflowBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await rowWorkflowAction.run(String(periodId));
      setSuccess(
        rowWorkflowAction.successMessage
          ? rowWorkflowAction.successMessage(result)
          : `${rowWorkflowAction.label || "Payroll calculation"} completed successfully.`
      );
      setWorkflowConfirmOpen(false);
      setWorkflowRow(null);
      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorkflowBusy(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // ----------------------------------------------------------
  // LOAD DROPDOWN OPTIONS
  // ----------------------------------------------------------

  const loadOptions = useCallback(async () => {
    if (
      config.permissions &&
      (access.loading || (!canCreate && !canUpdate && !canViewRows))
    ) {
      return;
    }

    const userContext = {
      isAdmin,
      roles: access.roles,
      permissions: access.permissions,
    };
    const canSeeDefinition = (definition) =>
      !Array.isArray(definition.roles) ||
      definition.roles.some((role) => access.roles.includes(normalizeCode(role)));

    const selectFields = fields.filter(
      (field) =>
        field.type === "select" &&
        canSeeDefinition(field) &&
        (typeof field.loadOptions === "function" ||
          typeof field.loadOptionsForUser === "function")
    );

    for (const field of selectFields) {
      setOptionsLoading((previous) => ({
        ...previous,
        [field.name]: true,
      }));

      try {
        const result = field.loadOptionsForUser
          ? await field.loadOptionsForUser(userContext)
          : await field.loadOptions();

        setOptions((previous) => ({
          ...previous,
          [field.name]: Array.isArray(result) ? result : [],
        }));
      } catch (err) {
        setOptions((previous) => ({
          ...previous,
          [field.name]: [],
        }));

        setError(
          `${field.label}: ${getErrorMessage(err)}`
        );
      } finally {
        setOptionsLoading((previous) => ({
          ...previous,
          [field.name]: false,
        }));
      }
    }

    const dynamicFilters = canViewRows
      ? filters.filter(
          (filter) =>
            canSeeDefinition(filter) &&
            (typeof filter.loadOptions === "function" ||
              typeof filter.loadOptionsForUser === "function")
        )
      : [];

    for (const filter of dynamicFilters) {
      setFilterOptionsLoading((previous) => ({
        ...previous,
        [filter.name]: true,
      }));

      try {
        const result = filter.loadOptionsForUser
          ? await filter.loadOptionsForUser(userContext)
          : await filter.loadOptions();

        setFilterOptions((previous) => ({
          ...previous,
          [filter.name]: Array.isArray(result) ? result : [],
        }));
      } catch (err) {
        setFilterOptions((previous) => ({
          ...previous,
          [filter.name]: [],
        }));

        setError(
          `${filter.label}: ${getErrorMessage(err)}`
        );
      } finally {
        setFilterOptionsLoading((previous) => ({
          ...previous,
          [filter.name]: false,
        }));
      }
    }
  }, [
    access.loading,
    access.permissions,
    access.roles,
    canCreate,
    canUpdate,
    canViewRows,
    config.permissions,
    fields,
    filters,
    isAdmin,
  ]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // ----------------------------------------------------------
  // FORM OPEN / CLOSE
  // ----------------------------------------------------------

  const openCreate = () => {
    if (!canCreate) return;

    setEditingRow(null);
    setForm(createInitialForm(fields));
    setFieldErrors({});
    setError("");
    setSuccess("");
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    if (!canEditRecord(row)) return;

    const nextForm = createInitialForm(fields);

    fields.forEach((field) => {
      const value = row[field.name];

      nextForm[field.name] =
        value === null || value === undefined
          ? getInitialValue(field)
          : field.type === "date"
            ? toDateInputValue(value)
            : value;
    });

    setEditingRow(row);
    setForm(nextForm);
    setFieldErrors({});
    setError("");
    setSuccess("");
    setDialogOpen(true);
  };

  const openView = async (row) => {
    if (!canViewRows) return;

    const id = validateId(row?.id);
    if (!id) {
      setError("Unable to identify the selected record.");
      return;
    }

    setViewLoading(true);
    setError("");
    setSuccess("");
    setViewingRow(row);
    setViewDialogOpen(true);

    try {
      const result = await api.getById(id);
      setViewingRow(result?.data ?? result ?? row);
    } catch (err) {
      setViewDialogOpen(false);
      setViewingRow(null);
      setError(getErrorMessage(err));
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    setViewDialogOpen(false);
    setViewingRow(null);
  };

  const closeDialog = () => {
    if (saving) return;

    setDialogOpen(false);
    setEditingRow(null);
    setFieldErrors({});
  };

  // ----------------------------------------------------------
  // FORM CHANGE
  // ----------------------------------------------------------

  const updateForm = (name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  // ----------------------------------------------------------
  // VALIDATE FORM
  // ----------------------------------------------------------

  const validateForm = () => {
    const errors = {};
    const mode = editingRow ? "edit" : "create";

    fields.forEach((field) => {
      if (!isFieldVisible(field, form, mode, access.roles)) return;

      const value = form[field.name];
      const required = isFieldRequired(field, form);

      if (
        required &&
        (value === "" || value === null || value === undefined)
      ) {
        errors[field.name] = `${field.label} is required.`;
        return;
      }

      if (
        field.type === "select" &&
        value !== "" &&
        value !== null &&
        value !== undefined
      ) {
        const availableOptions = Array.isArray(field.options)
          ? field.options
          : options[field.name] || [];

        const optionValue = String(value);

        const exists = availableOptions.some(
          (option) =>
            String(option[field.optionValue || "id"]) === optionValue
        );

        if (!exists) {
          errors[field.name] = `Select a valid ${field.label.toLowerCase()}.`;
        }
      }

      if (
        field.type === "number" &&
        value !== "" &&
        value !== null &&
        value !== undefined
      ) {
        const numberValue = Number(value);

        if (!Number.isFinite(numberValue)) {
          errors[field.name] = `${field.label} must be a valid number.`;
        } else if (field.min !== undefined && numberValue < field.min) {
          errors[field.name] = `${field.label} must be at least ${field.min}.`;
        }
      }

      if (
        !errors[field.name] &&
        typeof field.validate === "function"
      ) {
        const customError = field.validate(value, form, mode);

        if (customError) {
          errors[field.name] = customError;
        }
      }
    });

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  // ----------------------------------------------------------
  // SAVE / UPDATE
  // ----------------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if ((editingRow && !canUpdate) || (!editingRow && !canCreate)) {
      setError("You do not have permission to save this record.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    const payload = {};
    const mode = editingRow ? "edit" : "create";

    fields.forEach((field) => {
      if (!isFieldVisible(field, form, mode, access.roles)) return;

      payload[field.name] = toPayloadValue(
        field,
        form[field.name]
      );
    });

    setSaving(true);

    try {
      if (editingRow) {
        const id = validateId(editingRow.id);

        if (!id) {
          throw new Error("Invalid record ID. Cannot update this record.");
        }

        await api.update(id, payload);
        setSuccess(`${title} updated successfully.`);
      } else {
        await api.create(payload);
        setSuccess(`${title} created successfully.`);
      }

      setDialogOpen(false);
      setEditingRow(null);
      setFieldErrors({});

      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // DELETE - OPEN CONFIRMATION DIALOG
  // ----------------------------------------------------------

  const openDeleteDialog = (row) => {
    if (!canDeleteRecord(row)) return;

    if (!row) {
      setError("Unable to identify the selected record.");
      return;
    }

    setSelectedDeleteRow(row);
    setDeleteDialogOpen(true);
    setError("");
    setSuccess("");
  };

  const closeDeleteDialog = () => {
    if (deleting) return;

    setDeleteDialogOpen(false);
    setSelectedDeleteRow(null);
  };

  // ----------------------------------------------------------
  // DELETE - CALL BACKEND
  // ----------------------------------------------------------

  const handleDelete = async () => {
    if (!canDelete) {
      setError("You do not have permission to delete this record.");
      return;
    }

    if (
      typeof config.canDeleteRow === "function" &&
      !config.canDeleteRow(selectedDeleteRow)
    ) {
      setError("This record cannot be deleted in its current workflow state.");
      return;
    }

    if (!selectedDeleteRow) {
      setError("No record selected for deletion.");
      return;
    }

    const id = validateId(selectedDeleteRow.id);

    if (!id) {
      setError("Invalid record ID. Cannot delete this record.");
      return;
    }

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      // Calls the matching resource API:
      // compensationApi.remove(id), payrollPeriodApi.remove(id), etc.
      await api.remove(id);

      setDeleteDialogOpen(false);
      setSelectedDeleteRow(null);

      setSuccess(`${title} deleted successfully.`);

      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // ----------------------------------------------------------
  // FIELD RENDERING
  // ----------------------------------------------------------

  const renderField = (field) => {
    const mode = editingRow ? "edit" : "create";

    if (!isFieldVisible(field, form, mode, access.roles)) return null;

    const value = form[field.name] ?? "";
    const fieldError = fieldErrors[field.name] || "";
    const required = isFieldRequired(field, form);

    // BOOLEAN FIELD
    if (field.type === "boolean") {
      return (
        <Grid size={{ xs: 12, sm: field.fullWidth ? 12 : 6 }} key={field.name}>
          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: "9px",
              minHeight: 58,
              px: 1.5,
              display: "flex",
              alignItems: "center",
              backgroundColor: "#fff",
            }}
          >
            <FormControlLabel
              sx={{
                m: 0,
                "& .MuiFormControlLabel-label": {
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  color: COLORS.text,
                },
              }}
              control={
                <Checkbox
                  checked={Boolean(value)}
                  onChange={(event) =>
                    updateForm(field.name, event.target.checked)
                  }
                  sx={checkboxSx}
                />
              }
              label={field.label}
            />
          </Paper>
        </Grid>
      );
    }

    // SELECT FIELD
    if (field.type === "select") {
      const fieldOptions = Array.isArray(field.options)
        ? field.options
        : options[field.name] || [];
      const isLoading = Boolean(optionsLoading[field.name]);

      return (
        <Grid size={{ xs: 12, sm: field.fullWidth ? 12 : 6 }} key={field.name}>
          <FormControl
            fullWidth
            required={required}
            error={Boolean(fieldError)}
            sx={fieldSx}
          >
            <InputLabel id={`${field.name}-label`}>
              {field.label}
              {required ? " *" : ""}
            </InputLabel>

            <Select
              labelId={`${field.name}-label`}
              id={`${field.name}-select`}
              value={value === null ? "" : String(value)}
              label={`${field.label}${required ? " *" : ""}`}
              renderValue={(selected) => {
                const selectedOption = fieldOptions.find(
                  (option) =>
                    String(getDropdownOptionValue(option, field, "id")) ===
                    String(selected)
                );
                const optionValue = selectedOption
                  ? getDropdownOptionValue(selectedOption, field, "id")
                  : selected;
                const label = selectedOption
                  ? getDropdownOptionLabel(selectedOption, field, optionValue, "name")
                  : String(selected ?? "");

                return (
                  <Box
                    component="span"
                    title={label}
                    sx={{ width: "max-content", flex: "0 0 auto", whiteSpace: "nowrap" }}
                  >
                    {label}
                  </Box>
                );
              }}
              onChange={(event) =>
                updateForm(field.name, event.target.value)
              }
              disabled={isLoading}
              displayEmpty={false}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 360,
                    mt: 0.75,
                    py: 0.75,
                    minWidth: "min(420px, calc(100vw - 32px))",
                    maxWidth: "min(640px, calc(100vw - 32px))",
                    overflowX: "auto",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "12px",
                    boxShadow: "0 12px 32px rgba(23, 21, 43, 0.14)",
                    "& .MuiMenuItem-root": {
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      minHeight: 46,
                      mx: 0.75,
                      px: 1.5,
                      py: 1,
                      borderRadius: "8px",
                      whiteSpace: "nowrap",
                      lineHeight: 1.4,
                    },
                    "& .MuiMenuItem-root.Mui-selected": {
                      backgroundColor: "#eee9ff",
                      color: COLORS.primaryDark,
                    },
                  },
                },
              }}
            >
              {isLoading ? (
                <MenuItem value="" disabled>
                  Loading {field.label.toLowerCase()}...
                </MenuItem>
              ) : fieldOptions.length === 0 ? (
                <MenuItem value="" disabled>
                  No {field.label.toLowerCase()} available
                </MenuItem>
              ) : (
                fieldOptions.map((option) => {
                  const optionValue = getDropdownOptionValue(option, field, "id");
                  const optionLabel = getDropdownOptionLabel(
                    option,
                    field,
                    optionValue,
                    "name"
                  );

                  return (
                    <MenuItem
                      key={String(optionValue)}
                      value={String(optionValue)}
                    >
                      {optionLabel}
                    </MenuItem>
                  );
                })
              )}
            </Select>

            {fieldError && (
              <FormHelperText>{fieldError}</FormHelperText>
            )}

            {!fieldError && field.helperText && (
              <FormHelperText>{field.helperText}</FormHelperText>
            )}
          </FormControl>
        </Grid>
      );
    }

    // TEXT / NUMBER / DATE / TEXTAREA FIELD
    const multiline = field.type === "textarea";

    return (
      <Grid size={{ xs: 12, sm: 6 }} key={field.name}>
        <TextField
          fullWidth
          id={field.name}
          name={field.name}
          label={field.label}
          type={multiline ? "text" : field.type || "text"}
          required={required}
          value={value}
          onChange={(event) =>
            updateForm(field.name, event.target.value)
          }
          error={Boolean(fieldError)}
          helperText={fieldError || field.helperText || ""}
          multiline={multiline}
          minRows={multiline ? 3 : undefined}
          sx={fieldSx}
          InputLabelProps={
            field.type === "date"
              ? { shrink: true }
              : undefined
          }
          inputProps={{
            ...(field.type === "number"
              ? {
                  min: field.min ?? 0,
                  ...(field.max !== undefined ? { max: field.max } : {}),
                  step: field.step ?? 0.01,
                  inputMode: field.inputMode || "decimal",
                }
              : {}),
          }}
        />
      </Grid>
    );
  };

  // ----------------------------------------------------------
  // TABLE COLUMNS
  // ----------------------------------------------------------

  const tableColumns = canRunRowWorkflowAction
    ? [
        ...columns,
        {
          field: "__period_workflow_action",
          label: rowWorkflowAction.columnLabel || "Payroll Action",
          exportable: false,
          render: (_value, row) => {
            const disabled = isWorkflowRowDisabled(row);
            const label =
              typeof rowWorkflowAction.getLabel === "function"
                ? rowWorkflowAction.getLabel(row)
                : rowWorkflowAction.label || "Calculate Payroll";
            const isCalculating =
              workflowBusy &&
              String(rowWorkflowAction.getId(row)) ===
                String(rowWorkflowAction.getId(workflowRow));

            return (
              <Button
                size="small"
                variant={disabled ? "outlined" : "contained"}
                startIcon={<CalculateOutlinedIcon />}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  openWorkflowConfirmation(row);
                }}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  ...(disabled
                    ? { color: COLORS.muted, borderColor: COLORS.border }
                    : primaryButtonSx),
                }}
              >
                {isCalculating ? "Calculating..." : label}
              </Button>
            );
          },
        },
      ]
    : columns;

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        p: { xs: 2, md: 3 },
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* PAGE HEADER */}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              color: COLORS.text,
            }}
          >
            {title}
          </Typography>

          {description && (
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                color: COLORS.muted,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {description}
            </Typography>
          )}
        </Box>

      </Stack>

      {/* ALERTS */}

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

      {/* FILTERS */}

      {canViewRows && visibleFilters.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 2,
            backgroundColor: "#fff",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 2,
              alignItems: "center",
            }}
          >
            {visibleFilters.map((filter) => (
              <Box
                key={filter.name}
                sx={{ minWidth: 0, width: "100%" }}
              >
                {filter.type === "select" ||
                typeof filter.loadOptions === "function" ? (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={filter.label}
                    value={filterValues[filter.name] ?? ""}
                    onChange={(event) =>
                      setFilterValues((previous) => ({
                        ...previous,
                        [filter.name]: event.target.value,
                      }))
                    }
                    sx={fieldSx}
                    SelectProps={{
                      renderValue: (selected) => {
                        const options =
                          filter.options || filterOptions[filter.name] || [];
                        const selectedOption = options.find((option) => {
                          const optionValue =
                            option[filter.optionValue || "value"] ??
                            option.value ??
                            option.id;
                          return String(optionValue) === String(selected);
                        });
                        const optionValue = selectedOption
                          ? selectedOption[filter.optionValue || "value"] ??
                            selectedOption.value ??
                            selectedOption.id
                          : selected;
                        const label = selectedOption
                          ? typeof filter.optionLabel === "function"
                            ? filter.optionLabel(selectedOption)
                            : selectedOption[filter.optionLabel || "label"] ||
                              selectedOption.label ||
                              String(optionValue)
                          : filter.allLabel ||
                            `All ${String(filter.label || "options").toLowerCase()}`;

                        return (
                          <Box
                            component="span"
                            title={label}
                            sx={{ width: "max-content", flex: "0 0 auto", whiteSpace: "nowrap" }}
                          >
                            {label}
                          </Box>
                        );
                      },
                      MenuProps: {
                        PaperProps: {
                          sx: {
                            minWidth: "min(360px, calc(100vw - 32px))",
                            maxWidth: "min(640px, calc(100vw - 32px))",
                            overflowX: "auto",
                            "& .MuiMenuItem-root": {
                              whiteSpace: "nowrap",
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="">
                      {filter.allLabel ||
                        `All ${String(filter.label || "options").toLowerCase()}`}
                    </MenuItem>

                    {filterOptionsLoading[filter.name] ? (
                      <MenuItem value="" disabled key="__loading">
                        Loading {filter.label.toLowerCase()}...
                      </MenuItem>
                    ) : (
                      (filter.options ||
                        filterOptions[filter.name] ||
                        []
                      ).map((option) => {
                        const optionValue =
                          option[filter.optionValue || "value"] ??
                          option.value ??
                          option.id;

                        const optionLabel =
                          typeof filter.optionLabel === "function"
                            ? filter.optionLabel(option)
                            : option[filter.optionLabel || "label"] ||
                              option.label ||
                              String(optionValue);

                        return (
                          <MenuItem
                            key={String(optionValue)}
                            value={String(optionValue)}
                          >
                            {optionLabel}
                          </MenuItem>
                        );
                      })
                    )}
                  </TextField>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label={filter.label}
                    value={filterValues[filter.name] ?? ""}
                    onChange={(event) =>
                      setFilterValues((previous) => ({
                        ...previous,
                        [filter.name]: event.target.value,
                      }))
                    }
                    sx={fieldSx}
                  />
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* DATA TABLE */}

      <DataTable
        title={title}
        rows={rows}
        columns={tableColumns}
        loading={loading}
        error={null}
        getRowId={(row) => String(row.id)}
        onAdd={canCreate ? openCreate : undefined}
        onRefresh={canViewRows ? loadRows : undefined}
        onView={canViewRows ? openView : undefined}
        onEdit={canUpdate ? openEdit : undefined}
        onDelete={canDelete ? openDeleteDialog : undefined}
        canEditRow={canEditRecord}
        canDeleteRow={canDeleteRecord}
        addLabel="Add New"
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
        emptyMessage={`No ${title.toLowerCase()} records found.`}
        minWidth={1100}
        initialRowsPerPage={10}
      />

      <Dialog
        open={viewDialogOpen}
        onClose={closeView}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "14px", overflow: "hidden" } }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            color: COLORS.text,
          }}
        >
          <Box>
            <Typography component="div" fontWeight={800}>
              {title} Details
            </Typography>
            <Typography variant="caption" sx={{ color: COLORS.muted }}>
              Record #{viewingRow?.id || "-"}
            </Typography>
          </Box>
          <IconButton
            onClick={closeView}
            disabled={viewLoading}
            aria-label="Close record details"
          >
            <CloseOutlinedIcon />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: { xs: 2, sm: 3 }, backgroundColor: "#fcfbff" }}>
          {viewLoading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={20} />
              <Typography color="text.secondary">Loading details...</Typography>
            </Stack>
          ) : !viewingRow ? (
            <Typography color="text.secondary">
              No record details are available.
            </Typography>
          ) : (
            <Grid container spacing={1.5}>
              {columns
                .filter((column) => column.field && column.exportable !== false)
                .map((column, index) => (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    key={column.field || column.label || index}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.75,
                        height: "100%",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 2,
                        backgroundColor: "#fff",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: COLORS.muted,
                          fontWeight: 700,
                          mb: 0.5,
                        }}
                      >
                        {column.label || column.field}
                      </Typography>
                      <Typography sx={{ overflowWrap: "anywhere" }}>
                        {getDetailValue(viewingRow, column)}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${COLORS.border}` }}>
          <Button
            onClick={closeView}
            sx={{ color: COLORS.muted, textTransform: "none", fontWeight: 700 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {rowWorkflowAction && (
        <Dialog
          open={workflowConfirmOpen}
          onClose={closeWorkflowConfirmation}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: "14px" } }}
        >
          <DialogTitle
            sx={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              color: COLORS.text,
            }}
          >
            {rowWorkflowAction.confirmTitle || "Calculate payroll for this period?"}
          </DialogTitle>
          <DialogContent>
            <Typography color="text.secondary">
              {typeof rowWorkflowAction.confirmMessage === "function"
                ? rowWorkflowAction.confirmMessage(workflowRow)
                : rowWorkflowAction.confirmMessage ||
                  "This calculates course earnings and creates or refreshes consolidated instructor payrolls for the selected period."}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={closeWorkflowConfirmation}
              disabled={workflowBusy}
              sx={{
                color: COLORS.muted,
                textTransform: "none",
                fontWeight: 700,
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleWorkflowAction}
              disabled={workflowBusy || !workflowRow}
              startIcon={
                workflowBusy ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CalculateOutlinedIcon />
                )
              }
              sx={primaryButtonSx}
            >
              {workflowBusy ? "Calculating..." : "Calculate Payroll"}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ======================================================
          ADD / EDIT DIALOG
      ====================================================== */}

      <CrudFormDrawer
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: "14px",
            overflow: "hidden",
          },
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <DialogTitle
            sx={{
              px: 3,
              py: 2.5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flex: "0 0 auto",
              borderBottom: `1px solid ${COLORS.border}`,
              backgroundColor: "#fff",
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  fontSize: 19,
                  color: COLORS.text,
                }}
              >
                {editingRow ? `Edit ${title}` : `Add ${title}`}
              </Typography>

              <Typography
                variant="caption"
                sx={{ color: COLORS.muted }}
              >
                Enter the required information below.
              </Typography>
            </Box>

            <IconButton
              onClick={closeDialog}
              disabled={saving}
              aria-label="Close form"
            >
              <CloseOutlinedIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent
            sx={{
              p: { xs: 2, sm: 3 },
              backgroundColor: "#fcfbff",
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
              overscrollBehavior: "contain",
            }}
          >
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2.5}>
              {fields.map(renderField)}
            </Grid>
          </DialogContent>

          <DialogActions
            sx={{
              px: 3,
              py: 2,
              gap: 1,
              backgroundColor: "#fff",
              flex: "0 0 auto",
              position: "sticky",
              bottom: 0,
              zIndex: 2,
              borderTop: `1px solid ${COLORS.border}`,
              boxShadow: "0 -8px 20px rgba(23, 21, 43, 0.06)",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            }}
          >
            <Button
              onClick={closeDialog}
              disabled={saving}
              sx={{
                color: COLORS.muted,
                textTransform: "none",
                fontWeight: 700,
              }}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ ...primaryButtonSx, minWidth: 124 }}
            >
              {saving ? "Saving..." : editingRow ? (
                "Update"
              ) : (
                "Save"
              )}
            </Button>
          </DialogActions>
        </Box>
      </CrudFormDrawer>

      {/* ======================================================
          DELETE CONFIRMATION DIALOG
      ====================================================== */}

      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "14px",
            p: 1,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
          }}
        >
          <DeleteOutlineOutlinedIcon
            sx={{ color: COLORS.danger }}
          />
          Confirm Delete
        </DialogTitle>

        <DialogContent>
          <Typography color="text.secondary">
            Are you sure you want to delete this {title.toLowerCase()} record?
            This action cannot be undone from this screen.
          </Typography>

          {selectedDeleteRow && (
            <Typography
              sx={{
                mt: 1.5,
                fontSize: 13,
                color: COLORS.text,
                fontWeight: 700,
              }}
            >
              Record ID: {String(selectedDeleteRow.id ?? "-")}
            </Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={closeDeleteDialog}
            disabled={deleting}
            sx={{
              textTransform: "none",
              color: COLORS.muted,
              fontWeight: 700,
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="contained"
            startIcon={
              deleting ? (
                <CircularProgress size={17} color="inherit" />
              ) : (
                <DeleteOutlineOutlinedIcon />
              )
            }
            sx={{
              backgroundColor: `${COLORS.danger} !important`,
              color: "#fff !important",
              borderRadius: "9px",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": {
                backgroundColor: "#b92e2e !important",
              },
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
