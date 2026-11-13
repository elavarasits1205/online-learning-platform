
const communityService = require("../services/community.service");

async function getCategories(req, res, next) {
    try {
        const categories = await communityService.getCategories();

        return res.status(200).json({
            success: true,
            data: { categories }
        });
    } catch (error) {
        return next(error);
    }
}

async function getMentionSuggestions(req, res, next) {
    try {
        const suggestions = await communityService.getMentionSuggestions(
            req.user.id,
            req.query.q
        );

        return res.status(200).json({
            success: true,
            data: { suggestions }
        });
    } catch (error) {
        return next(error);
    }
}

async function getPosts(req, res, next) {
    try {
        const query = { ...req.query };
        if (Array.isArray(req.user.roles) && req.user.roles.includes("STUDENT")) {
            query.author_role = "STUDENT";
        }

        const data = await communityService.getPosts(
            query,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        return next(error);
    }
}

async function getPostDetails(req, res, next) {
    try {
        const post = await communityService.getPostDetails(
            req.params.postId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: { post }
        });
    } catch (error) {
        return next(error);
    }
}

async function createPost(req, res, next) {
    try {
        const post = await communityService.createPost(
            req.user.id,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "Community post created successfully.",
            data: { post }
        });
    } catch (error) {
        return next(error);
    }
}

async function createPostAttachments(req, res, next) {
    try {
        const attachments = await communityService.createPostAttachments(
            req.user.id,
            req.params.postId,
            req.files || []
        );

        return res.status(201).json({
            success: true,
            message: "Post attachments uploaded successfully.",
            data: { attachments }
        });
    } catch (error) {
        return next(error);
    }
}
// ============================================================
// GET REPLIES
// ============================================================

async function getReplies(req, res, next) {
    try {
        const replies = await communityService.getReplies(
            req.params.postId
        );

        return res.status(200).json({
            success: true,
            data: { replies }
        });

    } catch (error) {
        return next(error);
    }
}

// ============================================================
// CREATE REPLY
// ============================================================

async function createReply(req, res, next) {
    try {
        const reply = await communityService.createReply(
            req.user.id,
            req.params.postId,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "Reply created successfully.",
            data: { reply }
        });

    } catch (error) {
        return next(error);
    }
}

async function addPostReaction(req, res, next) {
    try {
        const reaction = await communityService.addPostReaction(
            req.user.id,
            req.params.postId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Post reaction saved successfully.",
            data: { reaction }
        });
    } catch (error) {
        return next(error);
    }
}

async function removePostReaction(req, res, next) {
    try {
        const removed = await communityService.removePostReaction(
            req.user.id,
            req.params.postId
        );

        return res.status(200).json({
            success: true,
            message: removed
                ? "Post reaction removed successfully."
                : "No active reaction found.",
            data: { removed }
        });
    } catch (error) {
        return next(error);
    }
}

async function addReplyReaction(req, res, next) {
    try {
        const reaction = await communityService.addReplyReaction(
            req.user.id,
            req.params.replyId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Reply reaction saved successfully.",
            data: { reaction }
        });
    } catch (error) {
        return next(error);
    }
}

async function removeReplyReaction(req, res, next) {
    try {
        const removed = await communityService.removeReplyReaction(
            req.user.id,
            req.params.replyId
        );

        return res.status(200).json({
            success: true,
            message: removed
                ? "Reply reaction removed successfully."
                : "No active reaction found.",
            data: { removed }
        });
    } catch (error) {
        return next(error);
    }
}
async function addBookmark(req, res, next) {
    try {
        const result = await communityService.addBookmark(
            req.user.id,
            req.params.postId
        );

        return res.status(200).json({
            success: true,
            message: result.alreadyBookmarked
                ? "Post is already bookmarked."
                : "Post bookmarked successfully.",
            data: result
        });
    } catch (error) {
        return next(error);
    }
}

async function removeBookmark(req, res, next) {
    try {
        const removed = await communityService.removeBookmark(
            req.user.id,
            req.params.postId
        );

        return res.status(200).json({
            success: true,
            message: removed
                ? "Bookmark removed successfully."
                : "Bookmark not found.",
            data: { removed }
        });
    } catch (error) {
        return next(error);
    }
}

async function getBookmarks(req, res, next) {
    try {
        const data = await communityService.getBookmarks(
            req.user.id,
            req.query,
            req.user.roles
        );

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        return next(error);
    }
}


// ============================================================
// GET NOTIFICATIONS
// ============================================================

async function getNotifications(req, res, next) {

    try {

        const data = await communityService.getNotifications(
            req.user.id,
            req.query
        );

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        return next(error);
    }
}


// ============================================================
// GET UNREAD COUNT
// ============================================================

async function getUnreadNotificationCount(req, res, next) {

    try {

        const unreadCount =
            await communityService.getUnreadNotificationCount(
                req.user.id
            );

        return res.status(200).json({
            success: true,
            data: {
                unread_count: unreadCount
            }
        });

    } catch (error) {
        return next(error);
    }
}


// ============================================================
// MARK ONE AS READ
// ============================================================

async function markNotificationAsRead(req, res, next) {

    try {

        const notification =
            await communityService.markNotificationAsRead(
                req.params.notificationId,
                req.user.id
            );

        return res.status(200).json({
            success: true,
            message: "Notification marked as read.",
            data: {
                notification
            }
        });

    } catch (error) {
        return next(error);
    }
}


// ============================================================
// MARK ALL AS READ
// ============================================================

async function markAllNotificationsAsRead(req, res, next) {

    try {

        const updatedCount =
            await communityService.markAllNotificationsAsRead(
                req.user.id
            );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read.",
            data: {
                updated_count: updatedCount
            }
        });

    } catch (error) {
        return next(error);
    }
}
// ============================================================
// CREATE POST REPORT
// ============================================================

async function createPostReport(req, res, next) {
    try {
        const report = await communityService.createPostReport(
            req.user.id,
            req.params.postId,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "Post reported successfully.",
            data: { report }
        });
    } catch (error) {
        return next(error);
    }
}


// ============================================================
// CREATE REPLY REPORT
// ============================================================

async function createReplyReport(req, res, next) {
    try {
        const report = await communityService.createReplyReport(
            req.user.id,
            req.params.replyId,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "Reply reported successfully.",
            data: { report }
        });
    } catch (error) {
        return next(error);
    }
}


// ============================================================
// GET POST REPORTS
// ============================================================

async function getPostReports(req, res, next) {
    try {
        const data = await communityService.getPostReports(req.query);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        return next(error);
    }
}


// ============================================================
// GET REPLY REPORTS
// ============================================================

async function getReplyReports(req, res, next) {
    try {
        const data = await communityService.getReplyReports(req.query);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        return next(error);
    }
}


// ============================================================
// GET REPORT DETAILS
// ============================================================

async function getPostReportById(req, res, next) {
    try {
        const report = await communityService.getPostReportById(
            req.params.reportId
        );

        return res.status(200).json({
            success: true,
            data: { report }
        });
    } catch (error) {
        return next(error);
    }
}

async function getReplyReportById(req, res, next) {
    try {
        const report = await communityService.getReplyReportById(
            req.params.reportId
        );

        return res.status(200).json({
            success: true,
            data: { report }
        });
    } catch (error) {
        return next(error);
    }
}


// ============================================================
// UPDATE REPORT STATUS
// ============================================================

async function updatePostReportStatus(req, res, next) {
    try {
        const report = await communityService.updatePostReportStatus(
            req.params.reportId,
            req.user.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Post report status updated successfully.",
            data: { report }
        });
    } catch (error) {
        return next(error);
    }
}

async function updateReplyReportStatus(req, res, next) {
    try {
        const report = await communityService.updateReplyReportStatus(
            req.params.reportId,
            req.user.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Reply report status updated successfully.",
            data: { report }
        });
    } catch (error) {
        return next(error);
    }
}
module.exports = {
    getCategories,
    getMentionSuggestions,
    getPosts,
    getPostDetails,
    createPost,
    createPostAttachments,
    getReplies,
    createReply,
    addPostReaction,
    removePostReaction,
    addReplyReaction,
    addReplyReaction,
    removeReplyReaction,
    addBookmark,
    removeBookmark,
    getBookmarks,
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
markAllNotificationsAsRead,
createPostReport,
createReplyReport,
getPostReports,
getReplyReports,
getPostReportById,
getReplyReportById,
updatePostReportStatus,
updateReplyReportStatus

};
