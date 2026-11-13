import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

import { getMyAccess } from "../service/Authapi";
import { publishPageAccess } from "../service/pageAccessStore";

const MenuAccessContext = createContext({
  loading: false,
  roles: [],
  menus: [],
});

const ROUTE_ALIASES = {
  "/dashboard": [
    "/admin/dashboard",
    "/instructor/dashboard",
    "/student/dashboard",
  ],
  "/my-learning": ["/student/my-learning"],
  "/my-learning/active": ["/student/learning-courses", "/student/learning"],
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

function normalizeCode(value) {
  if (typeof value === "string") return value.trim().toUpperCase();
  if (!value || typeof value !== "object") return "";

  return String(
    value.code ??
      value.role_code ??
      value.roleCode ??
      value.name ??
      value.role_name ??
      ""
  )
    .trim()
    .toUpperCase();
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
    .map((segment) =>
      segment.startsWith(":")
        ? "[^/]+"
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
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

function isEnabled(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    (typeof value === "string" && value.trim().toLowerCase() === "true")
  );
}

function getRouteMenu(menus, pathname) {
  const currentPath = normalizePath(pathname);
  const candidates = flattenMenus(menus).flatMap((menu) => {
    const menuPath = normalizePath(
      menu?.path ?? menu?.routePath ?? menu?.route_path
    );

    if (!menuPath) return [];

    return [
      {
        menu,
        path: menuPath,
        exact: menuPath === currentPath,
      },
      ...(ROUTE_ALIASES[menuPath] || []).map((alias) => ({
        menu,
        path: normalizePath(alias),
        exact: normalizePath(alias) === currentPath,
      })),
    ];
  });

  const prefix = candidates
    .filter(({ path }) => matchesRoutePath(path, currentPath))
    .sort((left, right) => right.path.length - left.path.length);

  return prefix[0]?.menu ?? null;
}

export function MenuAccessProvider({ children }) {
  const location = useLocation();
  const [access, setAccess] = useState({
    loading: true,
    roles: [],
    menus: [],
  });

  useEffect(() => {
    let cancelled = false;

    getMyAccess()
      .then((response) => {
        const value = unwrapAccess(response);
        if (!cancelled) {
          setAccess({
            loading: false,
            roles: Array.isArray(value.roles)
              ? value.roles.map(normalizeCode).filter(Boolean)
              : [],
            menus: Array.isArray(value.menus) ? value.menus : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccess({ loading: false, roles: [], menus: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentMenu = getRouteMenu(access.menus, location.pathname);
  const canView = isEnabled(
    currentMenu?.can_view ?? currentMenu?.canView
  );
  const canCreate = isEnabled(
    currentMenu?.can_create ??
      currentMenu?.canCreate ??
      currentMenu?.can_add ??
      currentMenu?.canAdd
  );
  const isAdmin = access.roles.includes("ADMIN");

  useLayoutEffect(() => {
    publishPageAccess(location.pathname, {
      loading: access.loading,
      matched: Boolean(currentMenu),
      isAdmin,
      canView,
      canCreate,
    });
  }, [
    location.pathname,
    access.loading,
    currentMenu,
    isAdmin,
    canView,
    canCreate,
  ]);

  const value = useMemo(() => access, [access]);

  return (
    <MenuAccessContext.Provider value={value}>
      {children}
    </MenuAccessContext.Provider>
  );
}

export function useRouteMenuPermissions(pathname) {
  const access = useContext(MenuAccessContext);
  const menu = getRouteMenu(access.menus, pathname);

  const canView = isEnabled(menu?.can_view ?? menu?.canView);
  const canCreate = isEnabled(
    menu?.can_create ?? menu?.canCreate ?? menu?.can_add ?? menu?.canAdd
  );
  const isAdmin = access.roles.includes("ADMIN");

  return {
    loading: access.loading,
    matched: Boolean(menu),
    isAdmin,
    canView,
    canCreate,
    canUpdate: isEnabled(
      menu?.can_update ?? menu?.canUpdate ?? menu?.can_edit ?? menu?.canEdit
    ),
    canDelete: isEnabled(menu?.can_delete ?? menu?.canDelete),
    canApprove: isEnabled(menu?.can_approve ?? menu?.canApprove),
    canPublish: isEnabled(menu?.can_publish ?? menu?.canPublish),
  };
}
