import { NavLink } from "react-router-dom";
import { Bell, BookOpen, ClipboardCheck, GraduationCap, LayoutDashboard, Wallet } from "lucide-react";

const sections = [
  { label: "Overview", to: "/instructor/dashboard", icon: LayoutDashboard, match: (path) => path === "/instructor/dashboard" },
  { label: "Learning management", to: "/instructor/courses", icon: BookOpen, match: (path) => path.startsWith("/instructor/courses") || path.startsWith("/instructor/all-courses") || path.startsWith("/instructor/course-categories") },
  { label: "Students", to: "/instructor/students", icon: GraduationCap, match: (path) => path.startsWith("/instructor/students") || path.startsWith("/instructor/enrollments") || path.startsWith("/instructor/reports/enrollments") },
  { label: "Assessments", to: "/instructor/assessments", icon: ClipboardCheck, match: (path) => path.startsWith("/instructor/assessments") || path.startsWith("/instructor/assessment-results") || path.startsWith("/assessments/") },
  { label: "Earnings", to: "/instructor/payroll", icon: Wallet, match: (path) => path.startsWith("/instructor/payroll") },
  { label: "Notifications", to: "/community/notifications", icon: Bell, match: (path) => path.includes("notification") },
];

export default function InstructorWorkspaceNav({ pathname }) {
  return (
    <nav className="instructor-workspace-nav" aria-label="Instructor workspace">
      {sections.map(({ label, to, icon: Icon, match }) => (
        <NavLink key={label} to={to} end={label === "Overview"}
          className={match(pathname) ? "instructor-workspace-nav__link is-active" : "instructor-workspace-nav__link"}
          aria-current={match(pathname) ? "page" : undefined}>
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
