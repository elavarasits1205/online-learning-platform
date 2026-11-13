import { useSearchParams } from "react-router-dom";

import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";

import CouponChildCrudPage from "./CouponChildCrudPage";

import {
    getCouponStudents,
    getCouponStudentById,
    createCouponStudent,
    updateCouponStudent,
    deleteCouponStudent,
    getCouponStudentDropdowns,
} from "../../../service/couponStudentApi";

import {
    formatDate,
    getCouponLabel,
    getStudentLabel,
    normalizeId,
} from "./couponPageUtils";

const API = {
    getAll: getCouponStudents,
    getById: getCouponStudentById,
    create: createCouponStudent,
    update: updateCouponStudent,
    remove: deleteCouponStudent,
};

const INITIAL_FORM = {
    coupon_id: "",
    student_id: "",
    is_active: true,
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
];

const FORM_FIELDS = [
    {
        name: "coupon_id",
        label: "Coupon",
        type: "select",
        required: true,
        options: "coupons",
        optionLabel: getCouponLabel,
        optionValue: (coupon) => normalizeId(coupon.id),
        helperText: "Select the coupon that will be restricted.",
    },
    {
        name: "student_id",
        label: "Student",
        type: "select",
        required: true,
        options: "students",
        optionLabel: getStudentLabel,
        optionValue: (student) => normalizeId(student.id),
        helperText:
            "Select a student who belongs to the coupon's institution.",
    },
    {
        name: "is_active",
        label: "Active",
        type: "switch",
        defaultValue: true,
        helperText: "Inactive mappings cannot be used at checkout.",
    },
];

const COLUMNS = [
    {
        field: "coupon_code",
        headerName: "Coupon Code",
        minWidth: 160,
    },
    {
        field: "student_name",
        headerName: "Student Name",
        minWidth: 200,
    },
    {
        field: "register_number_snapshot",
        headerName: "Register No. (Snapshot)",
        minWidth: 200,
    },
    {
        field: "register_number",
        headerName: "Current Register No.",
        minWidth: 190,
    },
    {
        field: "student_code",
        headerName: "Student Code",
        minWidth: 150,
    },
    {
        field: "institution_name",
        headerName: "Institution",
        minWidth: 200,
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

function rowToForm(row) {
    return {
        coupon_id: normalizeId(row.coupon_id),
        student_id: normalizeId(row.student_id),
        is_active: row.is_active !== false,
    };
}

function formToPayload(form) {
    return {
        coupon_id: String(form.coupon_id),
        student_id: String(form.student_id),
        is_active: Boolean(form.is_active),
    };
}

function validateForm(form) {
    if (!form.coupon_id) return "Please select a coupon.";
    if (!form.student_id) return "Please select a student.";

    return "";
}

function getRowLabel(row) {
    return (
        row?.student_name ||
        row?.register_number_snapshot ||
        `mapping ${row?.id ?? ""}`
    );
}

export default function CouponStudentPage() {
    const [searchParams] = useSearchParams();
    const couponId = searchParams.get("coupon_id") || "";

    return (
        <CouponChildCrudPage
            title="Coupon Students"
            subtitle="Restrict coupons to specific students."
            icon={<PeopleAltOutlinedIcon />}
            tableTitle="Coupon Students"
            addLabel="Add Coupon Student"
            searchPlaceholder="Search coupon, student or register number..."
            emptyMessage="No coupon-student mappings found."
            minWidth={1350}
            columns={COLUMNS}
            formFields={FORM_FIELDS}
            initialForm={INITIAL_FORM}
            api={API}
            loadDropdowns={getCouponStudentDropdowns}
            rowToForm={rowToForm}
            formToPayload={formToPayload}
            validateForm={validateForm}
            getRowLabel={getRowLabel}
            filters={FILTERS}
            couponId={couponId}
        />
    );
}
