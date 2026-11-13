import api from "./Api";

const BASE_URL = "/coupon-courses";

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

export async function getCouponCourseDropdowns() {
    return request(async () => {
        const response = await api.get(`${BASE_URL}/dropdowns`);
        return unwrap(response) ?? { coupons: [], courses: [] };
    });
}

export async function getCouponCourses(params = {}) {
    return request(async () => {
        const query = {
            page: params.page ?? 1,
            limit: params.limit ?? 100,
        };

        if (params.search) query.search = params.search;
        if (params.coupon_id) query.coupon_id = String(params.coupon_id);
        if (params.course_id) query.course_id = String(params.course_id);

        if (params.is_active !== undefined && params.is_active !== "") {
            query.is_active = params.is_active;
        }

        const response = await api.get(BASE_URL, { params: query });
        return toListResult(response);
    });
}

export async function getCouponCourseById(id) {
    return request(async () => {
        const response = await api.get(
            `${BASE_URL}/${encodeURIComponent(String(id))}`
        );

        return unwrap(response);
    });
}

export async function createCouponCourse(payload) {
    return request(async () => {
        const response = await api.post(BASE_URL, payload);
        return unwrap(response);
    });
}

export async function updateCouponCourse(id, payload) {
    return request(async () => {
        const response = await api.put(
            `${BASE_URL}/${encodeURIComponent(String(id))}`,
            payload
        );

        return unwrap(response);
    });
}

export async function deleteCouponCourse(id) {
    return request(async () => {
        const response = await api.delete(
            `${BASE_URL}/${encodeURIComponent(String(id))}`
        );

        return unwrap(response);
    });
}

export { getErrorMessage };
