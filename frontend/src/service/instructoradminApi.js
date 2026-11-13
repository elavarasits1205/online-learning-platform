
import api from "./Api";

// Share the HttpOnly-cookie client and refresh flow used by the rest of the UI.
const instructorAdminApi = api;

async function request(callback) {
    try {
        return await callback();
    } catch (error) {
        const message =
            error.response?.data?.message ||
            error.message ||
            "Something went wrong.";

        throw new Error(message);
    }
}

// ============================================================
// GET ALL INSTRUCTORS
// GET /api/admin/instructors
// ============================================================

export const getAllInstructors = async () => {
    const response = await request(() => instructorAdminApi.get(
        "/admin/instructors"
    ));

    return response.data;
};

// ============================================================
// GET INSTRUCTOR BY ID
// GET /api/admin/instructors/:id
// ============================================================

export const getInstructorById = async (id) => {
    if (!/^[1-9]\d*$/.test(String(id))) {
        throw new Error("Invalid instructor ID.");
    }

    const response = await request(() => instructorAdminApi.get(
        `/admin/instructors/${encodeURIComponent(String(id))}`
    ));

    return response.data;
};

// ============================================================
// EXPORT
// ============================================================

const instructoradminApi = {
    getAllInstructors,
    getInstructorById,
};

export default instructoradminApi;
