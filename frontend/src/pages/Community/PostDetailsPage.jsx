import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  TextField,
} from "@mui/material";
import { ArrowLeft, MessageCircle, Flag, ThumbsUp } from "lucide-react";
import communityApi from "../../service/CommunityApi";
import { getAuthUser } from "../../utils/authCookie";
import MentionTextField from "./MentionTextField";
import "./CommunityPage.scss";

const unwrap = (response) => response?.data?.data ?? response?.data ?? {};
const errorText = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Unable to load this discussion.";

function authorLabel(item) {
  if (item?.is_anonymous) return "Anonymous learner";
  return item?.author_name || "Community member";
}

export default function PostDetailsPage() {
  const { postId } = useParams();
  const location = useLocation();
  const backTo = location.pathname.startsWith("/community/my-discussions/")
    ? "/community/my-discussions"
    : "/community/discussions";
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [content, setContent] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [reportType, setReportType] = useState("INAPPROPRIATE");
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reacted, setReacted] = useState(false);
  const user = getAuthUser();
  const userId = user?.id ?? user?.user_id ?? user?.user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [postResponse, repliesResponse] = await Promise.all([
        communityApi.getPost(postId),
        communityApi.getReplies(postId),
      ]);
      const postPayload = unwrap(postResponse);
      const repliesPayload = unwrap(repliesResponse);
      setPost(postPayload.post ?? postPayload);
      setReacted(Boolean((postPayload.post ?? postPayload).is_reacted));
      setReplies(
        Array.isArray(repliesPayload)
          ? repliesPayload
          : repliesPayload.replies ?? []
      );
    } catch (e) {
      setError(errorText(e));
      setPost(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const repliesByParent = useMemo(() => {
    const grouped = new Map();
    replies.forEach((reply) => {
      const parentKey =
        reply.parent_reply_id === null || reply.parent_reply_id === undefined
          ? "root"
          : String(reply.parent_reply_id);
      if (!grouped.has(parentKey)) grouped.set(parentKey, []);
      grouped.get(parentKey).push(reply);
    });
    return grouped;
  }, [replies]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const payload = {
        content: content.trim(),
        is_anonymous: isAnonymous,
      };
      if (replyTarget) payload.parent_reply_id = replyTarget.id;
      await communityApi.createReply(postId, payload);
      setContent("");
      setIsAnonymous(false);
      setReplyTarget(null);
      setNotice(replyTarget ? "Your reply was posted." : "Your comment was posted.");
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSubmitting(false);
    }
  };

  const locked =
    Boolean(post?.is_locked) ||
    String(post?.status || "").toUpperCase() === "CLOSED";

  const togglePostReaction = async () => {
    try {
      if (reacted) await communityApi.removePostReaction(post.id);
      else await communityApi.addPostReaction(post.id, { reaction_type: "LIKE" });
      setReacted(!reacted);
      setPost((current) => ({ ...current, reaction_count: Math.max(0, Number(current.reaction_count || 0) + (reacted ? -1 : 1)) }));
    } catch (e) { setError(errorText(e)); }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!reportTarget) return;
    setReporting(true);
    try {
      if (reportTarget.type === "post") await communityApi.reportPost(reportTarget.id, { report_type: reportType, reason: reportReason });
      else await communityApi.reportReply(reportTarget.id, { report_type: reportType, reason: reportReason });
      setReportTarget(null);
      setReportReason("");
      setNotice("Thanks. Your report was sent to the community moderation team.");
    } catch (e) { setError(errorText(e)); }
    finally { setReporting(false); }
  };

  const renderReply = (reply, depth = 0) => {
    const children = repliesByParent.get(String(reply.id)) ?? [];
    return (
      <Box
        component="article"
        className="community-reply"
        key={reply.id}
        sx={{ ml: Math.min(depth, 4) * 3 }}
      >
        <Avatar>{authorLabel(reply).charAt(0).toUpperCase()}</Avatar>
        <div className="community-reply-body">
          <b>{authorLabel(reply)}</b>
          <p>{reply.content}</p>
          <div className="community-reply-meta">
            <small>
              {reply.created_at
                ? new Date(reply.created_at).toLocaleString()
                : ""}
            </small>
            {!locked && (
              <Button
                size="small"
                onClick={() =>
                  setReplyTarget({
                    id: reply.id,
                    author: authorLabel(reply),
                  })
                }
              >
                Reply
              </Button>
            )}
            <Button size="small" startIcon={<Flag size={15} />} onClick={() => setReportTarget({ type: "reply", id: reply.id })}>Report</Button>
          </div>
          {children.length > 0 && (
            <div className="community-reply-thread">
              {children.map((child) => renderReply(child, depth + 1))}
            </div>
          )}
        </div>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box className="community-loading" role="status">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="community-page community-detail">
      <Button
        component={Link}
        to={backTo}
        startIcon={<ArrowLeft size={16} />}
      >
        Back to community
      </Button>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}
      {post ? (
        <>
          <article className="community-post community-detail-post">
            <div className="community-post-top">
              <Avatar>{authorLabel(post).charAt(0).toUpperCase()}</Avatar>
              <div>
                <b>{authorLabel(post)}</b>
                <small>
                  {post.created_at
                    ? new Date(post.created_at).toLocaleString()
                    : ""}
                </small>
              </div>
              <span className="community-post-type">
                {post.post_type === "QUESTION" ? "Question" : "Discussion"}
              </span>
            </div>
            <h1>{post.title}</h1>
            <p className="community-post-content">{post.content}</p>
            {post.category_name && (
              <span className="community-post-category">
                {post.category_name}
              </span>
            )}
            <div className="community-detail-actions">
              <Button size="small" startIcon={<ThumbsUp size={16} />} onClick={togglePostReaction} color={reacted ? "primary" : "inherit"}>
                {Number(post.reaction_count || 0)} {reacted ? "Liked" : "Like"}
              </Button>
              {String(post.author_user_id) !== String(userId) && <Button size="small" startIcon={<Flag size={15} />} onClick={() => setReportTarget({ type: "post", id: post.id })}>Report discussion</Button>}
            </div>
          </article>

          <section className="community-replies">
            <h2>
              <MessageCircle size={20} />
              Comments and answers ({replies.length})
            </h2>
            {replies.length ? (
              <div className="community-reply-list">
                {(repliesByParent.get("root") ?? []).map((reply) =>
                  renderReply(reply)
                )}
              </div>
            ) : (
              <div className="community-empty community-empty-comments">
                <h3>No comments yet</h3>
                <p>Share an answer or ask for more detail.</p>
              </div>
            )}
          </section>

          {locked ? (
            <Alert severity="info" className="community-locked-note">
              This discussion is closed, so new comments are turned off.
            </Alert>
          ) : (
            <form className="community-reply-form" onSubmit={submit}>
              {replyTarget && (
                <div className="community-reply-form-header">
                  <span>Replying to {replyTarget.author}</span>
                  <Button size="small" onClick={() => setReplyTarget(null)}>
                    Cancel reply
                  </Button>
                </div>
              )}
              <MentionTextField
                fullWidth
                required
                minRows={3}
                label={
                  replyTarget
                    ? "Write a reply"
                    : post.post_type === "QUESTION"
                      ? "Write an answer or comment"
                      : "Write a comment"
                }
                placeholder="Type @ to mention a community member."
                value={content}
                onChange={setContent}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isAnonymous}
                    onChange={(event) => setIsAnonymous(event.target.checked)}
                  />
                }
                label="Comment anonymously"
              />
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting
                  ? "Posting..."
                  : replyTarget
                    ? "Post reply"
                    : "Post comment"}
              </Button>
            </form>
          )}
        </>
      ) : (
        !loading && (
          <div className="community-empty community-post-missing">
            <h2>Discussion unavailable</h2>
            <p>{error || "This post may have been removed."}</p>
            <Button component={Link} to={backTo} variant="contained">
              Return to community
            </Button>
          </div>
        )
      )}
      <Dialog open={Boolean(reportTarget)} onClose={() => !reporting && setReportTarget(null)} fullWidth maxWidth="xs">
        <form onSubmit={submitReport}>
          <DialogTitle>Report {reportTarget?.type === "reply" ? "comment" : "discussion"}</DialogTitle>
          <DialogContent className="community-form">
            <TextField select label="Reason" value={reportType} onChange={(event) => setReportType(event.target.value)}>
              {["SPAM", "ABUSE", "HARASSMENT", "INAPPROPRIATE", "OFF_TOPIC", "COPYRIGHT", "OTHER"].map((item) => <MenuItem key={item} value={item}>{item.replaceAll("_", " ")}</MenuItem>)}
            </TextField>
            <TextField label="Details (optional)" multiline minRows={3} value={reportReason} onChange={(event) => setReportReason(event.target.value)} inputProps={{ maxLength: 2000 }} />
          </DialogContent>
          <DialogActions><Button onClick={() => setReportTarget(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={reporting}>{reporting ? "Sending…" : "Send report"}</Button></DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

