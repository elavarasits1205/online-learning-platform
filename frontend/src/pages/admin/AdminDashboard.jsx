import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowUpRight,
    Bell,
    BookOpen,
    CheckCheck,
    ChevronRight,
    ClipboardCheck,
    Clock3,
    DollarSign,
    GraduationCap,
    RefreshCw,
    Users,
    UserRound,
    Wallet,
} from "lucide-react";

import { adminDashboardApi } from "../../service/adminDashboardApi";
import communityApi from "../../service/CommunityApi";
import { logoutUser } from "../../service/Authapi";
import { getAuthUser, clearAuthUser } from "../../utils/authCookie";
import "./AdminDashboard.scss";

const unwrap = (response) => response?.data?.data ?? response?.data ?? {};

function formatCount(value) {
    const count = Number(value);
    return Number.isFinite(count)
        ? new Intl.NumberFormat("en-IN").format(count)
        : "—";
}

function formatMoney(value, currencyCode = "INR") {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currencyCode || "INR",
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currencyCode || "INR"} ${new Intl.NumberFormat("en-IN").format(amount)}`;
    }
}

function formatDate(value) {
    if (!value) return "Date not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date not available";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function currencyBreakdown(rows, amountField) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return [formatMoney(0, "INR")];
    }

    return rows.map((row) =>
        formatMoney(row[amountField], row.currencyCode)
    );
}

function KpiCard({ icon: Icon, label, value, caption, to, tone }) {
    const content = (
        <>
            <div className={`admin-kpi-icon is-${tone}`}>
                <Icon size={19} aria-hidden="true" />
            </div>
            <span className="admin-kpi-label">{label}</span>
            <div className="admin-kpi-value">{value}</div>
            <span className="admin-kpi-caption">{caption}</span>
            <ArrowUpRight className="admin-kpi-arrow" size={16} aria-hidden="true" />
        </>
    );

    return to ? (
        <Link className="admin-kpi-card" to={to}>
            {content}
        </Link>
    ) : (
        <article className="admin-kpi-card">{content}</article>
    );
}

function WidgetPanel({ title, description, to, linkLabel, children, className = "" }) {
    return (
        <section className={`admin-widget-panel ${className}`}>
            <header className="admin-widget-header">
                <div>
                    <h2>{title}</h2>
                    {description && <p>{description}</p>}
                </div>
                {to && (
                    <Link className="admin-widget-link" to={to}>
                        {linkLabel || "View all"}
                        <ChevronRight size={15} aria-hidden="true" />
                    </Link>
                )}
            </header>
            {children}
        </section>
    );
}

function TrendBars({ items, valueField, formatValue, ariaLabel }) {
    const values = items.map((item) => Number(item[valueField]) || 0);
    const maximum = Math.max(...values, 1);

    if (items.length === 0) {
        return <div className="admin-widget-empty">Trend data will appear here.</div>;
    }

    return (
        <div className="admin-trend-chart" role="img" aria-label={ariaLabel}>
            {items.map((item, index) => {
                const value = values[index];
                const height = value > 0 ? Math.max(8, (value / maximum) * 100) : 3;

                return (
                    <div
                        className="admin-trend-column"
                        key={item.monthKey || `${item.monthLabel}-${index}`}
                        title={`${item.monthLabel}: ${formatValue(value)}`}
                    >
                        <span className="admin-trend-value">
                            {formatValue(value)}
                        </span>
                        <span className="admin-trend-track">
                            <span
                                className="admin-trend-bar"
                                style={{ height: `${height}%` }}
                            />
                        </span>
                        <span className="admin-trend-label">{item.monthLabel}</span>
                    </div>
                );
            })}
        </div>
    );
}

function AdminDashboard() {
    const navigate = useNavigate();
    const user = useMemo(() => getAuthUser(), []);
    const [summary, setSummary] = useState(null);
    const [widgets, setWidgets] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notificationsLoading, setNotificationsLoading] = useState(true);
    const [notificationError, setNotificationError] = useState("");
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState("INR");
    const dashboardRequestId = useRef(0);

    const loadDashboard = useCallback(async ({ fresh = false } = {}) => {
        const requestId = ++dashboardRequestId.current;
        setLoading(true);
        setError("");

        try {
            const [summaryData, widgetData] = await Promise.all([
                adminDashboardApi.getSummary({ fresh }),
                adminDashboardApi.getWidgets({ fresh }),
            ]);
            if (requestId === dashboardRequestId.current) {
                setSummary(summaryData || {});
                setWidgets(widgetData || {});
            }
        } catch (loadError) {
            if (requestId === dashboardRequestId.current) {
                setError(
                    loadError?.response?.data?.message ||
                    loadError?.message ||
                    "Unable to load the admin dashboard."
                );
            }
        } finally {
            if (requestId === dashboardRequestId.current) setLoading(false);
        }
    }, []);

    const loadNotifications = useCallback(async () => {
        setNotificationsLoading(true);
        setNotificationError("");

        try {
            const [notificationResponse, unreadResponse] = await Promise.all([
                communityApi.getNotifications({ page: 1, limit: 5 }),
                communityApi.getUnreadCount(),
            ]);
            const notificationData = unwrap(notificationResponse);
            const unreadData = unwrap(unreadResponse);

            setNotifications(
                Array.isArray(notificationData)
                    ? notificationData
                    : notificationData.notifications ?? []
            );
            setUnreadCount(Number(unreadData.unread_count) || 0);
        } catch (loadError) {
            setNotificationError(
                loadError?.response?.data?.message ||
                loadError?.message ||
                "Unable to load notifications."
            );
        } finally {
            setNotificationsLoading(false);
        }
    }, []);

    const handleDashboardRefresh = useCallback(async () => {
        if (refreshing) return;

        setRefreshing(true);
        try {
            await Promise.all([
                loadDashboard({ fresh: true }),
                loadNotifications(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [loadDashboard, loadNotifications, refreshing]);

    useEffect(() => {
        loadDashboard();
        loadNotifications();
    }, [loadDashboard, loadNotifications]);

    async function handleLogout() {
        try {
            await logoutUser();
        } catch (logoutError) {
            console.error("Logout error:", logoutError);
        } finally {
            clearAuthUser();
            navigate("/login", { replace: true });
        }
    }

    async function handleMarkRead(notification) {
        if (notification.is_read) return;

        try {
            await communityApi.markRead(notification.id);
            setNotifications((current) => current.map((item) =>
                item.id === notification.id ? { ...item, is_read: true } : item
            ));
            setUnreadCount((count) => Math.max(0, count - 1));
        } catch (readError) {
            setNotificationError(
                readError?.response?.data?.message ||
                readError?.message ||
                "Unable to update this notification."
            );
        }
    }

    async function handleMarkAllRead() {
        try {
            await communityApi.markAllRead();
            setNotifications((current) => current.map((item) => ({
                ...item,
                is_read: true,
            })));
            setUnreadCount(0);
        } catch (readError) {
            setNotificationError(
                readError?.response?.data?.message ||
                readError?.message ||
                "Unable to update notifications."
            );
        }
    }

    const revenueByCurrency = summary?.revenueByCurrency ?? [];
    const revenueCurrencies = useMemo(() => {
        const currencies = (widgets?.revenueTrend ?? [])
            .map((item) => item.currencyCode)
            .filter(Boolean);
        return [...new Set(currencies)];
    }, [widgets]);
    const activeCurrency = revenueCurrencies.includes(selectedCurrency)
        ? selectedCurrency
        : revenueCurrencies[0] || "INR";
    const revenueTrend = (widgets?.revenueTrend ?? [])
        .filter((item) => item.currencyCode === activeCurrency);

    const cards = [
        {
            icon: Users,
            label: "Active students",
            value: formatCount(summary?.activeStudents),
            caption: "Approved and active accounts",
            to: "/admin/users",
            tone: "purple",
        },
        {
            icon: UserRound,
            label: "Active instructors",
            value: formatCount(summary?.activeInstructors),
            caption: "Approved and active accounts",
            to: "/admin/master-data/instructors",
            tone: "blue",
        },
        {
            icon: BookOpen,
            label: "Published courses",
            value: formatCount(summary?.publishedCourses),
            caption: "Available on the platform",
            to: "/admin/courses",
            tone: "green",
        },
        {
            icon: ClipboardCheck,
            label: "Pending approvals",
            value: formatCount(summary?.pendingCourseApprovals),
            caption: "Courses waiting for review",
            to: "/admin/courses",
            tone: "orange",
        },
        {
            icon: GraduationCap,
            label: "Enrollments this month",
            value: formatCount(summary?.enrollmentsThisMonth),
            caption: "New enrollment records",
            to: "/admin/enrollments",
            tone: "pink",
        },
        {
            icon: DollarSign,
            label: "Revenue collected",
            value: summary ? (
                <span className="admin-kpi-currency-list">
                    {(revenueByCurrency.length > 0
                        ? revenueByCurrency
                        : [{ currencyCode: "INR", totalAmount: 0 }]
                    ).map((row, index) => (
                        <span key={`${row.currencyCode}-${index}`}>
                            {formatMoney(row.totalAmount, row.currencyCode)}
                        </span>
                    ))}
                </span>
            ) : "—",
            caption: !summary
                ? "Loading revenue"
                : revenueByCurrency.length
                    ? `This month: ${currencyBreakdown(revenueByCurrency, "monthAmount").join(" · ")}`
                    : "No collected payments yet",
            to: "/admin/payments",
            tone: "gold",
        },
    ];

    const topCourses = widgets?.topCourses ?? [];
    const maxCourseEnrollments = Math.max(
        ...topCourses.map((course) => Number(course.enrollmentCount) || 0),
        1
    );
    const displayName = user?.firstName || user?.first_name || user?.username || "Administrator";

    return (
        <div className="admin-dashboard">
            <header className="admin-dashboard-header">
                <div>
                    <span className="admin-dashboard-eyebrow">PLATFORM OVERVIEW</span>
                    <h1>Admin dashboard</h1>
                    <p>Welcome back, {displayName}. Here’s what’s happening across the platform.</p>
                </div>

                <div className="admin-dashboard-actions">
                    <div className="admin-notification-anchor">
                        <button
                            className={`admin-notification-button${notificationOpen ? " is-open" : ""}`}
                            type="button"
                            aria-expanded={notificationOpen}
                            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                            onClick={() => setNotificationOpen((open) => !open)}
                        >
                            <Bell size={18} aria-hidden="true" />
                            <span>Notifications</span>
                            {unreadCount > 0 && (
                                <span className="admin-notification-badge">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {notificationOpen && (
                            <section className="admin-notification-popover" aria-label="Recent notifications">
                                <header>
                                    <div>
                                        <h2>Notifications</h2>
                                        <p>{unreadCount} unread</p>
                                    </div>
                                    {unreadCount > 0 && (
                                        <button type="button" className="admin-notification-text-button" onClick={handleMarkAllRead}>
                                            <CheckCheck size={15} aria-hidden="true" />
                                            Mark all read
                                        </button>
                                    )}
                                </header>

                                {notificationError && (
                                    <p className="admin-notification-error" role="alert">{notificationError}</p>
                                )}

                                {notificationsLoading ? (
                                    <p className="admin-notification-empty">Loading notifications…</p>
                                ) : notifications.length > 0 ? (
                                    <div className="admin-notification-list">
                                        {notifications.map((notification) => (
                                            <button
                                                type="button"
                                                className={`admin-notification-item${notification.is_read ? " is-read" : " is-unread"}`}
                                                key={notification.id}
                                                onClick={() => handleMarkRead(notification)}
                                            >
                                                <span className="admin-notification-dot" aria-hidden="true" />
                                                <span className="admin-notification-copy">
                                                    <strong>{notification.title || "Platform update"}</strong>
                                                    <span>{notification.message}</span>
                                                    <small>{formatDateTime(notification.created_at)}</small>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="admin-notification-empty">You’re all caught up.</p>
                                )}

                                <Link
                                    className="admin-notification-view-all"
                                    to="/community/notifications"
                                    onClick={() => setNotificationOpen(false)}
                                >
                                    View all notifications
                                    <ChevronRight size={15} aria-hidden="true" />
                                </Link>
                            </section>
                        )}
                    </div>

                    <button
                        className={`admin-dashboard-icon-button${refreshing ? " is-refreshing" : ""}`}
                        type="button"
                        aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"}
                        aria-busy={refreshing}
                        title={refreshing ? "Refreshing dashboard…" : "Refresh dashboard"}
                        disabled={refreshing}
                        onClick={handleDashboardRefresh}
                    >
                        <RefreshCw size={17} aria-hidden="true" />
                    </button>
                    <button className="admin-dashboard-logout" type="button" onClick={handleLogout}>
                        Log out
                    </button>
                </div>
            </header>

            {error && <div className="admin-dashboard-error" role="alert">{error}</div>}

            <section className="admin-kpi-grid" aria-label="Platform summary">
                {cards.map((card) => (
                    <KpiCard key={card.label} {...card} />
                ))}
            </section>

            {loading && !widgets ? (
                <div className="admin-dashboard-loading">Loading dashboard widgets…</div>
            ) : (
                <>
                    <section className="admin-analytics-grid" aria-label="Platform trends">
                        <WidgetPanel
                            title="Enrollment trend"
                            description="New enrollments over the last six months"
                            className="admin-trend-panel"
                        >
                            <TrendBars
                                items={widgets?.enrollmentTrend ?? []}
                                valueField="totalEnrollments"
                                formatValue={formatCount}
                                ariaLabel="Monthly enrollment totals for the last six months"
                            />
                        </WidgetPanel>

                        <WidgetPanel
                            title="Revenue trend"
                            description="Collected payments over the last six months"
                            className="admin-trend-panel"
                        >
                            {revenueCurrencies.length > 1 && (
                                <label className="admin-currency-select">
                                    <span>Currency</span>
                                    <select
                                        value={activeCurrency}
                                        onChange={(event) => setSelectedCurrency(event.target.value)}
                                    >
                                        {revenueCurrencies.map((currency) => (
                                            <option value={currency} key={currency}>{currency}</option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <TrendBars
                                items={revenueTrend}
                                valueField="totalAmount"
                                formatValue={(value) => formatMoney(value, activeCurrency)}
                                ariaLabel={`Monthly revenue totals in ${activeCurrency} for the last six months`}
                            />
                        </WidgetPanel>
                    </section>

                    <section className="admin-operations-grid" aria-label="Admin actions and activity">
                        <WidgetPanel
                            title="Courses with most enrollments"
                            description="Published courses ranked by enrollment count"
                            to="/admin/courses"
                            linkLabel="All courses"
                        >
                            {topCourses.length > 0 ? (
                                <div className="admin-ranked-list">
                                    {topCourses.map((course, index) => {
                                        const count = Number(course.enrollmentCount) || 0;
                                        return (
                                            <div className="admin-ranked-item" key={course.id}>
                                                <span className="admin-ranked-number">{index + 1}</span>
                                                <div className="admin-ranked-copy">
                                                    <div className="admin-ranked-title-row">
                                                        <strong>{course.title}</strong>
                                                        <span>{formatCount(count)}</span>
                                                    </div>
                                                    <small>{course.courseCode || "Published course"}</small>
                                                    <span className="admin-ranked-track">
                                                        <span style={{ width: `${Math.max(count > 0 ? 4 : 0, (count / maxCourseEnrollments) * 100)}%` }} />
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="admin-widget-empty">Published courses will appear here.</div>
                            )}
                        </WidgetPanel>

                        <WidgetPanel
                            title="Pending course approvals"
                            description="Courses waiting for an administrator review"
                            to="/admin/courses/pending"
                            linkLabel="Review queue"
                        >
                            {widgets?.pendingApprovals?.length > 0 ? (
                                <div className="admin-simple-list">
                                    {widgets.pendingApprovals.map((course) => (
                                        <Link className="admin-list-row" to="/admin/courses/pending" key={course.id}>
                                            <span className="admin-list-icon is-orange"><ClipboardCheck size={17} aria-hidden="true" /></span>
                                            <span className="admin-list-copy">
                                                <strong>{course.title}</strong>
                                                <small>{course.instructorName || course.courseCode || "Instructor not assigned"}</small>
                                            </span>
                                            <span className="admin-list-meta">{formatDate(course.submittedAt)}</span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="admin-widget-empty">No courses are waiting for approval.</div>
                            )}
                        </WidgetPanel>

                        <WidgetPanel
                            title="Recent payments and refunds"
                            description="Latest payment and refund activity"
                            to="/admin/payments"
                            linkLabel="Payment records"
                        >
                            {widgets?.recentFinancialActivity?.length > 0 ? (
                                <div className="admin-simple-list">
                                    {widgets.recentFinancialActivity.map((activity) => (
                                        <Link
                                            className="admin-list-row"
                                            to={activity.activityType === "REFUND" ? "/admin/payments/refunds" : "/admin/payments"}
                                            key={`${activity.activityType}-${activity.id}`}
                                        >
                                            <span className={`admin-list-icon ${activity.activityType === "REFUND" ? "is-pink" : "is-green"}`}>
                                                {activity.activityType === "REFUND"
                                                    ? <Wallet size={17} aria-hidden="true" />
                                                    : <DollarSign size={17} aria-hidden="true" />}
                                            </span>
                                            <span className="admin-list-copy">
                                                <strong>{activity.customerName || activity.reference || activity.activityType}</strong>
                                                <small>{activity.activityType} · {activity.courseTitle || activity.reference || "Payment activity"}</small>
                                            </span>
                                            <span className="admin-list-amount">
                                                <strong>{formatMoney(activity.amount, activity.currencyCode)}</strong>
                                                <small>{activity.status}</small>
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="admin-widget-empty">Payment activity will appear here.</div>
                            )}
                        </WidgetPanel>

                        <WidgetPanel
                            title="Payroll needing attention"
                            description="Draft, calculated, or approved instructor payrolls"
                            to="/admin/payroll/instructor-payrolls"
                            linkLabel="Open payroll"
                        >
                            {widgets?.payrollAttention?.length > 0 ? (
                                <div className="admin-simple-list">
                                    {widgets.payrollAttention.map((payroll) => (
                                        <Link className="admin-list-row" to="/admin/payroll/instructor-payrolls" key={payroll.id}>
                                            <span className="admin-list-icon is-purple"><Clock3 size={17} aria-hidden="true" /></span>
                                            <span className="admin-list-copy">
                                                <strong>{payroll.instructorName}</strong>
                                                <small>{payroll.payrollNumber || "Payroll"} · {payroll.periodCode}</small>
                                            </span>
                                            <span className="admin-list-amount">
                                                <strong>{formatMoney(payroll.netAmount, payroll.currencyCode)}</strong>
                                                <small className={`admin-status is-${String(payroll.status).toLowerCase()}`}>{payroll.status}</small>
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="admin-widget-empty">No payroll items need attention.</div>
                            )}
                        </WidgetPanel>
                    </section>
                </>
            )}
        </div>
    );
}

export default AdminDashboard;
