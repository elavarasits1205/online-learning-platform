import { useSearchParams } from "react-router-dom";

import { Box, Paper, Skeleton, Typography } from "@mui/material";

import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import RedeemOutlinedIcon from "@mui/icons-material/RedeemOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";

import CouponChildCrudPage from "./CouponChildCrudPage";

import {
    getCouponRedemptions,
    getCouponRedemptionById,
    getCouponRedemptionDropdowns,
} from "../../../service/couponRedemptionApi";

import {
    formatAmount,
    formatDate,
    getCouponLabel,
    getStatusColor,
    getStudentLabel,
    normalizeId,
} from "./couponPageUtils";

const API = {
    getAll: getCouponRedemptions,
    getById: getCouponRedemptionById,
};

const FILTERS = [
    {
        name: "coupon_id",
        label: "Coupon",
        options: "coupons",
        allLabel: "All coupons",
        optionLabel: getCouponLabel,
        optionValue: (coupon) => normalizeId(coupon.id),
    },
    {
        name: "student_id",
        label: "Student",
        options: "students",
        allLabel: "All students",
        optionLabel: getStudentLabel,
        optionValue: (student) => normalizeId(student.id),
    },
    {
        name: "status",
        label: "Status",
        allLabel: "All statuses",
        staticOptions: [
            { value: "RESERVED", label: "Reserved" },
            { value: "REDEEMED", label: "Redeemed" },
            { value: "CANCELLED", label: "Cancelled" },
        ],
    },
    {
        name: "is_active",
        label: "Active",
        allLabel: "All",
        staticOptions: [
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
        ],
    },
];

const COLUMNS = [
    { field: "coupon_code", headerName: "Coupon Code", minWidth: 150 },
    { field: "payment_number", headerName: "Payment No.", minWidth: 165 },
    { field: "enrollment_number", headerName: "Enrollment No.", minWidth: 175 },
    { field: "student_name", headerName: "Student", minWidth: 190 },
    { field: "student_code", headerName: "Student Code", minWidth: 150 },
    { field: "register_number", headerName: "Register No.", minWidth: 170 },
    {
        field: "register_number_snapshot",
        headerName: "Register Snapshot",
        minWidth: 180,
    },
    { field: "institution_name", headerName: "Institution", minWidth: 190 },
    { field: "course_code", headerName: "Course Code", minWidth: 140 },
    { field: "course_title", headerName: "Course", minWidth: 200 },
    {
        field: "original_amount",
        headerName: "Original",
        minWidth: 110,
        valueGetter: (row) => formatAmount(row.original_amount),
        exportValue: (row) => formatAmount(row.original_amount),
    },
    {
        field: "discount_amount",
        headerName: "Discount",
        minWidth: 110,
        valueGetter: (row) => formatAmount(row.discount_amount),
        exportValue: (row) => formatAmount(row.discount_amount),
    },
    {
        field: "final_amount",
        headerName: "Final",
        minWidth: 110,
        valueGetter: (row) => formatAmount(row.final_amount),
        exportValue: (row) => formatAmount(row.final_amount),
    },
    {
        field: "status",
        headerName: "Status",
        minWidth: 120,
        align: "center",
        valueGetter: (row) => row.status ?? "",
        exportValue: (row) => row.status ?? "",
        renderCell: (row) => {
            const status = String(row.status ?? "").toUpperCase();
            const colors = getStatusColor(status);

            return (
                <span
                    style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        ...colors,
                    }}
                >
                    {status || "-"}
                </span>
            );
        },
    },
    {
        field: "is_active",
        headerName: "Active",
        minWidth: 100,
        align: "center",
        valueGetter: (row) => (row.is_active ? "Yes" : "No"),
        exportValue: (row) => (row.is_active ? "Yes" : "No"),
    },
    {
        field: "applied_at",
        headerName: "Applied At",
        minWidth: 175,
        exportValue: (row) => formatDate(row.applied_at),
    },
    {
        field: "redeemed_at",
        headerName: "Redeemed At",
        minWidth: 175,
        exportValue: (row) => formatDate(row.redeemed_at),
    },
    {
        field: "cancelled_at",
        headerName: "Cancelled At",
        minWidth: 175,
        exportValue: (row) => formatDate(row.cancelled_at),
    },
    {
        field: "cancellation_reason",
        headerName: "Cancellation Reason",
        minWidth: 200,
        nowrap: false,
    },
    {
        field: "created_at",
        headerName: "Created At",
        minWidth: 175,
        exportValue: (row) => formatDate(row.created_at),
    },
    {
        field: "updated_at",
        headerName: "Updated At",
        minWidth: 175,
        exportValue: (row) => formatDate(row.updated_at),
    },
];

function RedemptionSummary({ rows, loading }) {
    const list = Array.isArray(rows) ? rows : [];

    const redeemed = list.filter(
        (row) => String(row.status).toUpperCase() === "REDEEMED"
    );
    const cancelled = list.filter(
        (row) => String(row.status).toUpperCase() === "CANCELLED"
    );

    const totalDiscount = redeemed.reduce(
        (sum, row) => sum + (Number(row.discount_amount) || 0),
        0
    );

    const cards = [
        {
            label: "Redemption events",
            value: list.length,
            caption: "Visible on this page",
            icon: <RedeemOutlinedIcon fontSize="small" />,
            color: "#3659e3",
            bg: "#eef2ff",
        },
        {
            label: "Redeemed",
            value: redeemed.length,
            caption: "Active redemptions",
            icon: <CheckCircleOutlineRoundedIcon fontSize="small" />,
            color: "#168653",
            bg: "#e9f8f0",
        },
        {
            label: "Cancelled",
            value: cancelled.length,
            caption: "Replaced or reversed",
            icon: <CancelOutlinedIcon fontSize="small" />,
            color: "#d32f2f",
            bg: "#fdeaea",
        },
        {
            label: "Discount given",
            value: formatAmount(totalDiscount),
            caption: "On redeemed events",
            icon: <SavingsOutlinedIcon fontSize="small" />,
            color: "#6d4aff",
            bg: "#eee9ff",
        },
    ];

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(4, minmax(0, 1fr))",
                },
                gap: 2,
                mb: 3,
            }}
        >
            {cards.map((card) => (
                <Paper
                    key={card.label}
                    elevation={0}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 2,
                        border: "1px solid #e9e8f2",
                        borderRadius: 3,
                    }}
                >
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: 2,
                            color: card.color,
                            bgcolor: card.bg,
                            flexShrink: 0,
                        }}
                    >
                        {card.icon}
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                        >
                            {card.label}
                        </Typography>

                        {loading ? (
                            <Skeleton width={70} height={32} />
                        ) : (
                            <Typography
                                sx={{
                                    fontFamily:
                                        "var(--font-heading, 'Manrope', sans-serif)",
                                    fontWeight: 800,
                                    fontSize: 22,
                                    lineHeight: 1.2,
                                }}
                            >
                                {card.value}
                            </Typography>
                        )}

                        <Typography variant="caption" color="text.secondary">
                            {card.caption}
                        </Typography>
                    </Box>
                </Paper>
            ))}
        </Box>
    );
}

function getRowLabel(row) {
    return (
        row?.payment_number ||
        row?.coupon_code ||
        `redemption ${row?.id ?? ""}`
    );
}

export default function CouponRedemptionPage() {
    const [searchParams] = useSearchParams();
    const couponId = searchParams.get("coupon_id") || "";

    return (
        <CouponChildCrudPage
            key={couponId || "all-coupons"}
            title="Coupon Redemptions"
            subtitle="Read-only history of coupon usage against student payments."
            icon={<RedeemOutlinedIcon />}
            tableTitle="Coupon Redemptions"
            searchPlaceholder="Search coupon, payment, student or course..."
            emptyMessage="No coupon claims or redemptions found."
            minWidth={2300}
            columns={COLUMNS}
            api={API}
            loadDropdowns={getCouponRedemptionDropdowns}
            getRowLabel={getRowLabel}
            filters={FILTERS}
            couponId={couponId}
            refreshOnFocus
            refreshIntervalMs={30000}
            summary={(rows, loading) => (
                <RedemptionSummary rows={rows} loading={loading} />
            )}
            viewOnly
        />
    );
}
