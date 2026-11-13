import api from "./Api";

const BASE_URL = "/admin/reports";

function getErrorMessage(error) {
    return (
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong. Please try again."
    );
}

async function request(callback) {
    try {
        return await callback();
    } catch (error) {
        const normalizedError = new Error(getErrorMessage(error));
        normalizedError.statusCode = error?.response?.status;
        throw normalizedError;
    }
}

function toReportResult(response) {
    const body = response?.data;
    const rows = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.rows)
          ? body.rows
          : [];

    return {
        rows,
        pagination: body?.pagination ?? null,
        summary: body?.summary ?? null,
    };
}

const reportResource = (path) => ({
    getAll: (params = {}) =>
        request(async () => {
            const response = await api.get(`${BASE_URL}/${path}`, { params });
            return toReportResult(response);
        }),
});

export const adminReportApi = {
    payroll: reportResource("payroll"),
    enrollments: reportResource("enrollments"),
    users: reportResource("users"),
};

export { getErrorMessage };
