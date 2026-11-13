
import api from "./Api";

// Normalize common API response formats.
function unwrapResponse(response) {
    const body = response?.data ?? response;
    return body?.data ?? body;
}

// ============================================================
// LOGIN
// ============================================================

export async function loginUser(identifier, password) {
    const response = await api.post("/auth/login", {
        identifier,
        password,
    });

    return unwrapResponse(response);
}
export async function requestPasswordReset(email) {
    return api.post("/auth/forgot-password", { email });
}

export async function verifyPasswordResetOtp({ email, token, otp }) {
    return api.post("/auth/reset-password/verify-otp", {
        email,
        token,
        otp,
    });
}

export async function resetPassword({ email, resetTicket, newPassword }) {
    return api.post("/auth/reset-password", {
        email,
        resetTicket,
        newPassword,
    });
}
// ============================================================
// STUDENT REGISTER
// ============================================================

export async function registerStudent(studentData) {
    const response = await api.post(
        "/auth/register/student",
        studentData
    );

    return unwrapResponse(response);
}

// ============================================================
// INSTITUTIONS
// ============================================================

export async function getInstitutions() {
    const response = await api.get("/public/institutions");
    return response.data;
}
// ============================================================
// INSTRUCTOR REGISTER
// ============================================================

export async function registerInstructor(instructorData) {
    const response = await api.post(
        "/auth/register/instructor",
        instructorData
    );

    return unwrapResponse(response);
}

// ============================================================
// REFRESH TOKEN
// ============================================================

export async function refreshAccessToken() {
    // The refresh token is read from the HttpOnly cookie.
    const response = await api.post("/auth/refresh", {});

    return unwrapResponse(response);
}

// ============================================================
// LOGOUT
// ============================================================

export async function logoutUser() {
    // The refresh token is read from the HttpOnly cookie.
    const response = await api.post("/auth/logout", {});

    return unwrapResponse(response);
}

// ============================================================
// CURRENT AUTHENTICATED USER
// ============================================================

export async function getCurrentUser() {
    const response = await api.get("/auth/me");
    return unwrapResponse(response);
}

// ============================================================
// CURRENT USER'S RBAC ACCESS
// ============================================================

export async function getMyAccess() {
    const response = await api.get("/rbac/me");
    return unwrapResponse(response);
}
