import api from "./Api";

// Share the HttpOnly-cookie client and refresh flow used by the rest of the UI.
const studentApi = api;

async function requestStudent(callback) {
    try {
        return await callback();
    } catch (error) {
        console.error(
            "Student API Error:",
            error.response?.data || error.message
        );
        throw error;
    }
}

// ============================================================
// GET ALL STUDENTS
// GET /api/students
// ============================================================

export const getAllStudents = async () => {
    return requestStudent(() => studentApi.get("/students"));
};

// ============================================================
// GET STUDENT BY ID
// GET /api/students/:id
// ============================================================

export const getStudentById = async (id) => {
    const studentId = String(id ?? "").trim();

    // Keep PostgreSQL BIGINT IDs as strings.
    if (!/^[1-9]\d*$/.test(studentId)) {
        throw new Error("Invalid student ID.");
    }

    return requestStudent(() => studentApi.get(
        `/students/${encodeURIComponent(studentId)}`
    ));
};

export default studentApi;
