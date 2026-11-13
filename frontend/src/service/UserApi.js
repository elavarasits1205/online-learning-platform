import api from "./Api";

function getResponseBody(response) {
    return response?.data ?? response;
}

function getResponseData(response) {
    const body = getResponseBody(response);
    return body?.data ?? body;
}

function extractUsers(response) {
    const body = getResponseBody(response);
    const data = body?.data ?? body;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.users)) return data.users;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.rows)) return data.rows;

    return [];
}

function validateId(id) {
    const value = String(id ?? "").trim();

    if (!/^[1-9]\d*$/.test(value)) {
        throw new Error("A valid user ID is required.");
    }

    return encodeURIComponent(value);
}

// GET /api/admin/users
export async function getUsers(params = {}) {
    const response = await api.get("/admin/users", {
        params: {
            page: params.page ?? 1,
            limit: params.limit ?? 100,
            ...(params.search ? { search: params.search } : {}),
            ...(params.role ? { role: params.role } : {}),
            ...(params.status ? { status: params.status } : {}),
        },
    });

    return {
        users: extractUsers(response),
        pagination: getResponseBody(response)?.pagination ?? null,
    };
}

// GET /api/admin/users/:id
export async function getUserById(id) {
    const response = await api.get(`/admin/users/${validateId(id)}`);
    return getResponseData(response);
}

// PUT /api/admin/users/:id
export async function updateUser(id, userData = {}) {
    const payload = {
        username: String(userData.username ?? "").trim(),
        email: String(userData.email ?? "").trim().toLowerCase(),
        firstName: String(userData.firstName ?? "").trim(),
        lastName: String(userData.lastName ?? "").trim() || null,
        phoneNumber: String(userData.phoneNumber ?? "").trim() || null,
        isActive: userData.isActive,
        isLocked: userData.isLocked,
        emailVerifiedAt: userData.emailVerifiedAt ?? null,
        phoneVerifiedAt: userData.phoneVerifiedAt ?? null,
    };

    if (
        typeof payload.isActive !== "boolean" ||
        typeof payload.isLocked !== "boolean"
    ) {
        throw new Error(
            "Account status is missing. Reload the user and try again."
        );
    }

    const response = await api.put(
        `/admin/users/${validateId(id)}`,
        payload
    );

    return getResponseData(response);
}

// DELETE /api/admin/users/:id
export async function deleteUser(id) {
    const response = await api.delete(
        `/admin/users/${validateId(id)}`
    );

    return getResponseData(response);
}

// GET /api/admin/users/pending
export async function getPendingUsers() {
    const response = await api.get("/admin/users/pending");
    return extractUsers(response);
}

// POST /api/admin/users/:id/approve
export async function approveUser(id) {
    const response = await api.post(
        `/admin/users/${validateId(id)}/approve`
    );

    return getResponseData(response);
}

// POST /api/admin/users/:id/reject
// Supports rejectUser(id, "reason") and rejectUser(id, { reason: "reason" }).
export async function rejectUser(id, reason = "") {
    const normalizedReason =
        typeof reason === "string"
            ? reason
            : typeof reason?.reason === "string"
                ? reason.reason
                : "";

    const response = await api.post(
        `/admin/users/${validateId(id)}/reject`,
        {
            reason: normalizedReason.trim() || null,
        }
    );

    return getResponseData(response);
}
