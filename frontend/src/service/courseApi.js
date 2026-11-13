
 // src/service/courseApi.js

import api from "./Api";

// ---------------------------------------------------------
// Response helpers
// ---------------------------------------------------------

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
        error?.response?.data?.error ||
        error?.message ||
        "Something went wrong while communicating with the server."
    );
}

async function request(callback) {
    try {
        return unwrap(await callback());
    } catch (error) {
        const normalizedError = new Error(getErrorMessage(error));

        normalizedError.status = error?.response?.status;
        normalizedError.statusCode = error?.response?.status;
        normalizedError.responseData = error?.response?.data;

        throw normalizedError;
    }
}

// IDs must remain strings for PostgreSQL BIGINT compatibility.
function validateId(id) {
    const value = String(id ?? "").trim();

    if (!/^[1-9]\d*$/.test(value)) {
        throw new Error("Invalid course ID.");
    }

    return value;
}

// ---------------------------------------------------------
// Course API
// ---------------------------------------------------------

const courseApi = {
    /**
     * GET /api/admin/courses
     * Get all non-deleted courses.
     */
    async getAllCourses() {
        const result = await request(() =>
            api.get("/admin/courses")
        );

        // Supports either an array or { data: [...] }.
        return Array.isArray(result)
            ? result
            : Array.isArray(result?.courses)
              ? result.courses
              : [];
    },

    /**
     * GET /api/admin/courses/pending
     * Get courses awaiting admin approval.
     */
    async getPendingCourses() {
        const result = await request(() =>
            api.get("/admin/courses/pending")
        );

        return Array.isArray(result)
            ? result
            : Array.isArray(result?.courses)
              ? result.courses
              : [];
    },

    /**
     * GET /api/admin/courses/:id/review
     * Get course details with modules and lessons.
     */
    async getReviewBundle(courseId) {
        const id = validateId(courseId);

        return request(() =>
            api.get(`/admin/courses/${encodeURIComponent(id)}/review`)
        );
    },

    /**
     * POST /api/admin/courses/:id/approve
     * Approve and automatically publish a pending course.
     */
    async approveCourse(courseId) {
        const id = validateId(courseId);

        return request(() =>
            api.post(`/admin/courses/${encodeURIComponent(id)}/approve`)
        );
    },

    /**
     * POST /api/admin/courses/:id/reject
     * Reject a pending course with a reason.
     */
    async rejectCourse(courseId, reason) {
        const id = validateId(courseId);
        const normalizedReason = String(reason ?? "").trim();

        if (!normalizedReason) {
            throw new Error("Please enter a rejection reason.");
        }

        if (normalizedReason.length > 5000) {
            throw new Error(
                "The rejection reason cannot exceed 5000 characters."
            );
        }

        return request(() =>
            api.post(
                `/admin/courses/${encodeURIComponent(id)}/reject`,
                { reason: normalizedReason }
            )
        );
    },
};

export {
    getErrorMessage,
    validateId,
};

export default courseApi;
