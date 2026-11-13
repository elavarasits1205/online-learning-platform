import api from "./Api";

const BASE_URL = "/coupons";

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
        normalizedError.originalError = error;
        throw normalizedError;
    }
}

// GET /api/coupons/institutions
export async function getCouponInstitutions() {
    return request(async () => {
        const response = await api.get(`${BASE_URL}/institutions`);
        const data = unwrap(response);

        return Array.isArray(data) ? data : [];
    });
}

// GET /api/coupons
export async function getCoupons(params = {}) {
    return request(async () => {
        const query = {
            page: params.page ?? 1,
            limit: params.limit ?? 100,
        };

        if (params.search) {
            query.search = params.search;
        }

        if (
            params.institution_id !== undefined &&
            params.institution_id !== ""
        ) {
            query.institution_id = String(params.institution_id);
        }

        if (
            params.is_active !== undefined &&
            params.is_active !== ""
        ) {
            query.is_active = params.is_active;
        }

        const response = await api.get(BASE_URL, { params: query });
        const body = response?.data;
        const data = unwrap(response);

        // Backend currently returns the rows in body.data.
        if (Array.isArray(data)) {
            return {
                rows: data,
                pagination: body?.pagination ?? null,
            };
        }

        // Also support a backend response shaped as { data: { rows } }.
        return {
            rows: Array.isArray(data?.rows) ? data.rows : [],
            pagination: data?.pagination ?? body?.pagination ?? null,
        };
    });
}

// GET /api/coupons/:id
export async function getCouponById(id) {
    return request(async () => {
        const response = await api.get(
            `${BASE_URL}/${encodeURIComponent(String(id))}`
        );

        return unwrap(response);
    });
}

// POST /api/coupons
export async function createCoupon(payload) {
    return request(async () => {
        const response = await api.post(BASE_URL, payload);
        return unwrap(response);
    });
}

// PUT /api/coupons/:id
export async function updateCoupon(id, payload) {
    return request(async () => {
        const response = await api.put(
            `${BASE_URL}/${encodeURIComponent(String(id))}`,
            payload
        );

        return unwrap(response);
    });
}

// DELETE /api/coupons/:id
export async function deleteCoupon(id) {
    return request(async () => {
        const response = await api.delete(
            `${BASE_URL}/${encodeURIComponent(String(id))}`
        );

        return unwrap(response);
    });
}

export { getErrorMessage };