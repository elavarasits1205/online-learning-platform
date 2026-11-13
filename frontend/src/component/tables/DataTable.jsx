
// src/component/tables/DataTable.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    Alert,
    Box,
    CircularProgress,
    Divider,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import { useRouteMenuPermissions } from "../../layouts/MenuAccessContext";

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ---------------------------------------------------------
// Design tokens
// ---------------------------------------------------------

const FONT_BODY = "var(--font-body, 'DM Sans', sans-serif)";
const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

const COLORS = {
    primary: "var(--color-primary, #6d4aff)",
    primaryDark: "var(--color-primary-dark, #5134d7)",
    primaryLight: "var(--color-primary-light, #eee9ff)",
    ink: "var(--color-ink, #17152b)",
    muted: "var(--color-muted, #6e7086)",
    border: "#e9e8f2",
    green: "#219e7b",
    red: "#d64545",
    blue: "#2878c8",
    orange: "#d98519",
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function getCellValue(row, column) {
    if (!row || !column) {
        return "";
    }

    try {
        if (typeof column.exportValue === "function") {
            return column.exportValue(row) ?? "";
        }

        if (typeof column.valueGetter === "function") {
            return column.valueGetter(row) ?? "";
        }

        const field = column.field ?? column.id;

        if (!field) {
            return "";
        }

        return row[field] ?? "";
    } catch (error) {
        console.error(
            `DataTable: failed to read column "${
                column.field || column.id || column.label || "unknown"
            }"`,
            error
        );

        return "";
    }
}

function toExportText(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (value instanceof Date) {
        return value.toLocaleString();
    }

    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}

function getFileName(title) {
    const safeName = String(title || "data")
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, "_");

    return safeName || "data";
}

function getSearchText(value) {
    return toExportText(value).toLocaleLowerCase();
}

function getColumnLabel(column) {
    return (
        column?.headerName ||
        column?.label ||
        column?.field ||
        column?.id ||
        ""
    );
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[character];
    });
}

function getRowLabel(row, columns) {
    const preferredColumn = columns.find((column) =>
        ["name", "title", "username", "code"].includes(
            column?.field ?? column?.id
        )
    );

    if (!preferredColumn) {
        return "record";
    }

    return toExportText(getCellValue(row, preferredColumn)) || "record";
}

// ---------------------------------------------------------
// DataTable
// ---------------------------------------------------------

export default function DataTable({
    title = "Data",
    rows = [],
    columns = [],
    loading = false,
    error = null,
    getRowId = (row) => row?.id,
    onAdd,
    onRefresh,
    onView,
    onEdit,
    onDelete,
    addIcon = <AddOutlinedIcon />,
    canViewRow,
    canEditRow,
    canDeleteRow,
    addLabel = "Add",
    deleteActionLabel = "Delete",
    searchPlaceholder = "Search...",
    emptyMessage = "No records found.",
    minWidth = 900,
    initialRowsPerPage = 10,
    rowsPerPageOptions = [5, 10, 25, 50, 100],
    pagination = true,
    exportRows,
}) {
    const location = useLocation();
    const menuAccess = useRouteMenuPermissions(location.pathname);
    const [searchText, setSearchText] = useState("");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
    const [actionAnchor, setActionAnchor] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const [localError, setLocalError] = useState("");
    const autoOpenedCreateRoute = useRef("");

    const permissionedHandler = (handler, permission) => {
        if (!handler || menuAccess.loading) return undefined;
        if (menuAccess.isAdmin) return handler;
        if (!menuAccess.matched) return undefined;
        return menuAccess[permission] ? handler : undefined;
    };

    const permittedOnAdd = permissionedHandler(onAdd, "canCreate");
    const permittedOnRefresh = permissionedHandler(onRefresh, "canView");
    const permittedOnView = permissionedHandler(onView, "canView");
    const permittedOnEdit = permissionedHandler(onEdit, "canUpdate");
    const permittedOnDelete = permissionedHandler(onDelete, "canDelete");

    useEffect(() => {
        const isCreateOnlyPage =
            !menuAccess.loading &&
            menuAccess.matched &&
            !menuAccess.isAdmin &&
            menuAccess.canCreate &&
            !menuAccess.canView &&
            Boolean(permittedOnAdd);

        if (!isCreateOnlyPage) {
            autoOpenedCreateRoute.current = "";
            return;
        }

        const routeKey = `${location.pathname}:${title}`;
        if (autoOpenedCreateRoute.current === routeKey) return;

        autoOpenedCreateRoute.current = routeKey;
        permittedOnAdd();
    }, [
        location.pathname,
        menuAccess.loading,
        menuAccess.matched,
        menuAccess.isAdmin,
        menuAccess.canCreate,
        menuAccess.canView,
        permittedOnAdd,
        title,
    ]);

    const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    const safeColumns = Array.isArray(columns)
        ? columns.filter(Boolean)
        : [];

    useEffect(() => {
        setPage(0);
    }, [searchText]);

    useEffect(() => {
        if (!selectedRow) return;

        const stillExists = safeRows.some(
            (row) =>
                String(getRowId(row) ?? "") ===
                String(getRowId(selectedRow) ?? "")
        );

        if (!stillExists) {
            setActionAnchor(null);
            setSelectedRow(null);
        }
    }, [rows, selectedRow, getRowId]);

    // -----------------------------------------------------
    // Search
    // -----------------------------------------------------

    const filteredRows = useMemo(() => {
        const query = searchText.trim().toLocaleLowerCase();

        if (!query) return safeRows;

        return safeRows.filter((row) =>
            safeColumns.some((column) => {
                if (column.searchable === false) return false;

                return getSearchText(getCellValue(row, column)).includes(
                    query
                );
            })
        );
    }, [safeRows, safeColumns, searchText]);

    useEffect(() => {
        if (!pagination) return;

        const lastPage = Math.max(
            0,
            Math.ceil(filteredRows.length / rowsPerPage) - 1
        );

        if (page > lastPage) {
            setPage(lastPage);
        }
    }, [filteredRows.length, page, pagination, rowsPerPage]);

    const displayedRows = useMemo(() => {
        if (!pagination) return filteredRows;

        const start = page * rowsPerPage;

        return filteredRows.slice(start, start + rowsPerPage);
    }, [filteredRows, page, rowsPerPage, pagination]);

    // -----------------------------------------------------
    // Row actions
    // -----------------------------------------------------

    const openActionMenu = (event, row) => {
        if (!row) return;

        setActionAnchor(event.currentTarget);
        setSelectedRow(row);
    };

    const closeActionMenu = () => {
        setActionAnchor(null);
    };

    const handleView = () => {
        const row = selectedRow;
        closeActionMenu();

        if (row && permittedOnView && (!canViewRow || canViewRow(row))) {
            permittedOnView(row);
        }
    };

    const handleEdit = () => {
        const row = selectedRow;
        closeActionMenu();

        if (row && permittedOnEdit && (!canEditRow || canEditRow(row))) {
            permittedOnEdit(row);
        }
    };

    const handleDelete = () => {
        const row = selectedRow;
        closeActionMenu();

        if (row && permittedOnDelete && (!canDeleteRow || canDeleteRow(row))) {
            permittedOnDelete(row);
        }
    };

    // -----------------------------------------------------
    // Export rows
    // -----------------------------------------------------

    const getExportData = useCallback(() => {
        const sourceRows = Array.isArray(exportRows)
            ? exportRows.filter(Boolean)
            : filteredRows;

        const exportColumns = safeColumns.filter(
            (column) =>
                column.exportable !== false &&
                (column.field ?? column.id) !== "actions" &&
                (column.field ?? column.id) !== "__actions"
        );

        return {
            exportColumns,
            data: sourceRows.map((row, index) => {
                const item = {
                    "S.No.": index + 1,
                };

                exportColumns.forEach((column) => {
                    item[getColumnLabel(column)] = toExportText(
                        getCellValue(row, column)
                    );
                });

                return item;
            }),
        };
    }, [safeColumns, exportRows, filteredRows]);

    const handleExcelExport = () => {
        try {
            setLocalError("");

            const { data } = getExportData();
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

            XLSX.writeFile(workbook, `${getFileName(title)}.xlsx`);
        } catch (exportError) {
            setLocalError(
                exportError?.message || "Unable to export the Excel file."
            );
        }
    };

    const handlePdfExport = () => {
        try {
            setLocalError("");

            const { exportColumns, data } = getExportData();

            const pdf = new jsPDF({
                orientation:
                    exportColumns.length > 6 ? "landscape" : "portrait",
                unit: "mm",
                format: "a4",
            });

            pdf.setFontSize(15);
            pdf.text(String(title), 14, 16);

            pdf.setFontSize(9);
            pdf.text(
                `Generated: ${new Date().toLocaleString()}`,
                14,
                22
            );

            const headers = [
                "S.No.",
                ...exportColumns.map(getColumnLabel),
            ];

            const body = data.map((item) =>
                headers.map((header) => item[header] ?? "")
            );

            autoTable(pdf, {
                head: [headers],
                body,
                startY: 27,
                theme: "grid",
                styles: {
                    fontSize: 8,
                    cellPadding: 2.5,
                    overflow: "linebreak",
                },
                headStyles: {
                    fillColor: [109, 74, 255],
                    textColor: 255,
                    fontStyle: "bold",
                },
                alternateRowStyles: {
                    fillColor: [248, 247, 255],
                },
                margin: {
                    left: 10,
                    right: 10,
                },
            });

            pdf.save(`${getFileName(title)}.pdf`);
        } catch (exportError) {
            setLocalError(
                exportError?.message || "Unable to export the PDF file."
            );
        }
    };

    const handlePrint = () => {
        try {
            setLocalError("");

            const { exportColumns, data } = getExportData();

            const headers = [
                "S.No.",
                ...exportColumns.map(getColumnLabel),
            ];

            const tableHead = headers
                .map((header) => `<th>${escapeHtml(header)}</th>`)
                .join("");

            const tableRows = data
                .map(
                    (item) =>
                        `<tr>${headers
                            .map(
                                (header) =>
                                    `<td>${escapeHtml(item[header] ?? "")}</td>`
                            )
                            .join("")}</tr>`
                )
                .join("");

            const printWindow = window.open(
                "",
                "_blank",
                "width=1000,height=700"
            );

            if (!printWindow) {
                setLocalError(
                    "The print window was blocked. Allow pop-ups and try again."
                );
                return;
            }

            printWindow.document.write(`
                <!doctype html>
                <html>
                    <head>
                        <meta charset="utf-8" />
                        <title>${escapeHtml(title)}</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                padding: 24px;
                                color: #17152b;
                            }
                            h2 { margin: 0 0 8px; }
                            p {
                                margin: 0 0 20px;
                                color: #6e7086;
                                font-size: 12px;
                            }
                            table {
                                border-collapse: collapse;
                                width: 100%;
                                font-size: 11px;
                            }
                            th, td {
                                border: 1px solid #ddd;
                                padding: 8px;
                                text-align: left;
                                overflow-wrap: anywhere;
                            }
                            th { background: #eee9ff; }
                            tr:nth-child(even) { background: #faf9ff; }
                            @media print { body { padding: 0; } }
                        </style>
                    </head>
                    <body>
                        <h2>${escapeHtml(title)}</h2>
                        <p>Generated: ${escapeHtml(
                            new Date().toLocaleString()
                        )}</p>
                        <table>
                            <thead><tr>${tableHead}</tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </body>
                </html>
            `);

            printWindow.document.close();
            printWindow.focus();

            // Delay printing until the new document is ready.
            printWindow.onload = () => {
                printWindow.print();
                printWindow.close();
            };
        } catch (printError) {
            setLocalError(
                printError?.message || "Unable to print this table."
            );
        }
    };

    // -----------------------------------------------------
    // Pagination
    // -----------------------------------------------------

    const handleChangePage = (_event, nextPage) => {
        setPage(nextPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(Number(event.target.value));
        setPage(0);
    };

    // -----------------------------------------------------
    // Toolbar icon
    // -----------------------------------------------------

    const toolbarIcon = ({
        label,
        icon,
        color,
        onClick,
        disabled = false,
    }) => (
        <Tooltip title={label} arrow key={label}>
            <span>
                <IconButton
                    aria-label={label}
                    onClick={onClick}
                    disabled={disabled}
                    size="small"
                    sx={{
                        width: 36,
                        height: 36,
                        color,
                        borderRadius: 2,
                        transition: "background-color 160ms ease",
                        "&:hover": {
                            backgroundColor: `${color}15`,
                        },
                        "&.Mui-disabled": {
                            color: "#b8b5c6",
                        },
                    }}
                >
                    {icon}
                </IconButton>
            </span>
        </Tooltip>
    );

    const hasActions = Boolean(
        permittedOnView || permittedOnEdit || permittedOnDelete
    );

    const columnCount =
        safeColumns.length + 1 + (hasActions ? 1 : 0);

    // -----------------------------------------------------
    // Render
    // -----------------------------------------------------

    return (
        <Box
            sx={{
                width: "100%",
                minWidth: 0,
                color: COLORS.ink,
                fontFamily: FONT_BODY,
            }}
        >
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{
                    mb: 2,
                    alignItems: { xs: "stretch", sm: "center" },
                    justifyContent: "space-between",
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        variant="h6"
                        sx={{
                            fontFamily: FONT_HEADING,
                            fontWeight: 750,
                            color: COLORS.ink,
                        }}
                    >
                        {title}
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{ mt: 0.4, color: COLORS.muted }}
                    >
                        {filteredRows.length}{" "}
                        {filteredRows.length === 1 ? "record" : "records"}
                    </Typography>
                </Box>

                <Stack
                    direction="row"
                    sx={{
                        alignItems: "center",
                        justifyContent: {
                            xs: "flex-end",
                            sm: "flex-end",
                        },
                        flexWrap: "wrap",
                        gap: 0.75,
                    }}
                >
                    {permittedOnAdd &&
                        toolbarIcon({
                            label: addLabel,
                            icon: addIcon,
                            color: COLORS.primary,
                            onClick: permittedOnAdd,
                        })}

                    {toolbarIcon({
                        label: "Refresh",
                        icon: <RefreshOutlinedIcon />,
                        color: COLORS.blue,
                        onClick: permittedOnRefresh,
                        disabled: !permittedOnRefresh || loading,
                    })}

                    {toolbarIcon({
                        label: "Export PDF",
                        icon: <PictureAsPdfOutlinedIcon />,
                        color: COLORS.red,
                        onClick: handlePdfExport,
                        disabled: loading || filteredRows.length === 0,
                    })}

                    {toolbarIcon({
                        label: "Export Excel",
                        icon: <FileDownloadOutlinedIcon />,
                        color: COLORS.green,
                        onClick: handleExcelExport,
                        disabled: loading || filteredRows.length === 0,
                    })}

                    {toolbarIcon({
                        label: "Print",
                        icon: <PrintOutlinedIcon />,
                        color: COLORS.orange,
                        onClick: handlePrint,
                        disabled: loading || filteredRows.length === 0,
                    })}
                </Stack>
            </Stack>

            {/* Search */}

            <Box sx={{ mb: 2 }}>
                <TextField
                    fullWidth
                    size="small"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder={searchPlaceholder}
                    slotProps={{
                        htmlInput: {
                            "aria-label": searchPlaceholder,
                        },
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchOutlinedIcon
                                        sx={{
                                            fontSize: 20,
                                            color: COLORS.muted,
                                        }}
                                    />
                                </InputAdornment>
                            ),
                            endAdornment: searchText ? (
                                <InputAdornment position="end">
                                    <Tooltip title="Clear search" arrow>
                                        <IconButton
                                            size="small"
                                            aria-label="Clear search"
                                            onClick={() => setSearchText("")}
                                        >
                                            <CloseOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            ) : null,
                        },
                    }}
                    sx={{
                        maxWidth: { xs: "100%", sm: 380 },
                        "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            backgroundColor: "transparent",
                            fontFamily: FONT_BODY,
                            "& fieldset": {
                                borderColor: COLORS.border,
                            },
                            "&:hover fieldset": {
                                borderColor: "#c8c3e3",
                            },
                            "&.Mui-focused fieldset": {
                                borderColor: COLORS.primary,
                            },
                        },
                    }}
                />
            </Box>

            {/* Errors */}

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {typeof error === "string"
                        ? error
                        : error.message || "Unable to load records."}
                </Alert>
            )}

            {localError && (
                <Alert
                    severity="error"
                    onClose={() => setLocalError("")}
                    sx={{ mb: 2 }}
                >
                    {localError}
                </Alert>
            )}

            {/* Table */}

            <TableContainer
                sx={{
                    width: "100%",
                    maxWidth: "100%",
                    overflowX: "auto",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 2,
                    backgroundColor: "transparent",
                }}
            >
                <Table
                    size="small"
                    stickyHeader
                    aria-label={`${title} table`}
                    sx={{
                        minWidth,
                        tableLayout: "auto",
                        "& .MuiTableCell-root": {
                            fontFamily: FONT_BODY,
                            borderBottom: `1px solid ${COLORS.border}`,
                            px: 2,
                            py: 1.5,
                        },
                        "& .MuiTableCell-head": {
                            backgroundColor: "#f8f7fc",
                            color: COLORS.muted,
                            fontSize: 12,
                            fontWeight: 750,
                            whiteSpace: "nowrap",
                            textTransform: "uppercase",
                            letterSpacing: "0.035em",
                        },
                        "& .MuiTableCell-body": {
                            color: COLORS.ink,
                            fontSize: 13,
                        },
                        "& .MuiTableBody-root .MuiTableRow-root:last-child .MuiTableCell-root":
                            {
                                borderBottom: 0,
                            },
                        "& .MuiTableBody-root .MuiTableRow-root:hover": {
                            backgroundColor: "#faf9ff",
                        },
                    }}
                >
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 70, minWidth: 70 }}>
                                S.No.
                            </TableCell>

                            {safeColumns.map((column, index) => (
                                <TableCell
                                    key={column.field || column.label || index}
                                    align={column.align || "left"}
                                    sx={{
                                        minWidth: column.minWidth,
                                        width: column.width,
                                        whiteSpace:
                                            column.nowrap === false
                                                ? "normal"
                                                : "nowrap",
                                    }}
                                >
                                    {getColumnLabel(column)}
                                </TableCell>
                            ))}

                            {hasActions && (
                                <TableCell
                                    align="center"
                                    sx={{ width: 90, minWidth: 90 }}
                                >
                                    Actions
                                </TableCell>
                            )}
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columnCount}
                                    align="center"
                                    sx={{ py: 6 }}
                                >
                                    <Stack
                                        direction="row"
                                        spacing={1.5}
                                        sx={{
                                            justifyContent: "center",
                                            alignItems: "center",
                                        }}
                                    >
                                        <CircularProgress size={22} />
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            Loading records...
                                        </Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ) : displayedRows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columnCount}
                                    align="center"
                                    sx={{ py: 7 }}
                                >
                                    <Stack
                                        spacing={1}
                                        sx={{ alignItems: "center" }}
                                    >
                                        <TableRowsOutlinedIcon
                                            sx={{
                                                fontSize: 32,
                                                color: "#b5b1c6",
                                            }}
                                        />

                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 600,
                                                color: COLORS.muted,
                                            }}
                                        >
                                            {searchText
                                                ? "No matching records found."
                                                : emptyMessage}
                                        </Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayedRows.map((row, rowIndex) => (
                                <TableRow
                                    hover
                                    key={String(
                                        getRowId(row) ?? rowIndex
                                    )}
                                >
                                    <TableCell
                                        sx={{
                                            color: `${COLORS.muted} !important`,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {pagination
                                            ? page * rowsPerPage +
                                              rowIndex +
                                              1
                                            : rowIndex + 1}
                                    </TableCell>

                                    {safeColumns.map((column, columnIndex) => (
                                        <TableCell
                                            key={
                                                column.field ||
                                                column.label ||
                                                columnIndex
                                            }
                                            align={column.align || "left"}
                                            sx={{
                                                minWidth: column.minWidth,
                                                maxWidth: column.maxWidth,
                                                whiteSpace:
                                                    column.nowrap === false
                                                        ? "normal"
                                                        : "nowrap",
                                                overflowWrap: "anywhere",
                                            }}
                                        >
                                            {typeof column.render === "function"
                                                ? column.render(
                                                      getCellValue(row, column),
                                                      row,
                                                      page * rowsPerPage + rowIndex
                                                  )
                                                : typeof column.renderCell === "function"
                                                  ? column.renderCell(row)
                                                  : toExportText(
                                                        getCellValue(row, column)
                                                    ) || "-"}
                                        </TableCell>
                                    ))}

                                    {hasActions && (
                                        <TableCell align="center">
                                            {((permittedOnView && (!canViewRow || canViewRow(row))) ||
                                                (permittedOnEdit && (!canEditRow || canEditRow(row))) ||
                                                (permittedOnDelete && (!canDeleteRow || canDeleteRow(row)))) && (
                                                <Tooltip title="Row actions" arrow>
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Actions for ${getRowLabel(
                                                            row,
                                                            safeColumns
                                                        )}`}
                                                        onClick={(event) =>
                                                            openActionMenu(event, row)
                                                        }
                                                        sx={{
                                                            color: COLORS.muted,
                                                            "&:hover": {
                                                                color: COLORS.primary,
                                                                backgroundColor: COLORS.primaryLight,
                                                            },
                                                        }}
                                                    >
                                                        <MoreVertIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Pagination */}

            {pagination && (
                <TablePagination
                    component="div"
                    count={filteredRows.length}
                    page={Math.min(
                        page,
                        Math.max(
                            0,
                            Math.ceil(filteredRows.length / rowsPerPage) - 1
                        )
                    )}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={rowsPerPageOptions}
                    labelRowsPerPage="Rows:"
                    sx={{
                        mt: 0.5,
                        borderBottom: 0,
                        color: COLORS.muted,
                        "& .MuiTablePagination-toolbar": {
                            minHeight: 52,
                            px: { xs: 0, sm: 1 },
                            flexWrap: "wrap",
                        },
                        "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                            {
                                fontFamily: FONT_BODY,
                                fontSize: 12,
                            },
                        "& .MuiTablePagination-select": {
                            fontFamily: FONT_BODY,
                        },
                    }}
                />
            )}

            {/* Row actions */}

            <Menu
                anchorEl={actionAnchor}
                open={Boolean(actionAnchor)}
                onClose={closeActionMenu}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                slotProps={{
                    paper: {
                        elevation: 4,
                        sx: {
                            minWidth: 160,
                            borderRadius: 2,
                            border: `1px solid ${COLORS.border}`,
                            py: 0.5,
                        },
                    },
                }}
            >
                {permittedOnView && (!canViewRow || canViewRow(selectedRow)) && (
                    <MenuItem
                        onClick={handleView}
                        sx={{
                            gap: 1.25,
                            fontFamily: FONT_BODY,
                            fontSize: 13,
                        }}
                    >
                        <VisibilityOutlinedIcon
                            fontSize="small"
                            sx={{ color: COLORS.blue }}
                        />
                        View
                    </MenuItem>
                )}

                {permittedOnEdit && (!canEditRow || canEditRow(selectedRow)) && (
                    <MenuItem
                        onClick={handleEdit}
                        sx={{
                            gap: 1.25,
                            fontFamily: FONT_BODY,
                            fontSize: 13,
                        }}
                    >
                        <EditOutlinedIcon
                            fontSize="small"
                            sx={{ color: COLORS.primary }}
                        />
                        Edit
                    </MenuItem>
                )}

                {permittedOnDelete && (!canDeleteRow || canDeleteRow(selectedRow)) && (
                    <>
                        {((permittedOnView && (!canViewRow || canViewRow(selectedRow))) ||
                            (permittedOnEdit && (!canEditRow || canEditRow(selectedRow)))) && (
                            <Divider sx={{ my: 0.5 }} />
                        )}

                        <MenuItem
                            onClick={handleDelete}
                            sx={{
                                gap: 1.25,
                                color: COLORS.red,
                                fontFamily: FONT_BODY,
                                fontSize: 13,
                            }}
                        >
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                            {deleteActionLabel}
                        </MenuItem>
                    </>
                )}
            </Menu>
        </Box>
    );
}
