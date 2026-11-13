
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getMyAccess } from "../service/Authapi";
import { getAuthUser } from "../utils/authCookie";

const MENU_ROUTE_ALIASES = {
    "/my-learning": ["/student/my-learning"],
    "/my-learning/active": [
        "/student/learning-courses",
        "/student/learning",
    ],
    "/my-learning/completed": ["/student/completed-courses"],
    "/my-learning/notes": ["/student/my-learning/notes"],
    "/notifications": [
        "/notification",
        "/admin/notifications",
        "/admin/community/notifications",
        "/community/notification",
        "/community/notifications",
    ],
    "/profile": ["/admin/profile", "/instructor/profile"],
    "/admin/courses": ["/instructor/all-courses"],
    "/admin/course-categories": ["/instructor/course-categories"],
    "/assessments/exams": ["/instructor/assessments"],
    "/community/discussions": [
        "/community",
        "/community/posts",
        "/community/my-discussions/posts",
        "/community/bookmarks",
    ],
    "/my-learning/results": [
        "/student/assessments",
        "/instructor/assessment-results",
        "/instructor/assessments/:assessmentId/results",
    ],
    "/student/payments": ["/student/purchase-history"],
    "/admin/enrollments": [
        "/instructor/enrollments",
        "/instructor/students",
    ],
    "/admin/reports/enrollments": ["/instructor/reports/enrollments"],
    "/admin/payments/reports": ["/admin/reports/payments"],
    "/admin/reports/payments": ["/admin/payments/reports"],
};

function unwrapAccess(response) {
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

function normalizePath(value) {
    if (typeof value !== "string") return "";
    const path = value.trim().replace(/\/+$/, "");
    return path.startsWith("/") ? path : "";
}

function matchesRoutePath(candidatePath, currentPath) {
    const candidate = normalizePath(candidatePath);
    const current = normalizePath(currentPath);
    if (!candidate || !current) return false;

    const expression = candidate
        .split("/")
        .map((segment) => segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("/");

    return new RegExp(`^${expression}(?:/.*)?$`).test(current);
}

function flattenMenus(menus) {
    if (!Array.isArray(menus)) return [];

    return menus.flatMap((menu) => [
        menu,
        ...flattenMenus(menu?.children),
    ]);
}

function hasMenuGrant(menu) {
    return [
        menu?.hasAnyPermission,
        menu?.has_any_permission,
        menu?.canView,
        menu?.can_view,
        menu?.canCreate,
        menu?.can_create,
        menu?.canAdd,
        menu?.can_add,
        menu?.canUpdate,
        menu?.can_update,
        menu?.canEdit,
        menu?.can_edit,
        menu?.canDelete,
        menu?.can_delete,
        menu?.canApprove,
        menu?.can_approve,
        menu?.canPublish,
        menu?.can_publish,
    ].some((value) => value === true || value === 1 || value === "1" || value === "true");
}

function getMatchingMenu(menus, pathname, roles) {
    const currentPath = normalizePath(pathname);
    const candidates = flattenMenus(menus)
        .flatMap((menu) => {
            const menuPath = normalizePath(
                menu?.routePath ?? menu?.route_path ?? menu?.path
            );

            const aliases = menuPath === "/dashboard"
                ? roles.includes("ADMIN")
                    ? ["/admin/dashboard"]
                    : roles.includes("INSTRUCTOR")
                      ? ["/instructor/dashboard"]
                      : roles.includes("STUDENT")
                        ? ["/student/dashboard"]
                        : []
                : MENU_ROUTE_ALIASES[menuPath] || [];

            return menuPath
                ? [menuPath, ...aliases].map((path) => ({ menu, path }))
                : [];
        });

    const exactMatch = candidates.find(
        (candidate) => matchesRoutePath(candidate.path, currentPath) &&
            normalizePath(candidate.path) === currentPath
    );
    if (exactMatch) return exactMatch.menu;

    // Nested record pages inherit access from the longest matching menu path.
    const matchingPaths = candidates
        .filter(({ path }) => matchesRoutePath(path, currentPath))
        .sort((left, right) => normalizePath(right.path).length - normalizePath(left.path).length);

    return matchingPaths[0]?.menu ?? null;
}

function getRequiredAction(pathname) {
    const path = normalizePath(pathname).toLowerCase();
    const segments = path.split("/").filter(Boolean);

    if (segments.some((segment) => ["create", "new", "add"].includes(segment))) {
        return "canCreate";
    }

    if (segments.some((segment) => ["edit", "update"].includes(segment))) {
        return "canUpdate";
    }

    if (segments.includes("delete")) {
        return "canDelete";
    }

    return null;
}

function canOpenMenuRoute(menu, pathname) {
    if (!menu) return false;

    const requiredAction = getRequiredAction(pathname);
    if (requiredAction) {
        const actionAliases = {
            canCreate: ["canCreate", "can_create", "canAdd", "can_add"],
            canUpdate: ["canUpdate", "can_update", "canEdit", "can_edit"],
            canDelete: ["canDelete", "can_delete"],
        };

        return actionAliases[requiredAction].some((field) =>
            [true, 1, "true", "1"].includes(menu[field])
        );
    }

    return hasMenuGrant(menu);
}

// ============================================================
// ROLE NORMALIZATION
// ============================================================

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

// ============================================================
// GET ROLES FROM THE VERIFIED USER
// ============================================================

function getUserRoles(user) {
    if (!user || typeof user !== "object") {
        return [];
    }

    const rawRoles = Array.isArray(user.roles)
        ? user.roles
        : Array.isArray(user.user?.roles)
          ? user.user.roles
          : [];

    const singleRole =
        user.role ??
        user.role_code ??
        user.role_name ??
        user.roleName;

    return [
        ...new Set(
            [
                ...rawRoles.map(normalizeRole),
                ...(singleRole ? [normalizeRole(singleRole)] : []),
            ].filter(Boolean)
        ),
    ];
}

// ============================================================
// ROLE-BASED DASHBOARD DESTINATION
// ============================================================

function getDashboardPath(roles) {
    if (roles.includes("ADMIN")) {
        return "/admin/dashboard";
    }

    if (roles.includes("INSTRUCTOR")) {
        return "/instructor/dashboard";
    }

    if (roles.includes("STUDENT")) {
        return "/student/dashboard";
    }

    return "/";
}

// ============================================================
// READ VERIFIED SESSION USER
// ============================================================

function getSessionUser() {
    return getAuthUser();
}

// ============================================================
// ROLE ROUTER
// ============================================================

export default function RoleRouter({ allowedRoles = [] }) {
    const location = useLocation();

    const user = getSessionUser();
    const roles = getUserRoles(user);
    const roleKey = roles.join("|");
    const userId = user?.id ?? user?.user?.id ?? "";
    const [menuAccess, setMenuAccess] = useState({
        pathname: "",
        roleKey: "",
        status: "checking",
    });
    const currentMenuAccess = menuAccess.pathname === location.pathname &&
        menuAccess.roleKey === roleKey
        ? menuAccess.status
        : "checking";
    const roleAllowed = allowedRoles
        .map(normalizeRole)
        .filter(Boolean)
        .some((role) => roles.includes(role));

    useEffect(() => {
        if (!user || roles.length === 0 || roles.includes("ADMIN")) {
            setMenuAccess({ pathname: location.pathname, roleKey, status: "not-needed" });
            return undefined;
        }

        setMenuAccess({ pathname: location.pathname, roleKey, status: "checking" });
        let cancelled = false;

        getMyAccess()
            .then((response) => {
                const access = unwrapAccess(response);
                const menu = getMatchingMenu(
                    access.menus ?? access.menuTree ?? access.menu_tree,
                    location.pathname,
                    roles
                );
                const menuAllowed = Boolean(
                    menu && canOpenMenuRoute(menu, location.pathname)
                );
                const allowed = menu
                    ? menuAllowed
                    : roleAllowed;

                if (!cancelled) {
                    setMenuAccess({
                        pathname: location.pathname,
                        roleKey,
                        status: allowed ? "allowed" : "denied",
                    });
                }
            })
            .catch((error) => {
                console.error("Unable to check menu access:", error);
                if (!cancelled) {
                    setMenuAccess({
                        pathname: location.pathname,
                        roleKey,
                        status: "denied",
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [location.pathname, roleAllowed, roleKey, userId]);

    // PrivateRoute verifies the HttpOnly cookie session and hydrates
    // the user cache before this component renders.
    if (!user) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location }}
            />
        );
    }

    if (roles.length === 0) {
        return <Navigate to="/" replace />;
    }

    if (!roles.includes("ADMIN") && currentMenuAccess === "checking") {
        return (
            <div role="status" aria-live="polite" style={{ padding: 24 }}>
                Checking menu access…
            </div>
        );
    }

    if (
        !roles.includes("ADMIN") &&
        currentMenuAccess !== "allowed" &&
        !(currentMenuAccess === "not-needed" && roleAllowed)
    ) {
        const dashboard = getDashboardPath(roles);

        return (
            <Navigate
                to={dashboard}
                replace
            />
        );
    }

    return <Outlet />;
}
