import api from "./Api";

const BASE_URL = "/coupon-redemptions";

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

function toListResult(response) {
    const body = response?.data;
    const data = unwrap(response);

    if (Array.isArray(data)) {
        return {
            rows: data,
            pagination: body?.pagination ?? null,
        };
    }

    return {
        rows: Array.isArray(data?.rows) ? data.rows : [],
        pagination: data?.pagination ?? body?.pagination ?? null,
    };
}

export async function getCouponRedemptionDropdowns() {
    return request(async () => {
        const response = await api.get(`${BASE_URL}/dropdowns`);

        return (
            unwrap(response) ?? {
                coupons: [],
                students: [],
            }
        );
    });
}

export async function getCouponRedemptions(params = {}) {
    return request(async () => {
        const query = {
            page: params.page ?? 1,
            limit: params.limit ?? 100,
        };

        if (params.search) query.search = params.search;
        if (params.coupon_id) query.coupon_id = String(params.coupon_id);
        if (params.student_id) query.student_id = String(params.student_id);
        if (params.payment_id) query.payment_id = String(params.payment_id);
        if (params.status) query.status = params.status;

        if (params.is_active !== undefined && params.is_active !== "") {
            query.is_active = params.is_active;
        }

        if (
            params.include_deleted !== undefined &&
            params.include_deleted !== ""
        ) {
            query.include_deleted = params.include_deleted;
        }

        const response = await api.get(BASE_URL, { params: query });
        return toListResult(response);
    });
}

export async function getCouponRedemptionById(id) {
    return request(async () => {
        const response = await api.get(
            `${BASE_URL}/${encodeURIComponent(String(id))}`
        );

        return unwrap(response);
    });
}

export { getErrorMessage };
