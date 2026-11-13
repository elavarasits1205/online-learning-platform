
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { getCurrentUser } from "../service/Authapi";
import {
    setAuthUser,
    clearAuthUser,
} from "../utils/authCookie";

// Normalize a role returned by the backend.
function normalizeRole(role) {
    if (typeof role === "string") {
        return role.trim().toUpperCase();
    }

    if (role && typeof role === "object") {
        const value =
            role.code ??
            role.name ??
            role.role_code ??
            role.role_name ??
            role.roleName;

        return typeof value === "string"
            ? value.trim().toUpperCase()
            : "";
    }

    return "";
}

// Extract the user from common /auth/me response formats.
function extractUser(response) {
    const body = response?.data ?? response;
    const data = body?.data ?? body;

    const user =
        data?.user ??
        data?.currentUser ??
        data?.current_user ??
        data;

    if (!user || typeof user !== "object" || Array.isArray(user)) {
        return null;
    }

    return user;
}

function normalizeUserRoles(user) {
    const roles = Array.isArray(user?.roles)
        ? user.roles
        : Array.isArray(user?.user?.roles)
          ? user.user.roles
          : [];

    const singleRole =
        user?.role ??
        user?.role_code ??
        user?.role_name ??
        user?.roleName;

    return [
        ...new Set(
            [
                ...roles.map(normalizeRole),
                ...(singleRole ? [normalizeRole(singleRole)] : []),
            ].filter(Boolean)
        ),
    ];
}


function clearAuthentication() {
    // Tokens are HttpOnly cookies; only the UI user cookie is cleared here.
    clearAuthUser();
}

export default function PrivateRoute() {
    const location = useLocation();

    const [status, setStatus] = useState("checking");

    useEffect(() => {
        let cancelled = false;

        async function verifySession() {
            try {
                // The access token is sent automatically as an HttpOnly
                // cookie. /auth/me is the source of truth for the user.
                const response = await getCurrentUser();

                if (response?.success === false) {
                    throw new Error(
                        response.message ||
                            "Unable to verify the current user."
                    );
                }

                const user = extractUser(response);

                if (!user) {
                    throw new Error(
                        "The current-user API returned an invalid response."
                    );
                }

                const roles = normalizeUserRoles(user);

                // Keep the verified user and backend roles in session storage.
                const verifiedUser = {
                    ...user,
                    roles,
                    permissions: Array.isArray(user.permissions)
                        ? user.permissions
                        : [],
                };

                // Refresh the readable UI cache from the verified session.
                // A stale role here can send a student to the wrong route.
                setAuthUser(verifiedUser);

                if (!cancelled) {
                    setStatus("authenticated");
                }
            } catch (error) {
                console.error(
                    "Authentication verification failed:",
                    error
                );

                clearAuthentication();

                if (!cancelled) {
                    setStatus("unauthenticated");
                }
            }
        }

        verifySession();

        return () => {
            cancelled = true;
        };
    }, []);

    if (status === "checking") {
        return (
            <div
                role="status"
                aria-live="polite"
                style={{
                    minHeight: "50vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                }}
            >
                Verifying your session...
            </div>
        );
    }

    if (status === "unauthenticated") {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location }}
            />
        );
    }

    return <Outlet />;
}
