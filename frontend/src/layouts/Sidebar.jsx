import { useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  FolderOpen,
  Users,
  ClipboardList,
  ClipboardCheck,
  MessageSquare,
  MessagesSquare,
  CreditCard,
  Bell,
  Settings,
  FileText,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Building2,
  Database,
  UserRound,
  ListVideo,
  PlusCircle,
  CircleHelp,
  CheckCircle,
  Library,
  Bookmark,
  ListChecks,
  ListOrdered,
  NotebookPen,
  ChartColumn,
  Flag,
  MessageCircle,
  Wallet,
  Receipt,
  KeyRound,
  ListTree,
  TicketPercent,
  BookUser,
  Clock,
  List,
  LogOut,
  Menu,
  PanelLeftClose,
} from "lucide-react";

import { getMyAccess, logoutUser } from "../service/Authapi";
import LearnovaLogoMark from "../component/LearnovaLogoMark";
import { getPendingUsers } from "../service/UserApi";
import courseApi from "../service/courseApi";
import { getAuthUser, clearAuthUser } from "../utils/authCookie";
import "./sidebar.scss";

const ICONS = {
  "layout-dashboard": LayoutDashboard,
  dashboard: LayoutDashboard,
  "book-open": BookOpen,
  courses: BookOpen,
  learning: BookOpen,
  folders: FolderOpen,
  folder: FolderOpen,
  "folder-open": FolderOpen,
  categories: FolderOpen,
  users: Users,
  "users-round": Users,
  enrollment: GraduationCap,
  enrollments: Users,
  "clipboard-list": ClipboardList,
  "clipboard-check": ClipboardCheck,
  "list-check": ListChecks,
  "list-ordered": ListOrdered,
  assessment: ClipboardCheck,
  assessments: ClipboardCheck,
  "messages-square": MessagesSquare,
  messages: MessageSquare,
  community: MessagesSquare,
  "message-circle": MessageCircle,
  "credit-card": CreditCard,
  payment: CreditCard,
  payments: CreditCard,
  bell: Bell,
  notifications: Bell,
  settings: Settings,
  "file-text": FileText,
  reports: ChartColumn,
  "chart-column": ChartColumn,
  "graduation-cap": GraduationCap,
  "check-circle": CheckCircle,
  library: Library,
  "book-marked": Bookmark,
  bookmark: Bookmark,
  "user-round": UserRound,
  profile: UserRound,
  curriculum: ListVideo,
  create: PlusCircle,
  "plus-circle": PlusCircle,
  shield: ShieldCheck,
  "shield-check": ShieldCheck,
  "key-round": KeyRound,
  "list-tree": ListTree,
  database: Database,
  master: Database,
  "building-2": Building2,
  "book-user": BookUser,
  "ticket-percent": TicketPercent,
  flag: Flag,
  wallet: Wallet,
  receipt: Receipt,
  clock: Clock,
  list: List,
  "notebook-pen": NotebookPen,
  notebook: NotebookPen,
  "circle-help": CircleHelp,
};

const ACTION_FIELDS = [
  "can_view",
  "canView",
  "can_read",
  "canRead",
  "can_add",
  "canAdd",
  "can_create",
  "canCreate",
  "can_edit",
  "canEdit",
  "can_update",
  "canUpdate",
  "can_delete",
  "canDelete",
  "can_approve",
  "canApprove",
  "can_publish",
  "canPublish",
];

const ROLE_HOME = {
  ADMIN: "/admin/dashboard",
  INSTRUCTOR: "/instructor/dashboard",
  STUDENT: "/student/dashboard",
};

const MENU_LABEL_OVERRIDES = {
  SYSTEM_SETTINGS: "User Management",
  USER_MANAGEMENT: "Users",
  COURSE_REPORTS: "Payroll Reports",
  PAYROLL_REPORT: "Payroll Reports",
};

const MENU_PATH_OVERRIDES = {
  COURSE_REPORTS: "/admin/reports/payroll",
};

const ROLE_ROUTE_ALIASES = {
  ADMIN: {
    DASHBOARD: "/admin/dashboard",
    USER_MANAGEMENT: "/admin/users",
    USERS: "/admin/users",
    ADMIN_USERS: "/admin/users",
    COURSE_MANAGEMENT: "/admin/courses",
    COURSES: "/admin/courses",
    ADMIN_COURSES: "/admin/courses",
    COURSE_CATEGORIES: "/admin/course-categories",
    COURSE_CATEGORY: "/admin/course-categories",
    ROLE_MANAGEMENT: "/admin/settings/roles",
    ROLES: "/admin/settings/roles",
    PERMISSION_MANAGEMENT: "/admin/settings/permissions",
    PERMISSIONS: "/admin/settings/permissions",
    ROLE_MENU_PRIVILEGES: "/admin/settings/role-menu-privileges",
    ROLE_MENU_PRIVILEGE: "/admin/settings/role-menu-privileges",
    MENU_PRIVILEGES: "/admin/settings/role-menu-privileges",
    COUPONS: "/admin/master-data/coupons",
    COUPON_MANAGEMENT: "/admin/master-data/coupons",
    INSTITUTIONS: "/admin/master-data/institutions",
    INSTITUTION_MANAGEMENT: "/admin/master-data/institutions",
    PAYROLL_REPORT: "/admin/reports/payroll",
    PAYROLL_REPORTS: "/admin/payroll/reports",
    REFERRAL_MASTER: "/admin/payroll/referral-master",
    PAYMENT_REPORTS: "/admin/reports/payments",
    USER_REPORTS: "/admin/reports/users",
    ENROLLMENT_REPORTS: "/admin/reports/enrollments",
    COMMUNITY_REPORTS: "/admin/community/reports",
    REPORTED_DISCUSSIONS: "/admin/community/reports",
    REPORTED_DISCUSSION: "/admin/community/reports",
  },
  INSTRUCTOR: {
    COURSE_LIST: "/instructor/all-courses",
    COURSE_CATEGORIES: "/instructor/course-categories",
    INSTRUCTOR_MY_COURSES: "/instructor/courses",
    INSTRUCTOR_CREATE_COURSE: "/instructor/courses/create",
    PROFILE: "/instructor/profile",
    ASSESSMENT: "/instructor/assessments",
    ASSESSMENTS: "/instructor/assessments",
    INSTRUCTOR_ASSESSMENT: "/instructor/assessments",
    INSTRUCTOR_ASSESSMENTS: "/instructor/assessments",
    QUIZ: "/instructor/assessments",
    QUIZZES: "/instructor/assessments",
    EXAMS: "/assessments/exams",
    QUESTIONS: "/assessments/questions",
    ASSESSMENT_RESULTS: "/instructor/assessment-results",
    RESULTS: "/instructor/assessment-results",
    MY_RESULTS: "/instructor/assessment-results",
    MY_RESULT: "/instructor/assessment-results",
    ENROLLMENT_REPORT: "/instructor/reports/enrollments",
    ENROLLMENT_REPORTS: "/instructor/reports/enrollments",
    ALL_ENROLLMENTS: "/instructor/enrollments",
    INSTRUCTOR_MY_STUDENTS: "/instructor/students",
    MY_STUDENTS: "/instructor/students",
  },
  STUDENT: {
    STUDENT_MY_COURSES: "/student/my-learning",
    STUDENT_LEARNING_COURSES: "/student/learning-courses",
    STUDENT_COMPLETED_COURSES: "/student/completed-courses",
  },
};

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeId(value) {
  return value === null || value === undefined ? "" : String(value);
}

function isEnabled(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    (typeof value === "string" &&
      value.trim().toLowerCase() === "true")
  );
}

function unwrapResponse(response) {
  let value = response?.data ?? response;

  while (
    value &&
    !Array.isArray(value) &&
    typeof value === "object" &&
    value.data !== undefined
  ) {
    value = value.data;
  }

  return value;
}

function getMenuRows(access) {
  if (Array.isArray(access)) return access;

  const candidates = [
    access?.menus,
    access?.menuTree,
    access?.menu_tree,
    access?.data?.menus,
    access?.data?.menuTree,
    access?.data?.menu_tree,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function getPermissions(access) {
  const candidates = [
    access?.permissions,
    access?.effectivePermissions,
    access?.effective_permissions,
    access?.data?.permissions,
    access?.data?.effectivePermissions,
    access?.data?.effective_permissions,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function getPermissionCode(permission) {
  if (typeof permission === "string") {
    return normalizeCode(permission);
  }

  return normalizeCode(
    permission?.code ??
      permission?.permission_code ??
      permission?.permissionCode
  );
}

function getPermissionId(permission) {
  if (!permission || typeof permission !== "object") return "";

  return normalizeId(
    permission.id ??
      permission.permission_id ??
      permission.permissionId
  );
}

function getPermissionSet(permissions) {
  return new Set(
    permissions.map(getPermissionCode).filter(Boolean)
  );
}

function getPermissionIdSet(permissions) {
  return new Set(
    permissions.map(getPermissionId).filter(Boolean)
  );
}

function normalizePath(rawPath) {
  if (typeof rawPath !== "string") return null;

  const path = rawPath.trim();

  if (!path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  return path;
}

function normalizeMenu(row) {
  const rawIcon =
    row?.icon ?? row?.icon_name ?? row?.iconName ?? "";

  const item = {
    ...row,
    id: normalizeId(row?.id),
    parent_id: normalizeId(
      row?.parent_id ?? row?.parentId
    ),
    code: normalizeCode(
      row?.code ?? row?.menu_code ?? row?.menuCode
    ),
    label: String(
      row?.name ?? row?.label ?? row?.title ?? "Unnamed menu"
    ).trim(),
    path: normalizePath(
      row?.route_path ??
        row?.routePath ??
        row?.path ??
        row?.url
    ),
    icon: String(rawIcon).trim().toLowerCase(),
    permission_id: normalizeId(
      row?.permission_id ??
        row?.permissionId ??
        row?.permission?.id
    ),
    permission_code: normalizeCode(
      row?.permission_code ??
        row?.permissionCode ??
        row?.permission?.code
    ),
    hasAnyPermission: isEnabled(
      row?.hasAnyPermission ?? row?.has_any_permission
    ),
    sort_order: Number(
      row?.sort_order ?? row?.sortOrder ?? 0
    ),
    children: Array.isArray(row?.children)
      ? row.children.map(normalizeMenu)
      : [],
  };

  ACTION_FIELDS.forEach((field) => {
    if (
      Object.prototype.hasOwnProperty.call(row ?? {}, field)
    ) {
      item[field] = isEnabled(row[field]);
    }
  });

  return item;
}

function sortMenuTree(items) {
  return [...items]
    .sort(
      (a, b) =>
        (a.sort_order || 0) - (b.sort_order || 0) ||
        a.label.localeCompare(b.label)
    )
    .map((item) => ({
      ...item,
      children: sortMenuTree(item.children || []),
    }));
}

function buildMenuTree(rows) {
  if (!Array.isArray(rows)) return [];

  const items = rows.map(normalizeMenu);

  if (items.some((item) => item.children.length > 0)) {
    return sortMenuTree(items);
  }

  const byId = new Map();

  items.forEach((item) => {
    if (item.id) byId.set(item.id, item);
  });

  const roots = [];

  items.forEach((item) => {
    const parent = item.parent_id
      ? byId.get(item.parent_id)
      : null;

    if (parent && parent.id !== item.id) {
      parent.children.push(item);
    } else {
      roots.push(item);
    }
  });

  return sortMenuTree(roots);
}

function hasActionFlags(item) {
  return ACTION_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(item, field)
  );
}

function hasGrantedAction(item) {
  return ACTION_FIELDS.some((field) =>
    isEnabled(item[field])
  );
}

function hasOwnMenuPermission(item) {
  return item?.hasAnyPermission === true || hasGrantedAction(item);
}

function hasDirectPermission(
  item,
  permissionCodes,
  permissionIds
) {
  const permissionCode = normalizeCode(
    item.permission_code ??
      item.permissionCode ??
      item.permission?.code
  );

  const permissionId = normalizeId(
    item.permission_id ??
      item.permissionId ??
      item.permission?.id
  );

  const menuCode = normalizeCode(
    item.code ?? item.menu_code ?? item.menuCode
  );

  return Boolean(
    (permissionCode &&
      permissionCodes.has(permissionCode)) ||
      (permissionId && permissionIds.has(permissionId)) ||
      (menuCode && permissionCodes.has(menuCode))
  );
}

function filterMenuTree(
  items,
  permissionCodes,
  permissionIds,
  canCheckPermissionList
) {
  return items
    .map((item) => {
      const children = filterMenuTree(
        item.children || [],
        permissionCodes,
        permissionIds,
        canCheckPermissionList
      );

      let allowed = true;

      if (hasActionFlags(item)) {
        allowed = hasOwnMenuPermission(item);
      } else {
        const hasPermissionReference = Boolean(
          item.permission_id || item.permission_code
        );

        if (
          hasPermissionReference &&
          canCheckPermissionList
        ) {
          allowed = hasDirectPermission(
            item,
            permissionCodes,
            permissionIds
          );
        }
      }

      if (!allowed && children.length === 0) return null;
      if (!item.path && children.length === 0) return null;

      return { ...item, children };
    })
    .filter(Boolean);
}

function getUserFromStorage() {
  return getAuthUser();
}

function getDisplayName(user, suppliedName) {
  if (suppliedName && String(suppliedName).trim()) {
    return String(suppliedName).trim();
  }

  const first = user?.firstName ?? user?.first_name ?? "";
  const last = user?.lastName ?? user?.last_name ?? "";
  const fullName = `${first} ${last}`.trim();

  return (
    fullName ||
    user?.name ||
    user?.username ||
    user?.email ||
    "User"
  );
}

function normalizeRole(value) {
  if (typeof value === "string") {
    return normalizeCode(value);
  }

  if (!value || typeof value !== "object") return "";

  return normalizeCode(
    value.code ??
      value.role_code ??
      value.roleCode ??
      value.name ??
      value.role_name
  );
}

function getRoleCandidates(source) {
  const raw =
    source?.roles ??
    source?.user?.roles ??
    source?.data?.roles;

  if (Array.isArray(raw)) {
    return raw.map(normalizeRole).filter(Boolean);
  }

  const single =
    source?.role ??
    source?.user?.role ??
    source?.role_code ??
    source?.role_name;

  const normalized = normalizeRole(single);

  return normalized ? [normalized] : [];
}

function getRole(access, user) {
  const roles = [
    ...getRoleCandidates(access),
    ...getRoleCandidates(user),
  ];

  return (
    roles.find((role) =>
      ["ADMIN", "INSTRUCTOR", "STUDENT"].includes(role)
    ) ||
    roles[0] ||
    ""
  );
}

function getInitials(name) {
  return (
    String(name ?? "User")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "U"
  );
}

function isPathActive(pathname, path) {
  return Boolean(
    path &&
      (pathname === path ||
        pathname.startsWith(`${path}/`))
  );
}

function hasActiveDescendant(nodes, pathname) {
  return nodes.some(
    (node) =>
      isPathActive(pathname, node.path) ||
      hasActiveDescendant(node.children || [], pathname)
  );
}

/*
 * Instructor sidebar filter:
 * Hide selected course menus only for INSTRUCTOR.
 */
const INSTRUCTOR_HIDDEN_MENU_CODES = new Set([
  "INSTRUCTOR_CREATE_COURSE",
  "NOTES",
  "INSTRUCTOR_NOTES",
  "STUDENT_MY_COURSES",
  "STUDENT_LEARNING_COURSES",
  "STUDENT_COMPLETED_COURSES",
]);

const INSTRUCTOR_HIDDEN_MENU_LABELS = new Set([
  "CREATE COURSE",
  "NOTES",
  "LEARNING COURSES",
  "COMPLETED COURSES",
]);

function hideInstructorCourseMenus(items, role) {
  if (role !== "INSTRUCTOR") return items;

  return items
    .filter((item) => {
      const code = normalizeCode(
        item.code ?? item.menu_code ?? item.menuCode
      );

      const label = String(
        item.label ?? item.name ?? ""
      )
        .trim()
        .toUpperCase();

      const path =
        normalizePath(
          item.path ?? item.route_path ?? item.routePath
        ) || "";

      const shouldHide =
        INSTRUCTOR_HIDDEN_MENU_CODES.has(code) ||
        INSTRUCTOR_HIDDEN_MENU_LABELS.has(label) ||
        path === "/instructor/notes" ||
        path === "/instructor/courses/create" ||
        path === "/student/learning-courses" ||
        path === "/student/completed-courses";

      return !shouldHide;
    })
    .map((item) => ({
      ...item,
      children: hideInstructorCourseMenus(
        item.children || [],
        role
      ),
    }));
}

/*
 * Admin Learning Management filter:
 * Keep only All Courses and Course Categories inside
 * the Learning Management section.
 *
 * Other admin sections and all non-admin roles are unchanged.
 */
const ADMIN_ALLOWED_LEARNING_MENU_CODES = new Set([
  "COURSE_LIST",
  "COURSE_CATEGORIES",
  "ALL_COURSES",
]);

const ADMIN_ALLOWED_LEARNING_MENU_LABELS = new Set([
  "ALL COURSES",
  "COURSE CATEGORIES",
]);

const ADMIN_ALLOWED_LEARNING_MENU_PATHS = new Set([
  "/instructor/all-courses",
  "/instructor/course-categories",
  "/admin/all-courses",
  "/admin/course-categories",
]);

function isLearningManagementMenu(item) {
  const code = normalizeCode(
    item.code ?? item.menu_code ?? item.menuCode
  );

  const label = String(
    item.label ?? item.name ?? ""
  )
    .trim()
    .toUpperCase();

  return (
    code === "LEARNING_MANAGEMENT" ||
    code === "LEARNING-MANAGEMENT" ||
    code === "LEARNING MANAGEMENT" ||
    label === "LEARNING MANAGEMENT"
  );
}

function isAllowedAdminLearningMenu(item) {
  const code = normalizeCode(
    item.code ?? item.menu_code ?? item.menuCode
  );

  const label = String(
    item.label ?? item.name ?? ""
  )
    .trim()
    .toUpperCase();

  const path =
    normalizePath(
      item.path ?? item.route_path ?? item.routePath
    ) || "";

  return (
    ADMIN_ALLOWED_LEARNING_MENU_CODES.has(code) ||
    ADMIN_ALLOWED_LEARNING_MENU_LABELS.has(label) ||
    ADMIN_ALLOWED_LEARNING_MENU_PATHS.has(path)
  );
}

function filterAdminLearningMenus(items, role) {
  if (role !== "ADMIN") return items;

  return items
    .map((item) => {
      const children = item.children || [];

      if (isLearningManagementMenu(item)) {
        return {
          ...item,
          children: children.filter(isAllowedAdminLearningMenu),
        };
      }

      return {
        ...item,
        children: filterAdminLearningMenus(
          children,
          role
        ),
      };
    })
    .filter((item) => {
      if (isLearningManagementMenu(item)) {
        return item.children.length > 0;
      }

      return true;
    });
}

/*
 * Admin sidebar filter:
 * Hide the instructor-only menus listed below for ADMIN accounts.
 */
const ADMIN_HIDDEN_MENU_CODES = new Set([
  "INSTRUCTOR_MY_STUDENTS",
  "ASSESSMENT",
  "NOTES",
  "INSTRUCTOR_COURSE_ASSIGNMENTS",
  "MASTER_INSTRUCTOR_COURSES",
]);

const ADMIN_HIDDEN_MENU_LABELS = new Set([
  "MY STUDENTS",
  "ASSESSMENT",
  "NOTES",
  "INSTRUCTOR COURSE MAPPING",
]);

const ADMIN_HIDDEN_MENU_PATHS = new Set([
  "/instructor/students",
  "/assessments",
  "/admin/notes",
  "/admin/instructor-course-assignments",
  "/admin/master-data/instructor-courses",
]);

function hideAdminMenus(items, role) {
  if (role !== "ADMIN") return items;

  return items
    .filter((item) => {
      const code = normalizeCode(
        item.code ?? item.menu_code ?? item.menuCode
      );

      const label = String(
        item.label ?? item.name ?? ""
      )
        .trim()
        .toUpperCase();

      const path =
        normalizePath(
          item.path ?? item.route_path ?? item.routePath
        ) || "";

      const shouldHide = (
        ADMIN_HIDDEN_MENU_CODES.has(code) ||
        ADMIN_HIDDEN_MENU_LABELS.has(label) ||
        ADMIN_HIDDEN_MENU_PATHS.has(path)
      );

      return !shouldHide;
    })
    .map((item) => ({
      ...item,
      children: hideAdminMenus(
        item.children || [],
        role
      ),
    }));
}

function resolveMenuPath(item, role) {
  const code = normalizeCode(
    item.code ?? item.menu_code ?? item.menuCode
  );

  if (code === "DASHBOARD") {
    return ROLE_HOME[role] || item.path || "/";
  }

  const menuLabel = String(item.label ?? item.name ?? "").trim().toUpperCase();

  // A stale route_path from the access-menu API must not send this submenu
  // back to the dashboard. The visible destination is the enrollments report.
  if (
    role === "INSTRUCTOR" &&
    (code === "ALL_ENROLLMENTS" || menuLabel.includes("ALL ENROLLMENTS"))
  ) {
    return "/instructor/enrollments";
  }

  const configuredPath =
    MENU_PATH_OVERRIDES[code] ||
    ROLE_ROUTE_ALIASES[role]?.[code] ||
    item.path;

  if (configuredPath) return configuredPath;

  if (code.includes("NOTIFICATION") || menuLabel.includes("NOTIFICATION")) {
    return "/community/notifications";
  }

  if (
    role === "INSTRUCTOR" &&
    (code.includes("MY_STUDENTS") || menuLabel.includes("MY STUDENTS"))
  ) {
    return "/instructor/students";
  }

  if (
    role === "INSTRUCTOR" &&
    menuLabel.includes("ENROLLMENT") &&
    menuLabel.includes("REPORT")
  ) {
    return "/instructor/reports/enrollments";
  }

  if (role === "ADMIN") {
    const label = menuLabel;
    if (label.includes("USER")) return "/admin/users";
    if (label.includes("COURSE") && label.includes("CATEGORY")) return "/admin/course-categories";
    if (label.includes("COURSE")) return "/admin/courses";
    if (label.includes("ROLE") && (label.includes("PRIVILEGE") || label.includes("MENU"))) return "/admin/settings/role-menu-privileges";
    if (label.includes("ROLE")) return "/admin/settings/roles";
    if (label.includes("PERMISSION")) return "/admin/settings/permissions";
    if (label.includes("COUPON")) return "/admin/master-data/coupons";
    if (label.includes("INSTITUTION")) return "/admin/master-data/institutions";
  }


  return undefined;

  // return (
  //   MENU_PATH_OVERRIDES[code] ||
  //   ROLE_ROUTE_ALIASES[role]?.[code] ||
  //   item.path
  // );
}

function getMenuLabel(item) {
  const code = normalizeCode(
    item.code ?? item.menu_code ?? item.menuCode
  );

  return MENU_LABEL_OVERRIDES[code] || item.label;
}

function MenuItem({ item, role, level = 0, collapsed = false, onNavigate, pendingApprovals }) {
  const location = useLocation();
  const children = item.children || [];
  const hasChildren = children.length > 0;
  const path = resolveMenuPath(item, role);
  const label = getMenuLabel(item);
  const Icon = ICONS[item.icon] || CircleHelp;
  const menuCode = normalizeCode(item.code ?? item.menu_code ?? item.menuCode);
  const isUsersMenu = menuCode === "USER_MANAGEMENT" ||
    String(label || "").trim().toUpperCase() === "USERS" ||
    (!hasChildren && path === "/admin/users");
  const pendingCount = role === "ADMIN"
    ? isUsersMenu
      ? pendingApprovals?.users || 0
      : !hasChildren && path?.startsWith("/admin/courses")
        ? pendingApprovals?.courses || 0
        : 0
    : 0;

  const childRouteActive = hasActiveDescendant(
    children,
    location.pathname
  );

  const [expanded, setExpanded] = useState(
    () => childRouteActive
  );

  useEffect(() => {
    if (!childRouteActive) return undefined;
    const timer = window.setTimeout(() => {
      if (childRouteActive) setExpanded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [childRouteActive]);

  if (!path && !hasChildren) return null;

  return (
    <div
      className={`olp-sidebar-group${
        level > 0 ? " is-nested" : ""
      }`}
    >
      {hasChildren ? (
        <button
          type="button"
          title={collapsed ? label : undefined}
          aria-label={label}
          className={`olp-sidebar-menu-button${
            level > 0 ? " olp-sidebar-submenu-button" : ""
          }${childRouteActive ? " selected" : ""}`}
          onClick={() =>
            setExpanded((current) => !current)
          }
          aria-expanded={expanded}
        >
          <Icon
            size={level === 0 ? 18 : 16}
            strokeWidth={1.8}
            aria-hidden="true"
          />

          <span>{label}</span>
          {pendingCount > 0 && (
            <span className="olp-sidebar-pending-badge" aria-label={`${pendingCount} pending approvals`}>
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}

          <span className="olp-sidebar-menu-chevron">
            {expanded ? (
              <ChevronDown size={16} aria-hidden="true" />
            ) : (
              <ChevronRight size={16} aria-hidden="true" />
            )}
          </span>
        </button>
      ) : (
        <NavLink
          to={path || "/"}
          end={false}
          title={collapsed ? label : undefined}
          aria-label={label}
          onClick={onNavigate}
          className={({ isActive }) =>
            `olp-sidebar-link${
              level > 0 ? " olp-sidebar-submenu-link" : ""
            }${
              isActive ||
              isPathActive(location.pathname, path)
                ? " active"
                : ""
            }`
          }
        >
          <Icon
            size={level === 0 ? 18 : 16}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span>{label}</span>
          {pendingCount > 0 && (
            <span className="olp-sidebar-pending-badge" aria-label={`${pendingCount} pending approvals`}>
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </NavLink>
      )}

      {hasChildren && expanded && (
        <div className="olp-sidebar-submenu">
          {children.map((child, index) => (
            <MenuItem
              key={
                child.id ||
                child.path ||
                `${child.label}-${index}`
              }
              item={child}
              role={role}
              level={level + 1}
              collapsed={collapsed}
              onNavigate={onNavigate}
              pendingApprovals={pendingApprovals}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  userName,
  collapsed = false,
  pinnedCollapsed = false,
  hoverExpanded = false,
  onToggle,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
}) {
  const navigate = useNavigate();
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [user, setUser] = useState(getUserFromStorage);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState({ users: 0, courses: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await getMyAccess();
        const data = unwrapResponse(response);

        if (!data || data.success === false) {
          throw new Error(
            data?.message || "Unable to load account access."
          );
        }

        if (cancelled) return;

        setAccess(data);
        setUser(getUserFromStorage());
      } catch (error) {
        if (cancelled) return;

        console.error(
          "Unable to load sidebar access:",
          error
        );

        setAccess(null);

        setErrorMessage(
          error?.response?.data?.message ||
            error?.message ||
            "Unable to load the navigation menu."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  const role = getRole(access, user);
  const displayName = getDisplayName(user, userName);
  const canLogout = role === "ADMIN" || role === "INSTRUCTOR";

  useEffect(() => {
    let cancelled = false;

    if (role !== "ADMIN") {
      setPendingApprovals({ users: 0, courses: 0 });
      return undefined;
    }

    const refreshPendingApprovals = async () => {
      const [usersResult, coursesResult] = await Promise.allSettled([
        getPendingUsers(),
        courseApi.getPendingCourses(),
      ]);
      if (cancelled) return;
      setPendingApprovals({
        users: usersResult.status === "fulfilled" && Array.isArray(usersResult.value)
          ? usersResult.value.length
          : 0,
        courses: coursesResult.status === "fulfilled" && Array.isArray(coursesResult.value)
          ? coursesResult.value.length
          : 0,
      });
    };

    refreshPendingApprovals();
    window.addEventListener("admin-pending-approvals-changed", refreshPendingApprovals);
    window.addEventListener("focus", refreshPendingApprovals);
    const refreshTimer = window.setInterval(refreshPendingApprovals, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("admin-pending-approvals-changed", refreshPendingApprovals);
      window.removeEventListener("focus", refreshPendingApprovals);
      window.clearInterval(refreshTimer);
    };
  }, [role]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      // The refresh token is read from its HttpOnly cookie.
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearAuthUser();

      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  }

  const menus = useMemo(() => {
    const rows = getMenuRows(access);
    const permissions = getPermissions(access);
    const permissionCodes = getPermissionSet(permissions);
    const permissionIds = getPermissionIdSet(permissions);
    const tree = buildMenuTree(rows);

    const permittedMenus = filterMenuTree(
      tree,
      permissionCodes,
      permissionIds,
      permissions.length > 0
    );

    const instructorFilteredMenus =
      hideInstructorCourseMenus(permittedMenus, role);

    const adminLearningFilteredMenus =
      filterAdminLearningMenus(
        instructorFilteredMenus,
        role
      );

    return hideAdminMenus(
      adminLearningFilteredMenus,
      role
    );
  }, [access, role]);

  const homePath = ROLE_HOME[role] || "/";

  return (
    <aside
      className={`olp-sidebar${collapsed ? " is-collapsed" : ""}${
        hoverExpanded ? " is-hover-expanded" : ""
      }`}
      aria-label="Application sidebar"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="olp-sidebar-header">
        <Link
          to={homePath}
          className="olp-sidebar-brand"
          aria-label="OLP home"
          title={collapsed ? "OLP home" : undefined}
          onClick={onNavigate}
        >
          <LearnovaLogoMark className="olp-brand-mark" size="large" />

          <span className="olp-brand-copy">
            <strong>OLP</strong>
            <small>Learning Platform</small>
          </span>
        </Link>

        <button
          type="button"
          className="olp-sidebar-toggle"
          onClick={onToggle}
          aria-label={
            pinnedCollapsed
              ? hoverExpanded
                ? "Keep sidebar expanded"
                : "Expand sidebar"
              : "Collapse sidebar"
          }
          title={
            pinnedCollapsed
              ? hoverExpanded
                ? "Keep sidebar expanded"
                : "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          {pinnedCollapsed ? (
            <Menu size={19} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={18} aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="olp-sidebar-user">
        <div
          className="olp-sidebar-avatar"
          aria-hidden="true"
        >
          {getInitials(displayName)}
        </div>

        <div className="olp-sidebar-user-details">
          <strong title={displayName}>
            {displayName}
          </strong>
          <span>{role || "MEMBER"}</span>
        </div>
      </div>

      <nav
        className="olp-sidebar-navigation"
        aria-label="Main navigation"
      >
        {loading ? (
          <p
            className="olp-sidebar-message"
            role="status"
          >
            Loading menu…
          </p>
        ) : errorMessage ? (
          <p
            className="olp-sidebar-message"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : menus.length > 0 ? (
          menus.map((item, index) => (
            <MenuItem
              key={
                item.id ||
                item.path ||
                `${item.label}-${index}`
              }
              item={item}
              role={role}
              collapsed={collapsed}
              onNavigate={onNavigate}
              pendingApprovals={pendingApprovals}
            />
          ))
        ) : (
          <p className="olp-sidebar-message">
            No menu items are assigned to this account.
          </p>
        )}
      </nav>

      <footer className="olp-sidebar-footer">
        {canLogout && (
          <button
            type="button"
            className="olp-sidebar-logout"
            onClick={handleLogout}
            disabled={loggingOut}
            title={collapsed ? "Logout" : undefined}
            aria-label={loggingOut ? "Signing out" : "Logout"}
          >
            <LogOut size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{loggingOut ? "Signing out..." : "Logout"}</span>
          </button>
        )}

        <div className="olp-sidebar-footer-meta">
          <span
            className="olp-footer-dot"
            aria-hidden="true"
          />
          <span>Online Learning Platform</span>
        </div>
      </footer>
    </aside>
  );
}
