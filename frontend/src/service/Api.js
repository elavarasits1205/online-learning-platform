import axios from "axios";
import { clearAuthUser } from "../utils/authCookie";
import { waitForPageAccess } from "./pageAccessStore";

// Remove tokens left by older builds that stored credentials in Web Storage.
function clearLegacyAuthTokens() {
    if (typeof window === "undefined") return;

    try {
        for (const storage of [
            window.localStorage,
            window.sessionStorage
        ]) {
            for (const key of [
                "accessToken",
                "refreshToken",
                "token"
            ]) {
                storage.removeItem(key);
            }
        }
    } catch {
        // Storage may be unavailable.
    }
}

clearLegacyAuthTokens();

// ========================================
// API CONFIGURATION
// ========================================

const RENDER_API_URL =
    "https://online-learning-platform-backend-xhjl.onrender.com";

const configuredApiBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.trim();

// Development uses the Vite proxy.
// Production uses the Render backend.
const API_BASE_URL = (() => {
    if (import.meta.env.DEV) {
        return "/api";
    }

    const baseUrl = (
        configuredApiBaseUrl || RENDER_API_URL
    ).replace(/\/+$/, "");

    const apiUrl = new URL(baseUrl);

    if (
        typeof window !== "undefined" &&
        window.location.protocol === "https:" &&
        apiUrl.protocol !== "https:"
    ) {
        throw new Error(
            "VITE_API_BASE_URL must use HTTPS in production."
        );
    }

    return apiUrl.pathname.replace(/\/+$/, "").endsWith("/api")
        ? baseUrl
        : `${baseUrl}/api`;
})();

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    },
    timeout: 30000
});

// ========================================
// REQUEST INTERCEPTOR
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
// AUTHENTICATION REQUEST CHECK
// ========================================

const isAuthRequest = (url = "") =>
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/register");

let refreshPromise = null;

// ========================================
// REFRESH SESSION
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
// CLEAR CACHED USER
// ========================================

function clearCachedUser() {
    clearAuthUser();
}

// ========================================
// RESPONSE INTERCEPTOR
// ========================================

api.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest = error.config;
        const requestUrl = String(
            originalRequest?.url ?? ""
        ).toLowerCase();

        if (
            error.response?.status === 403 &&
            String(originalRequest?.method ?? "get").toLowerCase() === "get" &&
            !requestUrl.includes("/auth/") &&
            !requestUrl.includes("/rbac/me")
        ) {
            const pathname =
                typeof window === "undefined"
                    ? ""
                    : window.location.pathname;

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
                    data: {
                        success: true,
                        data: [],
                        rows: []
                    },
                    config: originalRequest
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

            return api(originalRequest);
        } catch (refreshError) {
            clearCachedUser();

            if (
                typeof window !== "undefined" &&
                window.location.pathname !== "/login"
            ) {
                const returnTo =
                    `${window.location.pathname}${window.location.search}${window.location.hash}`;

                window.location.replace(
                    `/login?redirect=${encodeURIComponent(returnTo)}`
                );
            }

            return Promise.reject(refreshError);
        }
    }
);

export default api;