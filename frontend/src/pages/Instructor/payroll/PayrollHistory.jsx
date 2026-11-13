import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Typography,
} from "@mui/material";

import DataTable from "../../../component/tables/DataTable";
import { instructorPayrollSelfApi } from "../../../service/payroll.api";

const money = (value, code = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code || "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN") : "-";

export default function PayrollHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result =
        await instructorPayrollSelfApi.getPayrollHistory({
          page: 1,
          limit: 100,
        });

      setRows(result.rows || []);
    } catch (err) {
      setRows([]);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load payroll history."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    { field: "payroll_number", label: "Payroll Number" },
    { field: "period_code", label: "Period Code" },
    {
      field: "period_start",
      label: "Start Date",
      render: (value) => formatDate(value),
    },
    {
      field: "period_end",
      label: "End Date",
      render: (value) => formatDate(value),
    },
    {
      field: "approved_at",
      label: "Approved On",
      render: (value) => formatDate(value),
    },
    {
      field: "total_earnings",
      label: "Course Earnings",
      render: (value, row) => money(value, row.currency_code),
    },
    {
      field: "incentive_amount",
      label: "Referral Enrollment Incentives",
      render: (value, row) => money(value, row.currency_code),
    },
    { field: "incentive_notes", label: "Referral Incentive Calculation" },
    {
      field: "total_deductions",
      label: "Total Deductions",
      render: (value, row) => money(value, row.currency_code),
    },
    {
      field: "net_amount",
      label: "Net Amount",
      render: (value, row) => money(value, row.currency_code),
    },
    { field: "status", label: "Status" },
    {
      field: "paid_at",
      label: "Paid On",
      render: (value) => formatDate(value),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
      <Typography variant="h5" fontWeight={800}>
        Payroll History
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        View your previous payroll records and payroll periods.
      </Typography>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      <DataTable
        title="Payroll History"
        rows={rows}
        columns={columns}
        loading={loading}
        error={null}
        getRowId={(row) => String(row.id)}
        onRefresh={loadData}
        searchPlaceholder="Search payroll history..."
        emptyMessage="No payroll history found."
        minWidth={1200}
        initialRowsPerPage={10}
      />
    </Box>
  );
}
