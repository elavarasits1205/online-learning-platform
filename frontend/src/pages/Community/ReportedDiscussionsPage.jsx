import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, TextField } from "@mui/material";
import { ArrowLeft, Flag, RefreshCw } from "lucide-react";
import communityApi from "../../service/CommunityApi";
import "./CommunityPage.scss";

const unwrap = (response) => response?.data?.data ?? response?.data ?? {};
const messageOf = (error) => error?.response?.data?.message || error?.message || "Unable to load reported discussions.";
const statuses = ["PENDING", "REVIEWED", "DISMISSED", "ACTION_TAKEN"];

export default function ReportedDiscussionsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await communityApi.getPostReports({ page: 1, limit: 50 });
      const result = unwrap(response);
      setReports(Array.isArray(result) ? result : result.reports ?? []);
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadReports(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  const updateStatus = async (reportId, status) => {
    setUpdatingId(reportId);
    setError("");
    setNotice("");
    try {
      await communityApi.updatePostReportStatus(reportId, { status });
      setReports((current) => current.map((report) =>
        report.id === reportId ? { ...report, status } : report
      ));
      setNotice("Report status updated.");
    } catch (updateError) {
      setError(messageOf(updateError));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Box className="community-page">
      <Button component={Link} to="/community/discussions" startIcon={<ArrowLeft size={16} />}>Back to community</Button>
      <header className="community-hero">
        <div><span className="community-eyebrow">COMMUNITY MODERATION</span><h1>Reported discussions</h1><p>Review posts reported by community members.</p></div>
        <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={loadReports}>Refresh</Button>
      </header>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {loading ? <div className="community-loading"><CircularProgress /></div> : reports.length ? (
        <div className="community-report-list">
          {reports.map((report) => (
            <article className="community-report-card" key={report.id}>
              <div className="community-report-heading">
                <Flag size={18} />
                <div><b>{report.post_title || `Discussion #${report.post_id}`}</b><small>{report.created_at ? new Date(report.created_at).toLocaleString() : ""}</small></div>
                <Chip size="small" label={report.report_type || "OTHER"} />
              </div>
              {report.reason && <p className="community-report-reason">{report.reason}</p>}
              <div className="community-report-footer">
                <Chip size="small" label={String(report.status || "PENDING").replaceAll("_", " ")} />
                {report.post_id && <Button size="small" component={Link} to={`/community/posts/${report.post_id}`}>Open discussion</Button>}
                <TextField select size="small" label="Review status" value={report.status || "PENDING"} disabled={updatingId === report.id} onChange={(event) => updateStatus(report.id, event.target.value)} sx={{ minWidth: 180 }}>
                  {statuses.map((status) => <MenuItem key={status} value={status}>{status.replaceAll("_", " ")}</MenuItem>)}
                </TextField>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="community-empty"><Flag size={24} /><h3>No reported discussions</h3><p>New post reports will appear here.</p></div>
      )}
    </Box>
  );
}
