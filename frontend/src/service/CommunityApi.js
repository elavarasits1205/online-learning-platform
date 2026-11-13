import api from "./Api";

// Community endpoints use the existing Axios instance so JWT refresh,
// Authorization headers, and the configured API base URL are reused.
const communityApi = {
  getCategories: () => api.get("/community/categories"),
  getMentionSuggestions: (q) => api.get("/community/mentions/suggestions", { params: { q } }),
  getPosts: (params = {}) => api.get("/community/posts", { params }),
  getPost: (postId) => api.get(`/community/posts/${postId}`),
  createPost: (payload) => api.post("/community/posts", payload),
  uploadPostAttachments: (postId, files, onUploadProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("attachments", file));
    return api.post(`/community/posts/${postId}/attachments`, formData, {
      onUploadProgress,
    });
  },
  getReplies: (postId) => api.get(`/community/posts/${postId}/replies`),
  createReply: (postId, payload) => api.post(`/community/posts/${postId}/replies`, payload),
  addPostReaction: (postId, payload) => api.post(`/community/posts/${postId}/reactions`, payload),
  removePostReaction: (postId) => api.delete(`/community/posts/${postId}/reactions`),
  addReplyReaction: (replyId, payload) => api.post(`/community/replies/${replyId}/reactions`, payload),
  removeReplyReaction: (replyId) => api.delete(`/community/replies/${replyId}/reactions`),
  addBookmark: (postId) => api.post(`/community/posts/${postId}/bookmark`),
  removeBookmark: (postId) => api.delete(`/community/posts/${postId}/bookmark`),
  getBookmarks: (params = {}) => api.get("/community/bookmarks", { params }),
  getNotifications: (params = {}) => api.get("/community/notifications", { params }),
  getUnreadCount: () => api.get("/community/notifications/unread-count"),
  markRead: (id) => api.patch(`/community/notifications/${id}/read`),
  markAllRead: () => api.patch("/community/notifications/read-all"),
  reportPost: (id, payload) => api.post(`/community/posts/${id}/report`, payload),
  reportReply: (id, payload) => api.post(`/community/replies/${id}/report`, payload),
  getPostReports: (params = {}) => api.get("/community/reports/posts", { params }),
  getReplyReports: (params = {}) => api.get("/community/reports/replies", { params }),
  getPostReport: (reportId) => api.get(`/community/reports/posts/${reportId}`),
  getReplyReport: (reportId) => api.get(`/community/reports/replies/${reportId}`),
  updatePostReportStatus: (reportId, payload) => api.patch(`/community/reports/posts/${reportId}/status`, payload),
  updateReplyReportStatus: (reportId, payload) => api.patch(`/community/reports/replies/${reportId}/status`, payload),
};

export default communityApi;
