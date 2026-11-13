import { useEffect, useState } from "react";
    
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { MenuAccessProvider } from "./MenuAccessContext";
import { getAuthUser } from "../utils/authCookie";
import "./applayout.scss";

function normalizeRole(role) {
    if (typeof role === "string") return role.trim().toUpperCase();
    if (!role || typeof role !== "object") return "";
    return String(
        role.code ?? role.name ?? role.role_code ?? role.role_name ?? role.roleName ?? ""
    )
        .trim()
        .toUpperCase();
}

export default function AppLayout() {
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return window.localStorage.getItem("olp_sidebar_collapsed") === "true";
        } catch {
            return false;
        }
    });
    const [sidebarHoverExpanded, setSidebarHoverExpanded] = useState(false);
    const user = getAuthUser();
    const roles = [
        ...(Array.isArray(user?.roles) ? user.roles : []),
        ...(Array.isArray(user?.user?.roles) ? user.user.roles : []),
        user?.role,
        user?.role_code,
        user?.role_name,
        user?.user?.role,
        user?.user?.role_code,
        user?.user?.role_name,
    ].map(normalizeRole);

    const isStudentDashboard =
        location.pathname === "/student/dashboard";
    const isStudentCommunity =
        location.pathname.startsWith("/community") && roles.includes("STUDENT");
    const isStudent = roles.includes("STUDENT");
    const hideSidebar = isStudentDashboard || isStudentCommunity;

    function updateSidebarCollapsed(nextValue) {
        setSidebarCollapsed(nextValue);
        try {
            window.localStorage.setItem("olp_sidebar_collapsed", String(nextValue));
        } catch {
            // The sidebar remains usable when browser storage is unavailable.
        }
    }

    function handleSidebarToggle() {
        const isHoverPreview = sidebarCollapsed && sidebarHoverExpanded;
        updateSidebarCollapsed(isHoverPreview ? false : !sidebarCollapsed);
        setSidebarHoverExpanded(false);
    }

    function handleSidebarNavigate() {
        updateSidebarCollapsed(true);
        setSidebarHoverExpanded(false);
    }
    useEffect(() => {
        if (!isStudentCommunity) return undefined;

        const html = document.documentElement;
        const body = document.body;
        const previousHtmlOverflowY = html.style.overflowY;
        const previousBodyOverflowY = body.style.overflowY;
        const previousHtmlScrollbarGutter = html.style.scrollbarGutter;

        // Student community pages use the workspace scroll container.
        html.style.overflowY = "hidden";
        body.style.overflowY = "hidden";
        html.style.scrollbarGutter = "auto";

        return () => {
            html.style.overflowY = previousHtmlOverflowY;
            body.style.overflowY = previousBodyOverflowY;
            html.style.scrollbarGutter = previousHtmlScrollbarGutter;
        };
    }, [isStudentCommunity]);

    return (
        <MenuAccessProvider>
        <div
            className={`olp-app-layout ${
                hideSidebar
                    ? "olp-student-layout"
                    : ""
            }${sidebarCollapsed && !hideSidebar ? " olp-sidebar-collapsed" : ""}`}
        >
            {!hideSidebar && (
                <Sidebar
                    collapsed={sidebarCollapsed && !sidebarHoverExpanded}
                    pinnedCollapsed={sidebarCollapsed}
                    hoverExpanded={sidebarHoverExpanded}
                    onToggle={handleSidebarToggle}
                    onNavigate={handleSidebarNavigate}
                    onMouseEnter={() => {
                        if (sidebarCollapsed) setSidebarHoverExpanded(true);
                    }}
                    onMouseLeave={() => setSidebarHoverExpanded(false)}
                />
            )}

            <div className="olp-main-area">
                <main
                    className={`olp-page-content ${isStudent ? "olp-student-page-content" : ""}`}
                >
                    <Outlet />
                </main>
            </div>
        </div>
        </MenuAccessProvider>
    );
}
