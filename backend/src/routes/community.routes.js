const express = require("express");

const {
    authenticate,
    requirePermission
} = require("../middleware/auth.middleware");

const communityController = require("../controller/community.controller");
const { uploadCommunityAttachments } = require("../middleware/upload.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Community
 *   description: Community discussion and post management APIs
 */

/**
 * @swagger
 * /api/community/categories:
 *   get:
 *     summary: Get all community categories
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 */
router.get(
    "/categories",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.getCategories
);

/**
 * @swagger
 * /api/community/mentions/suggestions:
 *   get:
 *     summary: Search community members to mention
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching community members retrieved
 */
router.get(
    "/mentions/suggestions",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.getMentionSuggestions
);

/**
 * @swagger
 * /api/community/posts:
 *   get:
 *     summary: Get community posts
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of posts per page
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter posts by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search posts by title or content
 *       - in: query
 *         name: postType
 *         schema:
 *           type: string
 *           enum: [QUESTION, DISCUSSION, ANNOUNCEMENT]
 *         description: Filter by post type
 *       - in: query
 *         name: author_role
 *         schema:
 *           type: string
 *           enum: [STUDENT, INSTRUCTOR, ADMIN]
 *         description: Filter discussions by the author's role
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 */
router.get(
    "/posts",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.getPosts
);

/**
 * @swagger
 * /api/community/posts/{postId}:
 *   get:
 *     summary: Get community post details
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Community post ID
 *     responses:
 *       200:
 *         description: Post details retrieved successfully
 *       404:
 *         description: Post not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 */
router.get(
    "/posts/:postId",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.getPostDetails
);

/**
 * @swagger
 * /api/community/posts:
 *   post:
 *     summary: Create a community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryId
 *               - title
 *               - content
 *             properties:
 *               categoryId:
 *                 type: integer
 *                 example: 1
 *               courseId:
 *                 type: integer
 *                 nullable: true
 *                 example: 10
 *               title:
 *                 type: string
 *                 example: How to learn React hooks?
 *               content:
 *                 type: string
 *                 example: I need help understanding useEffect and useState.
 *               postType:
 *                 type: string
 *                 enum: [QUESTION, DISCUSSION]
 *                 example: QUESTION
 *               isAnonymous:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 */
router.post(
    "/posts",
    authenticate,
    requirePermission("DISCUSSION_CREATE"),
    communityController.createPost
);

/**
 * @swagger
 * /api/community/posts/{postId}/attachments:
 *   post:
 *     summary: Upload attachments to a community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [attachments]
 *             properties:
 *               attachments:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Attachments uploaded and linked to the post
 *       400:
 *         description: Invalid file, unsupported type, or file too large
 *       403:
 *         description: Permission denied or post is not owned by the requester
 */
router.post(
    "/posts/:postId/attachments",
    authenticate,
    requirePermission("DISCUSSION_CREATE"),
    uploadCommunityAttachments,
    communityController.createPostAttachments
);
/**
 * @swagger
 * /api/community/posts/{postId}/replies:
 *   get:
 *     summary: Get replies for a community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Replies retrieved successfully
 *       404:
 *         description: Post not found
 */
router.get(
    "/posts/:postId/replies",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.getReplies
);

/**
 * @swagger
 * /api/community/posts/{postId}/replies:
 *   post:
 *     summary: Create a reply or nested reply
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: React hooks are useful for managing state.
 *               parent_reply_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               is_anonymous:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Reply created successfully
 *       400:
 *         description: Invalid reply
 *       404:
 *         description: Post or parent reply not found
 */
router.post(
    "/posts/:postId/replies",
    authenticate,
    requirePermission("DISCUSSION_CREATE"),
    communityController.createReply
);
/**
 * @swagger
 * /api/community/posts/{postId}/reactions:
 *   post:
 *     summary: Add or update post reaction
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reaction_type
 *             properties:
 *               reaction_type:
 *                 type: string
 *                 enum: [LIKE, HELPFUL, THANKS, LOVE]
 *     responses:
 *       200:
 *         description: Reaction saved
 *       409:
 *         description: Duplicate reaction
 */
router.post(
    "/posts/:postId/reactions",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.addPostReaction
);

/**
 * @swagger
 * /api/community/posts/{postId}/reactions:
 *   delete:
 *     summary: Remove post reaction
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reaction removed
 */
router.delete(
    "/posts/:postId/reactions",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.removePostReaction
);

/**
 * @swagger
 * /api/community/replies/{replyId}/reactions:
 *   post:
 *     summary: Add or update reply reaction
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reaction_type
 *             properties:
 *               reaction_type:
 *                 type: string
 *                 enum: [LIKE, HELPFUL, THANKS, LOVE]
 *     responses:
 *       200:
 *         description: Reaction saved
 */
router.post(
    "/replies/:replyId/reactions",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.addReplyReaction
);

/**
 * @swagger
 * /api/community/replies/{replyId}/reactions:
 *   delete:
 *     summary: Remove reply reaction
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reaction removed
 */
router.delete(
    "/replies/:replyId/reactions",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.removeReplyReaction
);
/**
 * @swagger
 * /api/community/posts/{postId}/bookmark:
 *   post:
 *     summary: Bookmark a community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bookmark saved
 */
router.post(
    "/posts/:postId/bookmark",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.addBookmark
);

/**
 * @swagger
 * /api/community/posts/{postId}/bookmark:
 *   delete:
 *     summary: Remove a post bookmark
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bookmark removed
 */
router.delete(
    "/posts/:postId/bookmark",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.removeBookmark
);

/**
 * @swagger
 * /api/community/bookmarks:
 *   get:
 *     summary: Get logged-in user's bookmarked posts
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Bookmarks retrieved
 */
router.get(
    "/bookmarks",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.getBookmarks
);
/**
 * @swagger
 * /api/community/notifications:
 *   get:
 *     summary: Get logged-in user's notifications
 *     tags: [Community Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Number of notifications per page
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 */
router.get(
    "/notifications",
    authenticate,
    communityController.getNotifications
);
/**
 * @swagger
 * /api/community/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Community Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     unread_count:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 */
router.get(
    "/notifications/unread-count",
    authenticate,
    communityController.getUnreadNotificationCount
);
/**
 * @swagger
 * /api/community/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Community Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 */
router.patch(
    "/notifications/read-all",
    authenticate,
    communityController.markAllNotificationsAsRead
);
/**
 * @swagger
 * /api/community/notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Community Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Notification not found or already read
 */
router.patch(
    "/notifications/:notificationId/read",
    authenticate,
    communityController.markNotificationAsRead
);
// ============================================================
// COMMUNITY REPORTS
// ============================================================

/**
 * @swagger
 * /api/community/posts/{postId}/report:
 *   post:
 *     summary: Report a community post
 *     tags: [Community Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - report_type
 *             properties:
 *               report_type:
 *                 type: string
 *                 enum: [SPAM, ABUSE, HARASSMENT, INAPPROPRIATE, OFF_TOPIC, COPYRIGHT, OTHER]
 *                 example: SPAM
 *               reason:
 *                 type: string
 *                 example: This post contains spam content.
 *     responses:
 *       201:
 *         description: Post reported successfully
 *       404:
 *         description: Post not found
 *       409:
 *         description: Post already reported by this user
 */
router.post(
    "/posts/:postId/report",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.createPostReport
);


/**
 * @swagger
 * /api/community/replies/{replyId}/report:
 *   post:
 *     summary: Report a community reply
 *     tags: [Community Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - report_type
 *             properties:
 *               report_type:
 *                 type: string
 *                 enum: [SPAM, ABUSE, HARASSMENT, INAPPROPRIATE, OFF_TOPIC, COPYRIGHT, OTHER]
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reply reported successfully
 *       404:
 *         description: Reply not found
 *       409:
 *         description: Reply already reported by this user
 */
router.post(
    "/replies/:replyId/report",
    authenticate,
    requirePermission("COMMUNITY_VIEW"),
    communityController.createReplyReport
);


/**
 * @swagger
 * /api/community/reports/posts:
 *   get:
 *     summary: Get all post reports
 *     tags: [Community Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Post reports retrieved successfully
 */
router.get(
    "/reports/posts",
    authenticate,
    requirePermission("COMMUNITY_REPORT_VIEW"),
    communityController.getPostReports
);


/**
 * @swagger
 * /api/community/reports/replies:
 *   get:
 *     summary: Get all reply reports
 *     tags: [Community Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Reply reports retrieved successfully
 */
router.get(
    "/reports/replies",
    authenticate,
    requirePermission("COMMUNITY_REPORT_VIEW"),
    communityController.getReplyReports
);


/**
 * @swagger
 * /api/community/reports/posts/{reportId}:
 *   get:
 *     summary: Get post report details
 *     tags: [Community Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Report details retrieved
 *       404:
 *         description: Report not found
 */
router.get(
    "/reports/posts/:reportId",
    authenticate,
    requirePermission("COMMUNITY_REPORT_VIEW"),
    communityController.getPostReportById
);


/**
 * @swagger
 * /api/community/reports/replies/{reportId}:
 *   get:
 *     summary: Get reply report details
 *     tags: [Community Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Report details retrieved
 *       404:
 *         description: Report not found
 */
router.get(
    "/reports/replies/:reportId",
    authenticate,
    requirePermission("COMMUNITY_REPORT_VIEW"),
    communityController.getReplyReportById
);


/**
 * @swagger
 * /api/community/reports/posts/{reportId}/status:
 *   patch:
 *     summary: Update post report status
 *     tags: [Community Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, REVIEWED, DISMISSED, ACTION_TAKEN]
 *                 example: ACTION_TAKEN
 *               review_comment:
 *                 type: string
 *                 example: Content violates community guidelines.
 *     responses:
 *       200:
 *         description: Report status updated
 *       404:
 *         description: Report not found
 */
router.patch(
    "/reports/posts/:reportId/status",
    authenticate,
    requirePermission("COMMUNITY_REPORT_UPDATE"),
    communityController.updatePostReportStatus
);


/**
 * @swagger
 * /api/community/reports/replies/{reportId}/status:
 *   patch:
 *     summary: Update reply report status
 *     tags: [Community Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, REVIEWED, DISMISSED, ACTION_TAKEN]
 *               review_comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report status updated
 *       404:
 *         description: Report not found
 */
router.patch(
    "/reports/replies/:reportId/status",
    authenticate,
    requirePermission("COMMUNITY_REPORT_UPDATE"),
    communityController.updateReplyReportStatus
);

module.exports = router;
