import api from "./Api";

const BASE_URL = "/student/payments";

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

function toListResult(response) {
    const body = response?.data;
    const data = unwrap(response);

    if (Array.isArray(data)) {
        return { rows: data, pagination: body?.pagination ?? null };
    }

    return {
        rows: Array.isArray(data?.rows) ? data.rows : [],
        pagination: data?.pagination ?? body?.pagination ?? null,
    };
}

export const studentPaymentApi = {
    payments: {
        getAll: (params = {}) =>
            request(async () => {
                const response = await api.get(BASE_URL, { params });
                return toListResult(response);
            }),
        getById: (id) =>
            request(async () => {
                const response = await api.get(
                    `${BASE_URL}/${encodeURIComponent(String(id))}`
                );
                return unwrap(response);
            }),
    },
};

export { getErrorMessage };
