import api from "./Api";

const BASE_URL = "/admin/payments";

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

function resource(path) {
    return {
        getAll: (params = {}) =>
            request(async () => {
                const response = await api.get(path ? `${BASE_URL}/${path}` : BASE_URL, {
                    params,
                });
                return toListResult(response);
            }),
        getById: (id) =>
            request(async () => {
                const response = await api.get(
                    `${path ? `${BASE_URL}/${path}` : BASE_URL}/${encodeURIComponent(
                        String(id)
                    )}`
                );
                return unwrap(response);
            }),
        remove: (id) =>
            request(async () => {
                const response = await api.delete(
                    `${path ? `${BASE_URL}/${path}` : BASE_URL}/${encodeURIComponent(
                        String(id)
                    )}`
                );
                return unwrap(response);
            }),
    };
}

export const adminPaymentApi = {
    payments: resource(""),
    reports: resource("reports"),
    transactions: resource("transactions"),
    refunds: resource("refunds"),
    webhooks: resource("webhooks"),
};

export const getPaymentStatuses = () =>
    request(async () => {
        const response = await api.get(`${BASE_URL}/statuses`);
        return unwrap(response) ?? [];
    });

export { getErrorMessage };
