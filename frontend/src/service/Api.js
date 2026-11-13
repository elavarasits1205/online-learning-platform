import axios from "axios";
import { clearAuthUser } from "../utils/authCookie";
import { waitForPageAccess } from "./pageAccessStore";

// Remove tokens left by older builds that stored credentials in Web Storage.
function clearLegacyAuthTokens() {
    if (typeof window === "undefined") return;

    try {
        for (const storage of [window.localStorage, window.sessionStorage]) {
            for (const key of ["accessToken", "refreshToken", "token"]) {
                storage.removeItem(key);
            }
        }
    } catch {
        // Storage can be unavailable in restricted browser contexts.
    }
}

clearLegacyAuthTokens();

// ========================================
// API Configuration
// ========================================

const configuredApiBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.trim();

// Use the Vite proxy during development so the app and API share an origin.
// This avoids browser CORS failures when the frontend is opened as localhost,
// 127.0.0.1, or on a Vite fallback port.
const API_BASE_URL = import.meta.env.DEV
    ? "/api"
    : configuredApiBaseUrl || "/api";

if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    configuredApiBaseUrl
) {
    const apiUrl = new URL(configuredApiBaseUrl, window.location.origin);

    if (apiUrl.protocol !== "https:") {
        throw new Error(
            "VITE_API_BASE_URL must use HTTPS when the frontend is served over HTTPS."
        );
    }
}

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 15000,
});

// ========================================
// Request Interceptor
// Credentials (HttpOnly cookies) are sent
// automatically by the browser.
// ========================================

api.interceptors.request.use(
    (config) => {
        if (config.data instanceof FormData) {
            if (typeof config.headers.delete === "function") {
                config.headers.delete("Content-Type");
                config.headers.delete("content-type");
            } else {
                delete config.headers["Content-Type"];
                delete config.headers["content-type"];
            }
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// ========================================
// Authentication Request Check
// ========================================

const isAuthRequest = (url = "") =>
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/register");

// Prevent multiple simultaneous refresh requests.
let refreshPromise = null;

// ========================================
// Refresh the HttpOnly cookie session
// ========================================

async function refreshSession() {
    if (!refreshPromise) {
        refreshPromise = api
            .post("/auth/refresh", {})
            .then((response) => {
                if (response?.data?.success === false) {
                    throw new Error(
                        response.data.message ||
                            "Your session has expired. Please log in again."
                    );
                }

                return true;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

// ========================================
// Local (non-sensitive) user cache
// ========================================

function clearCachedUser() {
    clearAuthUser();
}

// ========================================
// Response Interceptor
// Handle expired access tokens
// ========================================

api.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest = error.config;
        const requestUrl = String(originalRequest?.url ?? "").toLowerCase();

        if (
            error.response?.status === 403 &&
            String(originalRequest?.method ?? "get").toLowerCase() === "get" &&
            !requestUrl.includes("/auth/") &&
            !requestUrl.includes("/rbac/me")
        ) {
            const pathname =
                typeof window === "undefined" ? "" : window.location.pathname;
            const pageAccess = await waitForPageAccess(pathname);

            if (
                pageAccess?.matched &&
                pageAccess.canCreate &&
                !pageAccess.canView &&
                !pageAccess.isAdmin
            ) {
                return {
                    ...error.response,
                    status: 200,
                    statusText: "OK",
                    data: { success: true, data: [], rows: [] },
                    config: originalRequest,
                };
            }
        }

        if (
            !originalRequest ||
            error.response?.status !== 401 ||
            originalRequest._retry ||
            isAuthRequest(originalRequest.url)
        ) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            await refreshSession();

            // The new access token is now in the HttpOnly cookie,
            // so the retried request needs no Authorization header.
            return api(originalRequest);
        } catch (refreshError) {
            clearCachedUser();

            if (window.location.pathname !== "/login") {
                const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                window.location.replace(
                    `/login?redirect=${encodeURIComponent(returnTo)}`
                );
            }

            return Promise.reject(refreshError);
        }
    }
);

export default api;
