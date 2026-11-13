import api from "./Api";

const BASE_URL = "/admin/enrollments";

function unwrap(response) {
    const body = response?.data;

    if (
        body &&
        typeof body === "object" &&
        Object.prototype.hasOwnProperty.call(body, "data")
    ) {
        return body.data;
    }

    return body ?? null;
}

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

export const adminEnrollmentApi = {
    getAll: (params = {}) =>
        request(async () => {
            const response = await api.get(BASE_URL, { params });
            const body = response?.data;
            const rows = unwrap(response);

            return {
                rows: Array.isArray(rows) ? rows : [],
                pagination: body?.pagination ?? null,
            };
        }),

    getById: (id) =>
        request(async () => {
            const response = await api.get(
                `${BASE_URL}/${encodeURIComponent(String(id))}`
            );

            return unwrap(response);
        }),

    getStatuses: () =>
        request(async () => {
            const response = await api.get(`${BASE_URL}/statuses`);

            return unwrap(response) ?? [];
        }),
};

export { getErrorMessage };
