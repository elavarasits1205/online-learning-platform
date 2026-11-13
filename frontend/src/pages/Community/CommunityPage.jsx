import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  TextField,
  Tooltip,
} from "@mui/material";
import {
  Bookmark,
  BookmarkCheck,
  Bell,
  MessageCircle,
  Plus,
  Search,
  Send,
  ThumbsUp,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Paperclip,
  X,
} from "lucide-react";
import api from "../../service/Api";
import communityApi from "../../service/CommunityApi";
import { getAuthUser } from "../../utils/authCookie";
import LearnovaBackNavigation from "../../component/LearnovaBackNavigation";
import MentionTextField from "./MentionTextField";
import "./CommunityPage.scss";

const unwrap = (response) => response?.data?.data ?? response?.data ?? {};
const rows = (value) =>
  Array.isArray(value)
    ? value
    : value?.categories ??
      value?.posts ??
      value?.bookmarks ??
      value?.notifications ??
      value?.enrollments ??
      value?.items ??
      [];
const messageOf = (error) =>
  error?.response?.data?.message || error?.message || "Something went wrong.";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 5;
const ATTACHMENT_MIME_TYPES = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  webp: ["image/webp"],
};

const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_MIME_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");

function formatFileSize(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateAttachment(file) {
  const extension = String(file?.name || "").split(".").pop().toLowerCase();
  const validTypes = ATTACHMENT_MIME_TYPES[extension];
  if (!validTypes || !validTypes.includes(file.type)) {
    return "Unsupported file type.";
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return "File is too large. Maximum size is 10 MB.";
  }
  return "";
}

function SelectedAttachmentList({ attachments, onRemove, disabled = false }) {
  if (!attachments.length) return null;

  return (
    <div className="community-selected-attachments" aria-label="Selected files">
      {attachments.map((attachment) => {
        const imagePreview = attachment.file.type.startsWith("image/");
        return (
          <div className="community-selected-attachment" key={attachment.id}>
            {imagePreview && attachment.previewUrl ? (
              <img src={attachment.previewUrl} alt="" />
            ) : (
              <span className="community-selected-attachment-icon" aria-hidden="true">
                <FileText size={17} />
              </span>
            )}
            <span className="community-selected-attachment-copy">
              <b title={attachment.file.name}>{attachment.file.name}</b>
              <small>{formatFileSize(attachment.file.size)}</small>
            </span>
            <IconButton
              type="button"
              size="small"
              onClick={() => onRemove(attachment.id)}
              disabled={disabled}
              aria-label={`Remove ${attachment.file.name}`}
            >
              <X size={16} />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}

function normalizeRole(role) {
  if (typeof role === "string") return role.trim().toUpperCase();
  if (!role || typeof role !== "object") return "";
  return String(
    role.code ??
      role.name ??
      role.role_code ??
      role.role_name ??
      role.roleName ??
      ""
  )
    .trim()
    .toUpperCase();
}

function isStudentSession() {
  const user = getAuthUser();
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : Array.isArray(user?.user?.roles)
      ? user.user.roles
      : [];
  const singleRole =
    user?.role ??
    user?.role_code ??
    user?.role_name ??
    user?.roleName ??
    user?.user?.role;

  return [...roles.map(normalizeRole), normalizeRole(singleRole)].includes(
    "STUDENT"
  );
}

function getCourseId(enrollment) {
  return (
    enrollment?.course_id ??
    enrollment?.courseId ??
    enrollment?.course?.id ??
    ""
  );
}

function getCourseTitle(enrollment) {
  return (
    enrollment?.course_title ??
    enrollment?.title ??
    enrollment?.course?.title ??
    enrollment?.course?.name ??
    "Enrolled course"
  );
}

export default function CommunityPage({ mineOnly = false, bookmarksOnly = false }) {
  const isStudent = useMemo(() => isStudentSession(), []);
  const currentUser = useMemo(() => getAuthUser(), []);
  const currentUserId =
    currentUser?.id ?? currentUser?.user_id ?? currentUser?.user?.id;
  const questionComposerRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const attachmentPreviewUrlsRef = useRef(new Set());
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [postType, setPostType] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [reacting, setReacting] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentDragging, setAttachmentDragging] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);
  const [createdPostId, setCreatedPostId] = useState(null);
  const [bookmarking, setBookmarking] = useState({});
  const [quickQuestion, setQuickQuestion] = useState("");
  const [quickCategory, setQuickCategory] = useState("");
  const [quickCourse, setQuickCourse] = useState("");
  const [quickAnonymous, setQuickAnonymous] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category_id: "",
    post_type: isStudent ? "QUESTION" : "DISCUSSION",
    course_id: "",
    is_anonymous: false,
  });
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (bookmarksOnly) {
        const result = unwrap(
          await communityApi.getBookmarks({ page, limit: 10 })
        );
        let savedPosts = rows(result).map((post) => ({
          ...post,
          is_bookmarked: true,
        }));
        if (selectedCategory) {
          savedPosts = savedPosts.filter(
            (post) => String(post.category_id) === String(selectedCategory)
          );
        }
        if (debouncedSearch) {
          const term = debouncedSearch.toLowerCase();
          savedPosts = savedPosts.filter(
            (post) =>
              String(post.title || "").toLowerCase().includes(term) ||
              String(post.content || "").toLowerCase().includes(term)
          );
        }
        if (postType) {
          savedPosts = savedPosts.filter(
            (post) => String(post.post_type).toUpperCase() === postType
          );
        }
        setPosts(savedPosts);
        setPagination(result.pagination ?? { total: savedPosts.length, totalPages: 1 });
        return;
      }

      const params = { page, limit: 10 };
      if (mineOnly) params.mine = "true";
      else if (isStudent) params.author_role = "STUDENT";
      if (selectedCategory) params.category_id = selectedCategory;
      if (debouncedSearch) params.search = debouncedSearch;
      if (postType) params.post_type = postType;
      const result = unwrap(await communityApi.getPosts(params));
      setPosts(rows(result));
      setPagination(result.pagination ?? { total: rows(result).length, totalPages: 1 });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, debouncedSearch,search, postType, mineOnly, bookmarksOnly, isStudent,page]);


  useEffect(() => { setPage(1); }, [selectedCategory,debouncedSearch, search, postType, mineOnly, bookmarksOnly,isStudent,page]);

  const loadNotifications = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        communityApi.getNotifications({ page: 1, limit: 5 }),
        communityApi.getUnreadCount(),
      ]);
      setNotifications(rows(unwrap(list)));
      const countData = unwrap(count);
      setUnread(Number(countData.unread_count ?? countData.count ?? 0));
    } catch {
      // Notification access may be restricted by the current role.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCommunityInfo() {
      try {
        const result = unwrap(await communityApi.getCategories());
        if (!cancelled) {
          const loadedCategories = rows(result);
          setCategories(loadedCategories);
          setQuickCategory((current) =>
            current || String(loadedCategories[0]?.id ?? "")
          );
        }
      } catch (e) {
        if (!cancelled) setError(messageOf(e));
      }
      if (!cancelled) loadNotifications();
    }
    loadCommunityInfo();
    return () => {
      cancelled = true;
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!isStudent) return undefined;
    let cancelled = false;
    api
      .get("/student/enrollments")
      .then((response) => {
        if (!cancelled) setCourses(rows(unwrap(response)));
      })
      .catch(() => {
        // Asking a general community question does not require an enrollment.
      });
    return () => {
      cancelled = true;
    };
  }, [isStudent]);

  // Debounce search so the API is not called on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPosts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  const clearSelectedAttachments = () => {
    attachmentPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    attachmentPreviewUrlsRef.current.clear();
    setSelectedAttachments([]);
    setAttachmentError("");
    setAttachmentProgress(0);
  };

  const addSelectedAttachments = (fileList) => {
    const files = Array.from(fileList || []);
    const room = Math.max(0, MAX_ATTACHMENT_COUNT - selectedAttachments.length);
    const accepted = [];
    const errors = [];
    const selectedKeys = new Set(
      selectedAttachments.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`)
    );

    files.forEach((file) => {
      const validationMessage = validateAttachment(file);
      if (validationMessage) {
        errors.push(`${file.name}: ${validationMessage}`);
        return;
      }

      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (selectedKeys.has(key)) return;
      if (accepted.length >= room) {
        errors.push("You can attach up to 5 files to a post.");
        return;
      }

      selectedKeys.add(key);
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "";
      if (previewUrl) attachmentPreviewUrlsRef.current.add(previewUrl);
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl,
      });
    });

    if (accepted.length) {
      setSelectedAttachments((current) => [...current, ...accepted]);
    }
    setAttachmentError(errors.join(" "));
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const removeSelectedAttachment = (attachmentId) => {
    const attachment = selectedAttachments.find((item) => item.id === attachmentId);
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
      attachmentPreviewUrlsRef.current.delete(attachment.previewUrl);
    }
    setSelectedAttachments((current) => current.filter((item) => item.id !== attachmentId));
    setAttachmentError("");
  };

  const closeComposer = () => {
    if (submitting) return;
    setDialogOpen(false);
    setCreatedPostId(null);
    clearSelectedAttachments();
  };

  const openComposer = (type) => {
    clearSelectedAttachments();
    setCreatedPostId(null);
    setForm({
      title: "",
      content: "",
      category_id: "",
      post_type: type ?? (isStudent ? "QUESTION" : "DISCUSSION"),
      course_id: "",
      is_anonymous: false,
    });
    setError("");
    setDialogOpen(true);
  };

  const createPost = async (event) => {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!form.title.trim() || !form.content.trim() || !form.category_id) {
      setError("Please complete the title, category and description.");
      return;
    }

    setSubmitting(true);
    setAttachmentProgress(0);
    let postId = createdPostId;
    try {
      if (!postId) {
        const response = await communityApi.createPost({
          ...form,
          title: form.title.trim(),
          content: form.content.trim(),
          category_id: Number(form.category_id),
          course_id: form.course_id ? Number(form.course_id) : null,
        });
        const createdPost = unwrap(response)?.post ?? unwrap(response);
        postId = createdPost?.id;
        if (!postId) throw new Error("The post was created, but its ID was not returned.");
        if (selectedAttachments.length) setCreatedPostId(postId);
      }

      if (selectedAttachments.length) {
        await communityApi.uploadPostAttachments(
          postId,
          selectedAttachments.map(({ file }) => file),
          (event) => {
            if (event.total) {
              setAttachmentProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
            }
          }
        );
      }

      setDialogOpen(false);
      setCreatedPostId(null);
      clearSelectedAttachments();
      setForm({
        title: "",
        content: "",
        category_id: "",
        post_type: isStudent ? "QUESTION" : "DISCUSSION",
        course_id: "",
        is_anonymous: false,
      });
      setNotice(
        form.post_type === "QUESTION"
          ? "Your question was posted to the community."
          : "Your discussion was posted to the community."
      );
      await loadPosts();
    } catch (e) {
      if (postId) {
        setCreatedPostId(postId);
        setAttachmentError(
          `Your post is live, but its attachments were not uploaded. ${messageOf(e)} Retry the upload or close this dialog.`
        );
        await loadPosts();
      } else {
        setError(messageOf(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const askQuestion = async (event) => {
    event.preventDefault();
    const content = quickQuestion.trim();
    if (!content || submitting) return;
    if (!quickCategory) {
      setError("Choose a community topic before posting your question.");
      return;
    }

    const firstLine = content.split(/\r?\n/)[0].trim();
    const firstSentence = firstLine.split(/[.!?]/)[0].trim();
    const titleSource = firstSentence || firstLine || content;
    const title =
      titleSource.length > 100 ? titleSource.slice(0, 97).trimEnd() + "..." : titleSource;

    setError("");
    setNotice("");
    setSubmitting(true);
    setAttachmentProgress(0);
    let postId = createdPostId;
    try {
      if (!postId) {
        const response = await communityApi.createPost({
          title: title || "Student question",
          content,
          category_id: Number(quickCategory),
          post_type: "QUESTION",
          course_id: quickCourse ? Number(quickCourse) : null,
          is_anonymous: quickAnonymous,
        });
        const createdPost = unwrap(response)?.post ?? unwrap(response);
        postId = createdPost?.id;
        if (!postId) throw new Error("The post was created, but its ID was not returned.");
        if (selectedAttachments.length) setCreatedPostId(postId);
      }

      if (selectedAttachments.length) {
        await communityApi.uploadPostAttachments(
          postId,
          selectedAttachments.map(({ file }) => file),
          (event) => {
            if (event.total) {
              setAttachmentProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
            }
          }
        );
      }

      setQuickQuestion("");
      setQuickAnonymous(false);
      setCreatedPostId(null);
      clearSelectedAttachments();
      setNotice("Your question was posted to the community.");
      await loadPosts();
    } catch (e) {
      if (postId) {
        setCreatedPostId(postId);
        setAttachmentError(
          `Your question is live, but its attachments were not uploaded. ${messageOf(e)} Retry the upload or remove the files.`
        );
        await loadPosts();
      } else {
        setError(messageOf(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reactToPost = async (post) => {
    const postKey = String(post.id);
    if (reacting[postKey]) return;

    setError("");
    setReacting((current) => ({ ...current, [postKey]: true }));
    try {
      if (post.is_reacted || post.user_reaction || post.reaction_type) {
        await communityApi.removePostReaction(post.id);
      } else {
        await communityApi.addPostReaction(post.id, { reaction_type: "LIKE" });
      }
      await loadPosts();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setReacting((current) => ({ ...current, [postKey]: false }));
    }
  };

  const toggleBookmark = async (post) => {
    const postKey = String(post.id);
    if (bookmarking[postKey]) return;
    const wasBookmarked = Boolean(post.is_bookmarked);

    setError("");
    setBookmarking((current) => ({ ...current, [postKey]: true }));
    if (!bookmarksOnly) {
      setPosts((current) =>
        current.map((item) =>
          String(item.id) === postKey
            ? {
                ...item,
                is_bookmarked: !wasBookmarked,
                bookmark_count: Math.max(
                  0,
                  Number(item.bookmark_count || 0) + (wasBookmarked ? -1 : 1)
                ),
              }
            : item
        )
      );
    }
    try {
      if (wasBookmarked) {
        await communityApi.removeBookmark(post.id);
        if (bookmarksOnly) {
          setPosts((current) => current.filter((item) => String(item.id) !== postKey));
        }
        setNotice("Post removed from your saved posts.");
      } else {
        await communityApi.addBookmark(post.id);
        setNotice("Post saved.");
      }
    } catch (e) {
      if (!bookmarksOnly) {
        setPosts((current) =>
          current.map((item) =>
            String(item.id) === postKey
              ? {
                  ...item,
                  is_bookmarked: wasBookmarked,
                  bookmark_count: Math.max(
                    0,
                    Number(item.bookmark_count || 0) + (wasBookmarked ? 1 : -1)
                  ),
                }
              : item
          )
        );
      }
      setError(messageOf(e));
    } finally {
      setBookmarking((current) => ({ ...current, [postKey]: false }));
    }
  };

  const markAllRead = async () => {
    try {
      await communityApi.markAllRead();
      await loadNotifications();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const visibleTitle = bookmarksOnly
    ? "Saved posts"
    : mineOnly
      ? "My discussions"
      : isStudent
      ? "Student community"
      : "Learn together. Grow together.";
  const visibleDescription = bookmarksOnly
    ? "Posts you saved to revisit later."
    : mineOnly
      ? "Review and continue the conversations you started."
      : isStudent
      ? "Ask course questions, share answers, and learn with other students."
      : "Ask questions, share knowledge, and connect with learners and instructors.";

  const visiblePosts = useMemo(() => {
    const list = [...posts];
    if (sortBy === "popular") {
      list.sort((a, b) => Number(b.reaction_count || 0) - Number(a.reaction_count || 0));
    } else if (sortBy === "discussed") {
      list.sort((a, b) => Number(b.reply_count || 0) - Number(a.reply_count || 0));
    } else {
      list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list;
  }, [posts, sortBy]);

  return (
    <Box
      className={
        isStudent
          ? "community-page community-student-chat-page student-page student-page--inset"
          : "community-page"
      }
    >
      {isStudent ? (
        <header className="community-chat-header">
          <div className="community-chat-brand">
            <LearnovaBackNavigation className="community-chat-back-brand" />
            <div>
              <h1>
                {bookmarksOnly
                  ? "Saved posts"
                  : mineOnly
                    ? "My discussions"
                    : "Ask the community"}
              </h1>
              <p>
                {bookmarksOnly
                  ? "Posts you saved to revisit later"
                  : mineOnly
                    ? "Questions and discussions you started"
                    : "Student questions and answers"}
              </p>
            </div>
          </div>
          <div className="community-chat-header-actions">
            <Button
              variant="outlined"
              startIcon={<Plus size={16} />}
              onClick={() => openComposer("DISCUSSION")}
            >
              New discussion
            </Button>
            <Tooltip
              title={unread > 0 ? unread + " unread notifications" : "Notifications"}
            >
              <IconButton
                component={Link}
                to="/community/notifications"
                className="community-bell"
                aria-label={
                  unread > 0
                    ? "Notifications, " + unread + " unread"
                    : "Open notifications"
                }
              >
                <Bell />
                {unread > 0 && (
                  <span className="community-bell-badge">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </IconButton>
            </Tooltip>
          </div>
        </header>
      ) : (
        <header className="community-hero">
          <div>
            <span className="community-eyebrow">LEARNOVA COMMUNITY</span>
            <h1>{visibleTitle}</h1>
            <p>{visibleDescription}</p>
          </div>
          <div className="community-hero-actions">
            <Button
              variant="contained"
              startIcon={<Plus size={17} />}
              onClick={() => openComposer()}
            >
              Create post
            </Button>
            <Tooltip
              title={unread > 0 ? unread + " unread notifications" : "Notifications"}
            >
              <IconButton
                component={Link}
                to="/community/notifications"
                className="community-bell"
                aria-label={
                  unread > 0
                    ? "Notifications, " + unread + " unread"
                    : "Open notifications"
                }
              >
                <Bell />
                {unread > 0 && (
                  <span className="community-bell-badge">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </IconButton>
            </Tooltip>
          </div>
        </header>
      )}

      {isStudent && (
        <nav className="community-chat-tabs" aria-label="Student discussions">
          <Button
            component={Link}
            to="/community/discussions"
            className={!mineOnly && !bookmarksOnly ? "is-active" : ""}
            aria-current={!mineOnly && !bookmarksOnly ? "page" : undefined}
          >
            Student discussions
          </Button>
          <Button
            component={Link}
            to="/community/my-discussions"
            className={mineOnly ? "is-active" : ""}
            aria-current={mineOnly ? "page" : undefined}
          >
            My discussions
          </Button>
          <Button
            component={Link}
            to="/community/bookmarks"
            className={bookmarksOnly ? "is-active" : ""}
            aria-current={bookmarksOnly ? "page" : undefined}
          >
            Saved posts
          </Button>
        </nav>
      )}

      {error && !isStudent && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {notice && !isStudent && (
        <Alert severity="success" onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      <div className={isStudent ? "community-grid community-chat-grid" : "community-grid"}>
        {!isStudent && <aside className="community-panel community-categories">
          <h3>Explore topics</h3>
          <button
            className={!selectedCategory ? "active" : ""}
            onClick={() => setSelectedCategory("")}
          >
            {mineOnly ? "My discussions" : "All posts"}
          </button>
          {!mineOnly &&
            categories.map((category) => (
              <button
                key={category.id}
                className={
                  String(selectedCategory) === String(category.id)
                    ? "active"
                    : ""
                }
                onClick={() => setSelectedCategory(String(category.id))}
              >
                {category.name}
              </button>
            ))}
          <div className="community-mini-notifications">
            <div className="community-panel-title">
              <h3>Notifications</h3>
              <Chip size="small" label={unread + " new"} />
            </div>
            {notifications.length ? (
              notifications.map((notification) => (
                <div className="community-notification" key={notification.id}>
                  <b>{notification.title}</b>
                  <small>{notification.message}</small>
                </div>
              ))
            ) : (
              <p className="community-muted">You're all caught up.</p>
            )}
            <Button
              size="small"
              component={Link}
              to="/community/notifications"
            >
              View all
            </Button>
            {unread > 0 && (
              <Button size="small" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </div>
        </aside>}

        <main className={isStudent ? "community-feed community-chat-feed" : "community-feed"}>
          {isStudent && (
            <div className="community-chat-welcome">
              <div>
                <b>Community assistant</b>
                <p>
                  {bookmarksOnly
                    ? "Saved discussions are kept here so you can return to them anytime."
                    : mineOnly
                      ? "Your questions appear here. Type @ to mention someone in a new post."
                      : "Hi! Type your doubt below and send it to the community. Students and instructors can reply to your question."}
                </p>
              </div>
            </div>
          )}
          {error && isStudent && (
            <Alert
              severity="error"
              onClose={() => setError("")}
              className="community-chat-status is-error"
            >
              {error}
            </Alert>
          )}
          <div
            className={
              isStudent
                ? "community-toolbar community-chat-toolbar"
                : "community-toolbar"
            }
          >
            {isStudent && (
              <TextField
                select
                size="small"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                sx={{ minWidth: 155 }}
                aria-label="Filter by community topic"
              >
                <MenuItem value="">All topics</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              size="small"
              fullWidth
              placeholder={isStudent ? "Search questions and discussions..." : "Search discussions..."}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              size="small"
              value={postType}
              onChange={(event) => setPostType(event.target.value)}
              sx={{ minWidth: 150 }}
              aria-label="Filter by post type"
            >
              <MenuItem value="">All types</MenuItem>
              <MenuItem value="QUESTION">Questions</MenuItem>
              <MenuItem value="DISCUSSION">Discussions</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              sx={{ minWidth: 145 }}
              aria-label="Sort discussions"
            >
              <MenuItem value="latest">Latest</MenuItem>
              <MenuItem value="popular">Most liked</MenuItem>
              <MenuItem value="discussed">Most discussed</MenuItem>
            </TextField>
            <IconButton onClick={loadPosts} disabled={loading} aria-label="Refresh community posts">
              <RefreshCw size={18} />
            </IconButton>
          </div>

          {loading ? (
            <div className="community-loading">
              <CircularProgress />
            </div>
          ) : visiblePosts.length ? (
            visiblePosts.map((post) => (
              <article
                className={
                  "community-post" +
                  (isStudent
                    ? " community-chat-message" +
                      (currentUserId !== undefined &&
                      String(post.author_user_id) === String(currentUserId)
                        ? " is-own"
                        : "")
                    : "")
                }
                key={post.id}
              >
                <div className="community-post-top">
                  <Avatar>
                    {post.is_anonymous
                      ? "A"
                      : String(post.author_name || post.author_user_id || "L")
                          .charAt(0)
                          .toUpperCase()}
                  </Avatar>
                  <div>
                    <b>
                      {post.is_anonymous
                        ? "Anonymous learner"
                        : post.author_name ||
                          "Member " + (post.author_user_id || "")}
                    </b>
                    <small>
                      {post.created_at
                        ? new Date(post.created_at).toLocaleString()
                        : "Community member"}
                    </small>
                  </div>
                  <div className="community-post-badges">
                    <Chip size="small" label={post.post_type || "DISCUSSION"} />
                    {post.is_pinned && (
                      <Chip size="small" color="primary" label="Pinned" />
                    )}
                  </div>
                </div>
                {post.category_name && (
                  <span className="community-post-category">
                    {post.category_name}
                  </span>
                )}
                <Link
                  className="community-post-title"
                  to={"/community/posts/" + post.id}
                >
                  {post.title}
                </Link>
                <p className="community-post-content">{post.content}</p>
                {Array.isArray(post.attachments) && post.attachments.length > 0 && (
                  <div className="community-post-attachments">
                    <span className="community-post-attachments-label">Attachments</span>
                    <div className="community-post-attachment-list">
                      {post.attachments.map((attachment, index) => {
                        const fileName = attachment.file_name || attachment.name || "Attachment";
                        const fileUrl = attachment.file_url || attachment.attachment_url || attachment.url;
                        const isImage =
                          String(attachment.mime_type || attachment.file_type || "")
                            .toLowerCase()
                            .startsWith("image/") ||
                          /\.(png|jpe?g|gif|webp)$/i.test(fileName);
                        const AttachmentTag = fileUrl ? "a" : "div";

                        return (
                          <AttachmentTag
                            className="community-post-attachment"
                            key={attachment.id || `${fileName}-${index}`}
                            href={fileUrl || undefined}
                            target={fileUrl ? "_blank" : undefined}
                            rel={fileUrl ? "noreferrer" : undefined}
                            download={fileUrl ? fileName : undefined}
                            aria-label={fileUrl ? `Open or download ${fileName}` : undefined}
                          >
                            {isImage && fileUrl ? (
                              <img src={fileUrl} alt="" loading="lazy" />
                            ) : (
                              <span className="community-post-attachment-icon" aria-hidden="true">
                                {isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
                              </span>
                            )}
                            <span className="community-post-attachment-copy">
                              <b title={fileName}>{fileName}</b>
                              <small>{formatFileSize(attachment.file_size)}</small>
                            </span>
                          </AttachmentTag>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="community-post-footer">
                  <Button
                    size="small"
                    startIcon={<MessageCircle size={16} />}
                    component={Link}
                    to={"/community/posts/" + post.id}
                  >
                    {post.reply_count ?? 0} comments
                  </Button>
                  <Button
                    size="small"
                    startIcon={<ThumbsUp size={16} />}
                    onClick={() => reactToPost(post)}
                    disabled={Boolean(reacting[String(post.id)])}
                    color={post.is_reacted ? "primary" : "inherit"}
                  >
                    {reacting[String(post.id)] ? "Updating..." : `${post.reaction_count ?? 0} Like`}
                  </Button>
                  <Button
                    size="small"
                    startIcon={
                      post.is_bookmarked ? (
                        <BookmarkCheck size={16} />
                      ) : (
                        <Bookmark size={16} />
                      )
                    }
                    onClick={() => toggleBookmark(post)}
                    disabled={Boolean(bookmarking[String(post.id)])}
                    aria-pressed={Boolean(post.is_bookmarked)}
                  >
                    {bookmarking[String(post.id)]
                      ? "Updating..."
                      : bookmarksOnly
                        ? "Remove saved"
                        : post.is_bookmarked
                          ? "Saved"
                          : "Save"}
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="community-empty">
              <h3>
                {bookmarksOnly
                  ? "No saved posts yet"
                  : isStudent
                    ? mineOnly
                      ? "No discussions yet"
                      : "No student discussions yet"
                    : "No discussions found"}
              </h3>
              <p>
                {bookmarksOnly
                  ? "Save a post from Student discussions and it will appear here."
                  : isStudent
                    ? mineOnly
                      ? "The discussions you start will appear here."
                      : "Start a student discussion or ask a course question."
                    : "Try another category or start a new discussion."}
              </p>
              {bookmarksOnly ? (
                <Button
                  component={Link}
                  to="/community/discussions"
                  variant="contained"
                >
                  Browse student discussions
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={() =>
                    isStudent
                      ? questionComposerRef.current?.focus()
                      : openComposer("QUESTION")
                  }
                >
                  {isStudent ? "Ask a doubt" : "Create first post"}
                </Button>
              )}
            </div>
          )}
          {!loading && pagination.totalPages > 1 && (
            <div className="community-pagination">
              <span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, pagination.total)} of {pagination.total} discussions</span>
              <Pagination count={pagination.totalPages} page={page} onChange={(_, nextPage) => setPage(nextPage)} color="primary" shape="rounded" />
            </div>
          )}
          {notice && isStudent && (
            <div className="community-chat-response">
              <p>{notice}</p>
            </div>
          )}
          {isStudent && (
            <form className="community-chat-composer" onSubmit={askQuestion}>
              <MentionTextField
                ref={questionComposerRef}
                minRows={2}
                maxRows={5}
                placeholder="Ask a doubt. Type @ to mention someone..."
                value={quickQuestion}
                onChange={(value) => {
                  setQuickQuestion(value);
                  if (notice) setNotice("");
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey)
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                inputProps={{ "aria-label": "Ask the student community" }}
              />
              <div className="community-quick-attachment-bar">
                <Button
                  type="button"
                  size="small"
                  startIcon={<Paperclip size={15} />}
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={submitting}
                  aria-label="Browse files to attach to your question"
                >
                  Attach files
                </Button>
                <small>Up to 5 files · 10 MB each</small>
              </div>
              <SelectedAttachmentList
                attachments={selectedAttachments}
                onRemove={removeSelectedAttachment}
                disabled={submitting}
              />
              {submitting && selectedAttachments.length > 0 && (
                <div className="community-attachment-progress-wrap">
                  <div
                    className="community-attachment-progress"
                    role="progressbar"
                    aria-label="Uploading attachments"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={attachmentProgress}
                  >
                    <span style={{ width: `${attachmentProgress}%` }} />
                  </div>
                  <small>
                    {attachmentProgress > 0
                      ? `Uploading attachments · ${attachmentProgress}%`
                      : "Uploading attachments…"}
                  </small>
                </div>
              )}
              {attachmentError && (
                <Alert
                  severity={createdPostId ? "warning" : "error"}
                  onClose={() => setAttachmentError("")}
                  className="community-attachment-error"
                >
                  {attachmentError}
                </Alert>
              )}
              <div className="community-chat-composer-options">
                <TextField
                  select
                  size="small"
                  label="Topic"
                  value={quickCategory}
                  onChange={(event) => setQuickCategory(event.target.value)}
                  disabled={!categories.length}
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
                {courses.length > 0 && (
                  <TextField
                    select
                    size="small"
                    label="Course (optional)"
                    value={quickCourse}
                    onChange={(event) => setQuickCourse(event.target.value)}
                  >
                    <MenuItem value="">Any course</MenuItem>
                    {courses.map((enrollment, index) => {
                      const courseId = getCourseId(enrollment);
                      if (!courseId) return null;
                      return (
                        <MenuItem key={courseId || index} value={String(courseId)}>
                          {getCourseTitle(enrollment)}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                )}
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={quickAnonymous}
                      onChange={(event) => setQuickAnonymous(event.target.checked)}
                    />
                  }
                  label="Post anonymously"
                />
                <Button
                  type="submit"
                  variant="contained"
                  endIcon={<Send size={16} />}
                  disabled={submitting || !quickQuestion.trim() || !quickCategory}
                >
                  {submitting ? "Sending..." : "Send"}
                </Button>
              </div>
              <small>Type @ to mention a student, instructor, or admin. Ctrl+Enter posts.</small>
            </form>
          )}
        </main>
      </div>

      <input
        ref={attachmentInputRef}
        className="community-attachment-input"
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        onChange={(event) => addSelectedAttachments(event.target.files)}
        aria-label="Choose post attachments"
      />

      <Dialog
        open={dialogOpen}
        onClose={closeComposer}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={createPost}>
          <DialogTitle>
            {form.post_type === "QUESTION"
              ? "Ask a question"
              : "Start a discussion"}
          </DialogTitle>
          <DialogContent className="community-form">
            {form.post_type === "QUESTION" && (
              <p className="community-form-help">
                Describe what you are stuck on. Other students and instructors
                can reply in the comments.
              </p>
            )}
            <TextField
              required
              label={form.post_type === "QUESTION" ? "Question title" : "Title"}
              value={form.title}
              inputProps={{ maxLength: 300 }}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
            <TextField
              required
              select
              label="Category"
              value={form.category_id}
              onChange={(event) =>
                setForm({ ...form, category_id: event.target.value })
              }
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Post type"
              value={form.post_type}
              onChange={(event) =>
                setForm({ ...form, post_type: event.target.value })
              }
            >
              <MenuItem value="QUESTION">Question</MenuItem>
              <MenuItem value="DISCUSSION">Discussion</MenuItem>
            </TextField>
            {isStudent && courses.length > 0 && (
              <TextField
                select
                label="Related course (optional)"
                value={form.course_id}
                onChange={(event) =>
                  setForm({ ...form, course_id: event.target.value })
                }
              >
                <MenuItem value="">General community question</MenuItem>
                {courses.map((enrollment, index) => {
                  const courseId = getCourseId(enrollment);
                  if (!courseId) return null;
                  return (
                    <MenuItem key={courseId || index} value={courseId}>
                      {getCourseTitle(enrollment)}
                    </MenuItem>
                  );
                })}
              </TextField>
            )}
            <MentionTextField
              required
              minRows={5}
              label={
                form.post_type === "QUESTION"
                  ? "Describe your doubt"
                  : "What's on your mind?"
              }
              value={form.content}
              onChange={(content) => setForm({ ...form, content })}
              placeholder="Type @ to mention a community member."
            />
            <section className="community-attachment-section" aria-label="Post attachments">
              <div className="community-attachment-heading">
                <div>
                  <b>Attachments</b>
                  <small>Up to 5 files · 10 MB each</small>
                </div>
                <Button
                  type="button"
                  size="small"
                  startIcon={<Paperclip size={15} />}
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={submitting}
                  aria-label="Browse files to attach"
                >
                  Browse files
                </Button>
              </div>
              <div
                className={
                  "community-attachment-dropzone" +
                  (attachmentDragging ? " is-dragging" : "")
                }
                role="button"
                tabIndex={submitting ? -1 : 0}
                aria-label="Drop files here or browse to attach"
                aria-disabled={submitting}
                onClick={() => !submitting && attachmentInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (submitting) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    attachmentInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!submitting) setAttachmentDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setAttachmentDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setAttachmentDragging(false);
                  if (!submitting) addSelectedAttachments(event.dataTransfer.files);
                }}
              >
                <span className="community-attachment-dropzone-icon" aria-hidden="true">
                  <Paperclip size={17} />
                </span>
                <span>
                  <b>Drag and drop files here</b>
                  <small>PDF, Office documents, text, or images</small>
                </span>
              </div>
              <SelectedAttachmentList
                attachments={selectedAttachments}
                onRemove={removeSelectedAttachment}
                disabled={submitting}
              />
              {submitting && selectedAttachments.length > 0 && (
                <div className="community-attachment-progress-wrap">
                  <div
                    className="community-attachment-progress"
                    role="progressbar"
                    aria-label="Uploading attachments"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={attachmentProgress}
                  >
                    <span style={{ width: `${attachmentProgress}%` }} />
                  </div>
                  <small>
                    {attachmentProgress > 0
                      ? `Uploading attachments · ${attachmentProgress}%`
                      : "Uploading attachments…"}
                  </small>
                </div>
              )}
              {attachmentError && (
                <Alert
                  severity={createdPostId ? "warning" : "error"}
                  onClose={() => setAttachmentError("")}
                  className="community-attachment-error"
                >
                  {attachmentError}
                </Alert>
              )}
            </section>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.is_anonymous}
                  onChange={(event) =>
                    setForm({ ...form, is_anonymous: event.target.checked })
                  }
                />
              }
              label="Post anonymously"
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={closeComposer}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || categories.length === 0}
            >
              {submitting
                ? "Publishing..."
                : form.post_type === "QUESTION"
                  ? "Post question"
                  : "Publish post"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

