export function getErrorMessage(error, fallback = "Something went wrong.") {
    return (
        error?.response?.data?.message ||
        error?.message ||
        fallback
    );
}

export function normalizeId(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    return String(value);
}

export function normalizeBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;

    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        if (["true", "yes", "active"].includes(normalized)) return true;
        if (["false", "no", "inactive"].includes(normalized)) return false;
    }

    return fallback;
}

export function formatAmount(value) {
    if (value === null || value === undefined || value === "") {
        return "-";
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number.toLocaleString(undefined, {
              maximumFractionDigits: 2,
          })
        : String(value);
}

export function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "-"
        : date.toLocaleString();
}

export function toDateTimeLocal(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    );

    return localDate.toISOString().slice(0, 16);
}

export function toIsoDate(value) {
    if (!value) return "";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? ""
        : date.toISOString();
}

export function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function getCouponLabel(row) {
    return row?.coupon_code ?? row?.couponCode ?? "";
}

export function getCourseLabel(row) {
    const code = row?.course_code ?? row?.courseCode ?? "";
    const title = row?.title ?? row?.course_title ?? row?.courseTitle ?? "";

    if (title && code) return `${title} (${code})`;

    return title || code || "";
}

export function getStudentLabel(row) {
    const name = row?.student_name ?? row?.studentName ?? "";
    const register =
        row?.register_number ??
        row?.registerNumber ??
        row?.student_code ??
        row?.studentCode ??
        "";

    if (name && register) return `${name} (${register})`;

    return name || register || "";
}

export function getPaymentLabel(row) {
    const number = row?.payment_number ?? row?.paymentNumber ?? "";
    const name = row?.student_name ?? row?.studentName ?? "";

    if (number && name) return `${number} - ${name}`;

    return number || name || "";
}

export function getEnrollmentLabel(row) {
    const number =
        row?.enrollment_number ?? row?.enrollmentNumber ?? "";
    const name = row?.student_name ?? row?.studentName ?? "";
    const course = row?.course_title ?? row?.courseTitle ?? "";

    return [number, name, course].filter(Boolean).join(" - ");
}

export function getStatusColor(status) {
    switch (String(status ?? "").toUpperCase()) {
        case "REDEEMED":
            return { color: "#168653", bgcolor: "#e6f6ee" };
        case "CANCELLED":
            return { color: "#d32f2f", bgcolor: "#fdeaea" };
        case "RESERVED":
            return { color: "#b26a00", bgcolor: "#fff4e0" };
        default:
            return { color: "#6e7086", bgcolor: "#f2f1f7" };
    }
}
