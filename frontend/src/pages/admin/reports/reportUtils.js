export const formatMoney = (value, currency = "INR") => {
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

export const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export const formatDateTime = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const formatNumber = (value) => {
    if (value === null || value === undefined || value === "") return "-";

    const amount = Number(value);

    return Number.isFinite(amount)
        ? new Intl.NumberFormat("en-IN").format(amount)
        : String(value);
};

export const getReportErrorMessage = (error) =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load the report.";
