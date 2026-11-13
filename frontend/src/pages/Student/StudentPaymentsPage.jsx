import AdminPaymentTables from "../admin/payments/AdminPaymentTables";
import { studentPaymentApi } from "../../service/studentPaymentApi";

const money = (value, currency = "INR") => {
    if (value === null || value === undefined || value === "") return "-";

    const amount = Number(value);

    if (!Number.isFinite(amount)) return String(value);

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currency || "INR",
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency || "INR"} ${amount.toFixed(2)}`;
    }
};

const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const MONEY_FIELDS = new Set([
    "original_amount",
    "discount_amount",
    "tax_amount",
    "final_amount",
    "paid_amount",
]);

const DATE_FIELDS = new Set([
    "payment_due_at",
    "paid_at",
    "failed_at",
    "cancelled_at",
    "created_at",
    "updated_at",
]);

const STUDENT_PAYMENT_STATUSES = [
    "PENDING",
    "PROCESSING",
    "PAID",
    "FAILED",
    "CANCELLED",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
];

const STUDENT_PAYMENT_FIELDS = [
    ["payment_number", "Payment No.", 175],
    ["course_title", "Course", 240],
    ["currency_code", "Currency", 100],
    ["original_amount", "Original", 130],
    ["discount_amount", "Discount", 130],
    ["tax_amount", "Tax", 120],
    ["final_amount", "Final", 130],
    ["paid_amount", "Paid", 130],
    ["status", "Status", 130],
    ["payment_method", "Method", 140],
    ["payment_gateway", "Gateway", 140],
    ["paid_at", "Paid At", 180],
    ["created_at", "Created At", 180],
];

const STUDENT_PAYMENT_COLUMNS = STUDENT_PAYMENT_FIELDS.map(
    ([field, headerName, minWidth]) => ({
        field,
        headerName,
        minWidth,
        ...(MONEY_FIELDS.has(field)
            ? {
                  valueGetter: (row) => money(row[field], row.currency_code),
                  exportValue: (row) => money(row[field], row.currency_code),
              }
            : {}),
        ...(DATE_FIELDS.has(field)
            ? {
                  exportValue: (row) => formatDate(row[field]),
              }
            : {}),
    })
);

export default function StudentPaymentsPage() {
    return (
        <AdminPaymentTables
            resource="payments"
            api={studentPaymentApi.payments}
            title="My Payments"
            subtitle="Your course payments and completed checkout receipts."
            columns={STUDENT_PAYMENT_COLUMNS}
            searchPlaceholder="Search payment or course..."
            minWidth={1900}
            statuses={STUDENT_PAYMENT_STATUSES}
        />
    );
}
