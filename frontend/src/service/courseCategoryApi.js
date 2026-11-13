
import api from "./Api";

// ---------------------------------------------------------
// Response helpers
// ---------------------------------------------------------

function unwrap(response) {
    const body = response?.data ?? response;

    if (
        body &&
        typeof body === "object" &&
        Object.prototype.hasOwnProperty.call(body, "data")
    ) {
        return {
            ...body,
            data: body.data,
        };
    }

    return body;
}

async function request(callback) {
    try {
        return unwrap(await callback());
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            error?.message ||
            "Course category API request failed.";

        const normalizedError = new Error(message);
        normalizedError.statusCode = error?.response?.status;
        normalizedError.response = error?.response;
        normalizedError.code = error?.code;

        throw normalizedError;
    }
}

// ---------------------------------------------------------
// GET /api/course-categories
// ---------------------------------------------------------

export async function getAllCourseCategories() {
    return request(() =>
        api.get("/course-categories")
    );
}

// ---------------------------------------------------------
// GET /api/course-categories/:id
// ---------------------------------------------------------

export async function getCourseCategoryById(id) {
    return request(() =>
        api.get(`/course-categories/${encodeURIComponent(String(id))}`)
    );
}

// ---------------------------------------------------------
// POST /api/course-categories
// ---------------------------------------------------------

export async function createCourseCategory(payload) {
    return request(() =>
        api.post("/course-categories", payload)
    );
}

// ---------------------------------------------------------
// PUT /api/course-categories/:id
// ---------------------------------------------------------

export async function updateCourseCategory(id, payload) {
    return request(() =>
        api.put(
            `/course-categories/${encodeURIComponent(String(id))}`,
            payload
        )
    );
}

// ---------------------------------------------------------
// DELETE /api/course-categories/:id
// Backend performs a soft delete.
// ---------------------------------------------------------

export async function deleteCourseCategory(id) {
    return request(() =>
        api.delete(
            `/course-categories/${encodeURIComponent(String(id))}`
        )
    );
}
