import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import {
  Bell,
  Check,
  CheckCheck,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import communityApi from "../../service/CommunityApi";
import LearnovaBackNavigation from "../../component/LearnovaBackNavigation";
import "./NotificationsPage.scss";

const unwrap = (response) => response?.data?.data ?? response?.data ?? {};
const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Unable to load notifications.";

const formatNotificationDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await communityApi.getNotifications({ page: 1, limit: 50 });
      const result = unwrap(response);
      const rows = Array.isArray(result) ? result : result.notifications ?? [];
      setNotifications(Array.isArray(rows) ? rows : []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadNotifications(true);
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const markRead = async (notification) => {
    if (notification.is_read || updatingId === notification.id) return;
    setUpdatingId(notification.id);
    setError("");

    try {
      await communityApi.markRead(notification.id);
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item
      ));
    } catch (readError) {
      setError(getErrorMessage(readError));
    } finally {
      setUpdatingId(null);
    }
  };

  const markAllRead = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    setError("");

    try {
      await communityApi.markAllRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (readError) {
      setError(getErrorMessage(readError));
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const visibleNotifications = useMemo(
    () => filter === "unread" ? notifications.filter((item) => !item.is_read) : notifications,
    [filter, notifications]
  );

  return (
    <Box className="community-page community-notifications-page">
      <div className="notifications-topline">
        <LearnovaBackNavigation
          to="/community/discussions"
          brandTo="/"
          label="Back to community"
          className="notifications-back-navigation"
        />
        <Button
          className="notifications-refresh"
          aria-label="Refresh notifications"
          onClick={() => loadNotifications(true)}
          disabled={loading || refreshing}
          startIcon={refreshing ? <CircularProgress size={15} /> : <RefreshCw size={16} />}
        >
          Refresh
        </Button>
      </div>

      <header className="notifications-hero">
        <div className="notifications-hero-copy">
          <div className="notifications-title-icon"><Bell size={23} /></div>
          <div>
            <span className="community-eyebrow">LEARNOVA COMMUNITY</span>
            <h1>Notifications</h1>
            <p>Stay up to date with course milestones, assessment results, payments, certificates and community activity.</p>
          </div>
        </div>
        <div className="notifications-hero-summary">
          <span className="notifications-summary-number">{unreadCount}</span>
          <span className="notifications-summary-label">Unread updates</span>
        </div>
      </header>

      {error && <Alert className="notifications-alert" severity="error" onClose={() => setError("")}>{error}</Alert>}

      <section className="notifications-content" aria-label="Notifications">
        <div className="notifications-section-heading">
          <div>
            <h2>Your activity</h2>
            <p>{notifications.length} {notifications.length === 1 ? "notification" : "notifications"} in your inbox</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outlined"
              className="notifications-mark-all"
              startIcon={<CheckCheck size={16} />}
              onClick={markAllRead}
              disabled={markingAll}
            >
              {markingAll ? "Updating…" : "Mark all as read"}
            </Button>
          )}
        </div>

        <div className="notifications-filter-row">
          <div className="notifications-filter-tabs" role="tablist" aria-label="Filter notifications">
            <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
              All <span>{notifications.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>
              Unread <span>{unreadCount}</span>
            </button>
          </div>
          <span className="notifications-live-label"><span /> Latest activity</span>
        </div>

        {loading ? (
          <div className="notifications-skeleton-list">
            {[1, 2, 3].map((item) => (
              <div className="notifications-skeleton-card" key={item}>
                <Skeleton variant="circular" width={44} height={44} />
                <div><Skeleton width="42%" /><Skeleton width="78%" /><Skeleton width="28%" /></div>
              </div>
            ))}
          </div>
        ) : visibleNotifications.length ? (
          <div className="community-notification-list notifications-list">
            {visibleNotifications.map((notification) => (
              <article
                className={`community-notification-card notifications-card${notification.is_read ? " is-read" : " is-unread"}`}
                key={notification.id}
              >
                <div className="notifications-avatar-wrap">
                  <Avatar className="notifications-avatar"><MessageCircle size={19} /></Avatar>
                  {!notification.is_read && <span className="notifications-unread-dot" />}
                </div>
                <div className="community-notification-copy notifications-copy">
                  <div className="notifications-card-heading">
                    <b>{notification.title || "Community update"}</b>
                    {!notification.is_read && <Chip label="NEW" size="small" className="notifications-new-chip" />}
                  </div>
                  <p>{notification.message || "There is a new update in your community."}</p>
                  <small>{formatNotificationDate(notification.created_at)}</small>
                </div>
                <div className="community-notification-actions notifications-actions">
                  {!notification.is_read && (
                    <Button
                      size="small"
                      startIcon={<Check size={15} />}
                      onClick={() => markRead(notification)}
                      disabled={updatingId === notification.id}
                    >
                      {updatingId === notification.id ? "Saving…" : "Mark read"}
                    </Button>
                  )}
                  {notification.post_id && (
                    <Button
                      size="small"
                      component={Link}
                      to={`/community/posts/${notification.post_id}`}
                      onClick={() => markRead(notification)}
                    >
                      View discussion
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="notifications-empty">
            <div className="notifications-empty-icon"><Sparkles size={25} /></div>
            <h3>{filter === "unread" ? "You're all caught up" : "No notifications yet"}</h3>
            <p>{filter === "unread" ? "There are no unread updates. You’re up to date." : "Course updates, assessment results, payments, certificates and community activity will appear here."}</p>
            {filter === "unread" && notifications.length > 0 && (
              <Button onClick={() => setFilter("all")}>View all notifications</Button>
            )}
          </div>
        )}
      </section>
    </Box>
  );
}
