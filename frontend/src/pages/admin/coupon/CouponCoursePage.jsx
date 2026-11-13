import { useSearchParams } from "react-router-dom";

import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";

import CouponChildCrudPage from "./CouponChildCrudPage";

import {
    getCouponCourses,
    getCouponCourseById,
    createCouponCourse,
    updateCouponCourse,
    deleteCouponCourse,
    getCouponCourseDropdowns,
} from "../../../service/couponCourseApi";

import {
    formatDate,
    getCouponLabel,
    getCourseLabel,
    normalizeBoolean,
    normalizeId,
} from "./couponPageUtils";

const API = {
    getAll: getCouponCourses,
    getById: getCouponCourseById,
    create: createCouponCourse,
    update: updateCouponCourse,
    remove: deleteCouponCourse,
};

const INITIAL_FORM = {
    coupon_id: "",
    course_id: "",
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
        name: "course_id",
        label: "Course",
        options: "courses",
        allLabel: "All courses",
        optionLabel: getCourseLabel,
        optionValue: (course) => normalizeId(course.id),
    },
    {
        name: "is_active",
        label: "Status",
        defaultValue: "true",
        allLabel: "All statuses",
        staticOptions: [
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
        ],
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
        name: "course_id",
        label: "Course",
        type: "select",
        required: true,
        options: "courses",
        optionLabel: getCourseLabel,
        optionValue: (course) => normalizeId(course.id),
        helperText: "Select the course this coupon can be applied to.",
    },
    {
        name: "is_active",
        label: "Mapping active",
        type: "switch",
        helperText: "Enable or disable this coupon-course mapping.",
    },
];

const COLUMNS = [
    {
        field: "coupon_code",
        headerName: "Coupon Code",
        minWidth: 160,
    },
    {
        field: "course_code",
        headerName: "Course Code",
        minWidth: 150,
    },
    {
        field: "course_title",
        headerName: "Course Title",
        minWidth: 220,
    },
    {
        field: "is_active",
        headerName: "Status",
        minWidth: 110,
        align: "center",
        searchable: false,
        valueGetter: (row) =>
            normalizeBoolean(row.is_active) ? "Active" : "Inactive",
        exportValue: (row) =>
            normalizeBoolean(row.is_active) ? "Active" : "Inactive",
        renderCell: (row) => {
            const active = normalizeBoolean(row.is_active);

            return (
                <span
                    style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: active ? "#168653" : "#d32f2f",
                        background: active ? "#e6f6ee" : "#fdeaea",
                    }}
                >
                    {active ? "Active" : "Inactive"}
                </span>
            );
        },
    },
    {
        field: "created_at",
        headerName: "Created At",
        minWidth: 175,
        exportValue: (row) => formatDate(row.created_at),
    },
];

function rowToForm(row) {
    return {
        coupon_id: normalizeId(row.coupon_id),
        course_id: normalizeId(row.course_id),
        is_active: normalizeBoolean(row.is_active, true),
    };
}

function formToPayload(form) {
    return {
        coupon_id: String(form.coupon_id),
        course_id: String(form.course_id),
        is_active: Boolean(form.is_active),
    };
}

function validateForm(form) {
    if (!form.coupon_id) return "Please select a coupon.";
    if (!form.course_id) return "Please select a course.";

    return "";
}

function getRowLabel(row) {
    return (
        row?.course_title ||
        row?.course_code ||
        `mapping ${row?.id ?? ""}`
    );
}

export default function CouponCoursePage() {
    const [searchParams] = useSearchParams();
    const couponId = searchParams.get("coupon_id") || "";

    return (
        <CouponChildCrudPage
            title="Coupon Courses"
            subtitle="Map coupons to the courses they can be applied to."
            icon={<MenuBookOutlinedIcon />}
            tableTitle="Coupon Courses"
            addLabel="Add Coupon Course"
            deleteActionLabel="Deactivate"
            deleteConfirmMessage={(label) =>
                `Deactivate "${label}"? It will be removed from active coupon mappings and can be reactivated later.`
            }
            deleteSuccessMessage="Coupon-course mapping deactivated."
            canDeleteRow={(row) => normalizeBoolean(row?.is_active, true)}
            searchPlaceholder="Search coupon or course..."
            emptyMessage="No coupon-course mappings found."
            minWidth={1050}
            columns={COLUMNS}
            formFields={FORM_FIELDS}
            initialForm={INITIAL_FORM}
            api={API}
            loadDropdowns={getCouponCourseDropdowns}
            rowToForm={rowToForm}
            formToPayload={formToPayload}
            validateForm={validateForm}
            getRowLabel={getRowLabel}
            filters={FILTERS}
            couponId={couponId}
        />
    );
}
