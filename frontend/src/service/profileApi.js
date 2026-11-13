
import api from "./Api";

/**
 * Fetch the currently authenticated user's profile.
 * Backend endpoint: GET /api/auth/me
 *
 * The access token is sent automatically as an HttpOnly cookie.
 */
export const getCurrentAdminProfile = async () => {
    const response = await api.get("/auth/me");

    // Backend controller returns:
    // { success: true, data: result }
    const profile = response.data?.data;

    if (!response.data?.success || !profile) {
        throw new Error(
            response.data?.message || "Profile information was not returned."
        );
    }

    return profile;
};

/**
 * Update the authenticated user's editable profile fields.
 * Backend endpoint: PATCH /api/auth/me
 */
export const updateCurrentAdminProfile = async (profileData) => {
    const response = await api.patch("/auth/me", profileData);
    const profile = response.data?.data;

    if (!response.data?.success || !profile) {
        throw new Error(
            response.data?.message || "Profile information could not be updated."
        );
    }

    return profile;
};
