import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { getMyAccess } from "../service/Authapi";
import { getAuthUser } from "../utils/authCookie";

function normalizeCode(value) {
    return String(value ?? "").trim().toUpperCase();
}

function getAccessData(response) {
    let value = response?.data ?? response;

    while (
        value &&
        !Array.isArray(value) &&
        typeof value === "object" &&
        value.data !== undefined
    ) {
        value = value.data;
    }

    return value ?? {};
}

function getCodes(values) {
    return Array.isArray(values)
        ? values.map((value) =>
              normalizeCode(
                  typeof value === "string"
                      ? value
                      : value?.code ?? value?.permissionCode ?? value?.permission_code
              )
          )
        : [];
}

export default function PermissionRoute({
    allowedRoles = [],
    anyPermissionCodes = [],
}) {
    const location = useLocation();
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let cancelled = false;

        async function checkAccess() {
            try {
                const access = getAccessData(await getMyAccess());
                const roles = getCodes(access.roles);
                const permissions = new Set(getCodes(access.permissions));
                const roleAllowed = allowedRoles
                    .map(normalizeCode)
                    .some((role) => roles.includes(role));
                const permissionAllowed = anyPermissionCodes
                    .map(normalizeCode)
                    .some((permission) => permissions.has(permission));

                if (!cancelled) {
                    setStatus(roleAllowed || permissionAllowed ? "allowed" : "denied");
                }
            } catch (error) {
                console.error("Unable to verify page permissions:", error);

                if (!cancelled) setStatus("denied");
            }
        }

        checkAccess();

        return () => {
            cancelled = true;
        };
    }, [allowedRoles, anyPermissionCodes]);

    if (status === "loading") {
        return (
            <div role="status" aria-live="polite" style={{ padding: 24 }}>
                Checking access…
            </div>
        );
    }

    if (status === "denied") {
        const roles = getCodes(getAuthUser()?.roles);
        const dashboard = roles.includes("ADMIN")
            ? "/admin/dashboard"
            : roles.includes("INSTRUCTOR")
              ? "/instructor/dashboard"
              : roles.includes("STUDENT")
                ? "/student/dashboard"
                : "/";

        return <Navigate to={dashboard} replace state={{ from: location }} />;
    }

    return <Outlet />;
}
