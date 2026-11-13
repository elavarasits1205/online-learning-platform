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

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("en-IN") : "-";

export default function LogPayData() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result =
        await instructorPayrollSelfApi.getPaymentHistory({
          page: 1,
          limit: 100,
        });

      setRows(result.rows || []);
    } catch (err) {
      setRows([]);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load payment history."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    { field: "payment_number", label: "Payment Number" },
    { field: "payroll_number", label: "Payroll Number" },
    { field: "period_code", label: "Period Code" },
    { field: "payment_method", label: "Payment Method" },
    {
      field: "amount",
      label: "Amount",
      render: (value, row) => money(value, row.currency_code),
    },
    { field: "currency_code", label: "Currency" },
    { field: "status", label: "Payment Status" },
    { field: "payment_gateway", label: "Transfer Provider" },
    { field: "bank_reference", label: "Bank Reference" },
    {
      field: "initiated_at",
      label: "Initiated",
      render: (value) => formatDateTime(value),
    },
    {
      field: "processed_at",
      label: "Processed",
      render: (value) => formatDateTime(value),
    },
    {
      field: "failed_at",
      label: "Failed",
      render: (value) => formatDateTime(value),
    },
    { field: "failure_reason", label: "Failure Reason" },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: "100%" }}>
      <Typography variant="h5" fontWeight={800}>
        Payment History
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        Review payments made against your payroll records.
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
        title="Payment History"
        rows={rows}
        columns={columns}
        loading={loading}
        error={null}
        getRowId={(row) => String(row.id)}
        onRefresh={loadData}
        searchPlaceholder="Search payment history..."
        emptyMessage="No payment history found."
        minWidth={1000}
        initialRowsPerPage={10}
      />
    </Box>
  );
}
