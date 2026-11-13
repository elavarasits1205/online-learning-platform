
const repo = require("../repositories/community.repository");
const storageService = require("./storage.service");
const path = require("path");
const {
    COMMUNITY_ATTACHMENT_MAX_SIZE,
    COMMUNITY_ATTACHMENT_MAX_FILES,
    COMMUNITY_ATTACHMENT_TYPES
} = require("../middleware/upload.middleware");

function httpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function parseId(value, fieldName) {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw httpError(`Valid ${fieldName} is required.`);
    }

    return id;
}

function parsePage(value, fallback) {
    const parsed = Number.parseInt(value, 10);

    return Number.isInteger(parsed) && parsed > 0
        ? parsed
        : fallback;
}

function attachmentPathFromUrl(value) {
    if (!value || typeof value !== "string") return null;

    try {
        const pathname = new URL(value).pathname;
        const storageMatch = pathname.match(
            /\/storage\/v1\/object\/(?:public|sign|authenticated)\/[^/]+\/(.+)$/
        );
        return storageMatch
            ? decodeURIComponent(storageMatch[1])
            : null;
    } catch {
        return null;
    }
}

function getAttachmentStoragePath(attachment) {
    const storedPath =
        attachment.storage_path ??
        attachment.file_path ??
        attachment.file_storage_path ??
        attachment.storage_object_path ??
        attachment.storage_key ??
        attachment.file_key ??
        attachment.path;
    const rawPath = typeof storedPath === "string"
        ? storedPath
        : attachmentPathFromUrl(
            attachment.file_url ??
            attachment.attachment_url ??
            attachment.public_url ??
            attachment.url
        );

    return typeof rawPath === "string" && rawPath.startsWith("community/posts/")
        ? rawPath
        : null;
}

function mimeTypeForExtension(extension) {
    const mimeByExtension = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".txt": "text/plain",
        ".csv": "text/csv",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    };
    return mimeByExtension[extension] || "application/octet-stream";
}

async function resolveAttachment(attachment) {
    const existingUrl =
        attachment.file_url ??
        attachment.attachment_url ??
        attachment.public_url ??
        attachment.url ??
        null;
    const storagePath = getAttachmentStoragePath(attachment);
    const fileName = String(
        attachment.file_name ??
        attachment.attachment_name ??
        attachment.display_name ??
        attachment.original_file_name ??
        attachment.original_filename ??
        attachment.original_name ??
        attachment.filename ??
        attachment.name ??
        (storagePath ? path.posix.basename(storagePath) : "Attachment")
    );
    const extension = path.extname(fileName).toLowerCase();
    const mimeType = String(
        attachment.mime_type ??
        attachment.file_mime_type ??
        attachment.content_type ??
        attachment.mime ??
        attachment.attachment_type ??
        attachment.file_type ??
        attachment.type ??
        mimeTypeForExtension(extension)
    );
    const signedUrl = storagePath
        ? await storageService.createCommunityAttachmentSignedUrl(storagePath)
        : null;

    return {
        id: attachment.id ?? null,
        post_id: attachment.post_id ?? null,
        file_name: fileName,
        file_url: storagePath ? signedUrl : existingUrl,
        mime_type: mimeType,
        file_size: Number(
            attachment.file_size ??
            attachment.attachment_size ??
            attachment.file_size_in_bytes ??
            attachment.file_size_bytes ??
            attachment.size_bytes ??
            attachment.size ??
            0
        ),
        created_at: attachment.created_at ?? attachment.uploaded_at ?? null
    };
}

async function addAttachmentsToPosts(posts) {
    if (!Array.isArray(posts) || posts.length === 0) return posts;
    const records = await repo.getPostAttachments(posts.map((post) => post.id));
    const byPostId = new Map();

    for (let index = 0; index < records.length; index += 20) {
        const batch = await Promise.all(
            records.slice(index, index + 20).map(async (record) => ({
                postId: String(record.post_id),
                attachment: await resolveAttachment(record)
            }))
        );

        for (const { postId, attachment } of batch) {
            const current = byPostId.get(postId) || [];
            current.push(attachment);
            byPostId.set(postId, current);
        }
    }

    return posts.map((post) => ({
        ...post,
        attachments: byPostId.get(String(post.id)) || []
    }));
}

function validateAttachmentFile(file) {
    const extension = path.extname(String(file?.originalname || "").replace(/\\/g, "/")).toLowerCase();
    const supportedMimeTypes = COMMUNITY_ATTACHMENT_TYPES[extension];

    if (!file || !Buffer.isBuffer(file.buffer) || !supportedMimeTypes?.includes(file.mimetype)) {
        throw httpError("Unsupported file type.");
    }
    if (file.size > COMMUNITY_ATTACHMENT_MAX_SIZE) {
        throw httpError("File is too large. Maximum size is 10 MB.");
    }

    const buffer = file.buffer;
    const startsWith = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
    let signatureIsValid = true;

    if (extension === ".pdf") signatureIsValid = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    else if (extension === ".png") signatureIsValid = startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    else if ([".jpg", ".jpeg"].includes(extension)) signatureIsValid = startsWith(0xff, 0xd8, 0xff);
    else if (extension === ".gif") signatureIsValid = ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
    else if (extension === ".webp") signatureIsValid = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    else if ([".doc", ".ppt", ".xls"].includes(extension)) signatureIsValid = startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    else if ([".docx", ".pptx", ".xlsx"].includes(extension)) signatureIsValid = startsWith(0x50, 0x4b, 0x03, 0x04);
    else if ([".txt", ".csv"].includes(extension)) signatureIsValid = !buffer.includes(0);

    if (!signatureIsValid) throw httpError("Unsupported file type.");

    const rawName = String(file.originalname || "Attachment").replace(/\\/g, "/");
    const fileName = path.posix.basename(rawName)
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .slice(0, 180) || `Attachment${extension}`;

    return {
        ...file,
        fileName,
        extension,
        metadata: {
            originalName: fileName,
            mimeType: file.mimetype,
            size: file.size
        }
    };
}

// ============================================================
// CATEGORIES
// ============================================================

async function getCategories() {
    return repo.getCategories();
}

async function getMentionSuggestions(userId, query = "") {
    const search = String(query || "").trim().replace(/^@/, "");

    if (!search) return [];
    if (search.length > 50) {
        throw httpError("Mention search must not exceed 50 characters.");
    }

    return repo.searchMentionSuggestions(search, userId);
}

function extractMentionUsernames(text = "") {
    const usernames = new Set();
    const expression = /(?:^|[\s(])@([a-zA-Z0-9_.-]{1,100})/g;
    let match;

    while ((match = expression.exec(String(text))) !== null) {
        usernames.add(match[1].toLowerCase());
    }

    return [...usernames].slice(0, 10);
}

async function getMentionedUserIds(userId, text) {
    const usernames = extractMentionUsernames(text);
    if (!usernames.length) return [];

    const users = await repo.findMentionedUsers(usernames, userId);
    return [...new Set(users.map(user => String(user.id)))];
}

// ============================================================
// LIST POSTS
// ============================================================

async function getPosts(query = {}, userId) {
    const page = parsePage(query.page, 1);
    const limit = Math.min(parsePage(query.limit, 10), 50);
    const offset = (page - 1) * limit;

    const conditions = [
        "p.soft_delete = FALSE",
        "p.is_active = TRUE",
        "p.status = 'PUBLISHED'",
        "c.is_active = TRUE",
        "c.soft_delete = FALSE"
    ];

    const values = [];

    // Scope this to the authenticated user passed by the controller.
    if (String(query.mine || "").toLowerCase() === "true") {
        values.push(userId);
        conditions.push(`p.author_user_id = $${values.length}`);
    }

    if (query.author_role) {
        const authorRole = String(query.author_role).trim().toUpperCase();
        if (!["STUDENT", "INSTRUCTOR", "ADMIN"].includes(authorRole)) {
            throw httpError("Invalid author role filter.");
        }

        values.push(authorRole);
        conditions.push(`EXISTS (
            SELECT 1
            FROM olp_auth.user_role post_author_role
            JOIN olp_auth.role post_author_role_name
              ON post_author_role_name.id = post_author_role.role_id
            WHERE post_author_role.user_id = p.author_user_id
              AND post_author_role.is_active = TRUE
              AND post_author_role.soft_delete = FALSE
              AND post_author_role_name.is_active = TRUE
              AND post_author_role_name.soft_delete = FALSE
              AND UPPER(BTRIM(post_author_role_name.code)) = $${values.length}
        )`);
    }

    if (query.category_id) {
        const categoryId = parseId(
            query.category_id,
            "category ID"
        );

        values.push(categoryId);
        conditions.push(`p.category_id = $${values.length}`);
    }

    if (query.search) {
        const search = String(query.search).trim();

        if (search.length > 150) {
            throw httpError("Search text is too long.");
        }

        if (search) {
            values.push(search);

            conditions.push(
                `(p.title ILIKE '%' || $${values.length} || '%'
                  OR p.content ILIKE '%' || $${values.length} || '%')`
            );
        }
    }

    if (query.post_type) {
        const postType = String(query.post_type).toUpperCase();

        if (!["QUESTION", "DISCUSSION", "ANNOUNCEMENT"].includes(postType)) {
            throw httpError("Invalid post type.");
        }

        values.push(postType);
        conditions.push(`p.post_type = $${values.length}`);
    }

    const result = await repo.getPosts({
        conditions,
        values,
        limit,
        offset,
        userId
    });

    result.posts = await addAttachmentsToPosts(result.posts);

    return {
        posts: result.posts,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
        }
    };
}

// ============================================================
// GET POST DETAILS
// ============================================================

async function getPostDetails(postId, userId) {
    const id = parseId(postId, "post ID");

    const post = await repo.findPostById(id, userId);

    if (!post) {
        throw httpError("Community post not found.", 404);
    }

    const [withAttachments] = await addAttachmentsToPosts([post]);
    return withAttachments;
}

// ============================================================
// CREATE POST
// ============================================================

async function createPost(userId, payload = {}) {
    const categoryId = parseId(
        payload.category_id,
        "category ID"
    );

    const title = String(payload.title || "").trim();
    const content = String(payload.content || "").trim();

    const postType = String(
        payload.post_type || "DISCUSSION"
    ).toUpperCase();

    const isAnonymous = payload.is_anonymous === true;

    if (!title || title.length > 300) {
        throw httpError("Title is required and must not exceed 300 characters.");
    }

    if (!content) {
        throw httpError("Post content is required.");
    }

    if (!["QUESTION", "DISCUSSION", "ANNOUNCEMENT"].includes(postType)) {
        throw httpError("Invalid post type.");
    }

    if (postType === "ANNOUNCEMENT") {
        throw httpError("Announcement creation is not enabled for this endpoint.");
    }

    let courseId = null;

    if (payload.course_id !== undefined && payload.course_id !== null && payload.course_id !== "") {
        courseId = parseId(payload.course_id, "course ID");
    }

    const category = await repo.findActiveCategory(categoryId);

    if (!category) {
        throw httpError("Selected community category is not available.", 404);
    }

    const mentionedUserIds = await getMentionedUserIds(userId, content);

    return repo.createPost({
        categoryId,
        userId,
        courseId,
        title,
        content,
        postType,
        isAnonymous,
        mentionedUserIds
    });
}

async function createPostAttachments(userId, postId, files = []) {
    const id = parseId(postId, "post ID");
    if (!Array.isArray(files) || files.length === 0) {
        throw httpError("Select at least one file to upload.");
    }
    if (files.length > COMMUNITY_ATTACHMENT_MAX_FILES) {
        throw httpError("You can attach up to 5 files to a post.");
    }

    const post = await repo.findPostAttachmentTarget(id);
    if (!post) throw httpError("Community post not found.", 404);
    if (String(post.author_user_id) !== String(userId)) {
        throw httpError("You can only attach files to your own post.", 403);
    }

    const validatedFiles = files.map(validateAttachmentFile);
    const uploads = [];

    try {
        for (const file of validatedFiles) {
            const stored = await storageService.uploadCommunityAttachment(file, id);
            uploads.push({
                fileName: file.fileName,
                mimeType: file.mimetype,
                size: file.size,
                extension: file.extension,
                metadata: file.metadata,
                ...stored
            });
        }

        const records = await repo.createPostAttachments({
            postId: id,
            userId,
            attachments: uploads
        });
        return Promise.all(records.map(resolveAttachment));
    } catch (error) {
        await storageService.removeCommunityAttachments(
            uploads.map((upload) => upload.path)
        );
        throw error;
    }
}
// ============================================================
// GET REPLIES
// ============================================================

async function getReplies(postId) {
    const id = parseId(postId, "post ID");

    const post = await repo.findActivePost(id);

    if (!post) {
        throw httpError("Community post not found.", 404);
    }

    return repo.getReplies(id);
}

// ============================================================
// CREATE REPLY
// ============================================================

async function createReply(userId, postId, payload = {}) {
    const id = parseId(postId, "post ID");

    const content = String(payload.content || "").trim();

    if (!content) {
        throw httpError("Reply content is required.");
    }

    const post = await repo.findActivePost(id);

    if (!post) {
        throw httpError("Community post not found.", 404);
    }

    if (post.is_locked) {
        throw httpError("This post is locked. Replies are not allowed.", 400);
    }

    let parentReplyId = null;

    if (
        payload.parent_reply_id !== undefined &&
        payload.parent_reply_id !== null &&
        payload.parent_reply_id !== ""
    ) {
        parentReplyId = parseId(
            payload.parent_reply_id,
            "parent reply ID"
        );

        const parentReply = await repo.getReplies(id);

        const exists = parentReply.some(
            reply => Number(reply.id) === parentReplyId
        );

        if (!exists) {
            throw httpError(
                "Parent reply does not belong to this post.",
                404
            );
        }
    }

    const isAnonymous = payload.is_anonymous === true;
    const mentionedUserIds = await getMentionedUserIds(userId, content);

    return repo.createReply({
        postId: id,
        parentReplyId,
        userId,
        content,
        isAnonymous,
        mentionedUserIds
    });
}
const ALLOWED_REACTIONS = [
    "LIKE",
    "HELPFUL",
    "THANKS",
    "LOVE"
];

function validateReactionType(value) {
    const reactionType = String(value || "").toUpperCase();

    if (!ALLOWED_REACTIONS.includes(reactionType)) {
        throw httpError("Invalid reaction type.");
    }

    return reactionType;
}

async function addPostReaction(userId, postId, payload = {}) {
    const id = parseId(postId, "post ID");
    const reactionType = validateReactionType(payload.reaction_type);

    const post = await repo.findActivePost(id);

    if (!post) {
        throw httpError("Community post not found.", 404);
    }

    return repo.addPostReaction({
        postId: id,
        userId,
        reactionType
    });
}

async function removePostReaction(userId, postId) {
    const id = parseId(postId, "post ID");

    const post = await repo.findActivePost(id);

    if (!post) {
        throw httpError("Community post not found.", 404);
    }

    return repo.removePostReaction(id, userId);
}

async function addReplyReaction(userId, replyId, payload = {}) {
    const id = parseId(replyId, "reply ID");
    const reactionType = validateReactionType(payload.reaction_type);

    const reply = await repo.findActiveReply(id);

    if (!reply) {
        throw httpError("Community reply not found.", 404);
    }

    return repo.addReplyReaction({
        replyId: id,
        userId,
        reactionType
    });
}

async function removeReplyReaction(userId, replyId) {
    const id = parseId(replyId, "reply ID");

    const reply = await repo.findActiveReply(id);

    if (!reply) {
        throw httpError("Community reply not found.", 404);
    }

    return repo.removeReplyReaction(id, userId);
}
// ============================================================
// ADD BOOKMARK
// ============================================================

async function addBookmark(userId, postId) {
    const id = parseId(postId, "post ID");

    const post = await repo.findActivePost(id);

    if (!post) {
        throw httpError("Community post not found.", 404);
    }

    return repo.addBookmark({
        postId: id,
        userId
    });
}

// ============================================================
// REMOVE BOOKMARK
// ============================================================

async function removeBookmark(userId, postId) {
    const id = parseId(postId, "post ID");

    const post = await repo.findActivePost(id);

    if (!post) {
        throw httpError("Community post not found.", 404);
    }

    return repo.removeBookmark(id, userId);
}

// ============================================================
// GET BOOKMARKS
// ============================================================

async function getBookmarks(userId, query = {}, userRoles = []) {
    const page = parsePage(query.page, 1);
    const limit = Math.min(parsePage(query.limit, 10), 50);
    const offset = (page - 1) * limit;
    const authorRole = Array.isArray(userRoles) && userRoles.includes("STUDENT")
        ? "STUDENT"
        : null;

    const result = await repo.getBookmarks(
        userId,
        limit,
        offset,
        authorRole
    );

    result.bookmarks = await addAttachmentsToPosts(result.bookmarks);

    return {
        bookmarks: result.bookmarks,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
        }
    };
}
// ============================================================
// GET NOTIFICATIONS
// ============================================================

async function getNotifications(userId, query = {}) {

    const page = parsePage(query.page, 1);
    const limit = Math.min(
        parsePage(query.limit, 10),
        50
    );

    const offset = (page - 1) * limit;

    const result = await repo.getNotifications(
        userId,
        limit,
        offset
    );

    return {
        notifications: result.notifications,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
        }
    };
}


// ============================================================
// GET UNREAD NOTIFICATION COUNT
// ============================================================

async function getUnreadNotificationCount(userId) {

    return repo.getUnreadNotificationCount(userId);
}


// ============================================================
// MARK NOTIFICATION AS READ
// ============================================================

async function markNotificationAsRead(
    notificationId,
    userId
) {

    const id = parseId(
        notificationId,
        "notification ID"
    );

    const notification =
        await repo.markNotificationAsRead(id, userId);

    if (!notification) {
        throw httpError(
            "Notification not found or already read.",
            404
        );
    }

    return notification;
}


// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================

async function markAllNotificationsAsRead(userId) {

    return repo.markAllNotificationsAsRead(userId);
}
// ============================================================
// REPORT VALIDATION
// ============================================================

const ALLOWED_REPORT_TYPES = [
    "SPAM",
    "ABUSE",
    "HARASSMENT",
    "INAPPROPRIATE",
    "OFF_TOPIC",
    "COPYRIGHT",
    "OTHER"
];

const ALLOWED_REPORT_STATUSES = [
    "PENDING",
    "REVIEWED",
    "DISMISSED",
    "ACTION_TAKEN"
];

function validateReportType(value) {
    const reportType = String(value || "").toUpperCase();

    if (!ALLOWED_REPORT_TYPES.includes(reportType)) {
        throw httpError("Invalid report type.");
    }

    return reportType;
}

function validateReportStatus(value) {
    const status = String(value || "").toUpperCase();

    if (!ALLOWED_REPORT_STATUSES.includes(status)) {
        throw httpError("Invalid report status.");
    }

    return status;
}


// ============================================================
// CREATE POST REPORT
// ============================================================

async function createPostReport(userId, postId, payload = {}) {
    const id = parseId(postId, "post ID");
    const reportType = validateReportType(payload.report_type);
    const reason = payload.reason
        ? String(payload.reason).trim()
        : null;

    const post = await repo.findPostById(id);

    if (!post) {
        throw httpError("Community post not found.", 404);
    }

    if (reason && reason.length > 2000) {
        throw httpError("Report reason must not exceed 2000 characters.");
    }

    return repo.createPostReport({
        postId: id,
        userId,
        reportType,
        reason
    });
}


// ============================================================
// CREATE REPLY REPORT
// ============================================================

async function createReplyReport(userId, replyId, payload = {}) {
    const id = parseId(replyId, "reply ID");
    const reportType = validateReportType(payload.report_type);
    const reason = payload.reason
        ? String(payload.reason).trim()
        : null;

    const reply = await repo.findActiveReply(id);

    if (!reply) {
        throw httpError("Community reply not found.", 404);
    }

    if (reason && reason.length > 2000) {
        throw httpError("Report reason must not exceed 2000 characters.");
    }

    return repo.createReplyReport({
        replyId: id,
        userId,
        reportType,
        reason
    });
}


// ============================================================
// GET POST REPORTS
// ============================================================

async function getPostReports(query = {}) {
    const page = parsePage(query.page, 1);
    const limit = Math.min(parsePage(query.limit, 10), 50);
    const offset = (page - 1) * limit;

    const result = await repo.getPostReports(limit, offset);

    return {
        reports: result.reports,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
        }
    };
}


// ============================================================
// GET REPLY REPORTS
// ============================================================

async function getReplyReports(query = {}) {
    const page = parsePage(query.page, 1);
    const limit = Math.min(parsePage(query.limit, 10), 50);
    const offset = (page - 1) * limit;

    const result = await repo.getReplyReports(limit, offset);

    return {
        reports: result.reports,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
        }
    };
}


// ============================================================
// GET REPORT DETAILS
// ============================================================

async function getPostReportById(reportId) {
    const id = parseId(reportId, "report ID");
    const report = await repo.getPostReportById(id);

    if (!report) {
        throw httpError("Post report not found.", 404);
    }

    return report;
}

async function getReplyReportById(reportId) {
    const id = parseId(reportId, "report ID");
    const report = await repo.getReplyReportById(id);

    if (!report) {
        throw httpError("Reply report not found.", 404);
    }

    return report;
}


// ============================================================
// UPDATE REPORT STATUS
// ============================================================

async function updatePostReportStatus(
    reportId,
    adminId,
    payload = {}
) {
    const id = parseId(reportId, "report ID");
    const status = validateReportStatus(payload.status);

    const reviewComment = payload.review_comment
        ? String(payload.review_comment).trim()
        : null;

    if (reviewComment && reviewComment.length > 2000) {
        throw httpError("Review comment must not exceed 2000 characters.");
    }

    const report = await repo.updatePostReportStatus({
        reportId: id,
        adminId,
        status,
        reviewComment
    });

    if (!report) {
        throw httpError("Post report not found.", 404);
    }

    return report;
}

async function updateReplyReportStatus(
    reportId,
    adminId,
    payload = {}
) {
    const id = parseId(reportId, "report ID");
    const status = validateReportStatus(payload.status);

    const reviewComment = payload.review_comment
        ? String(payload.review_comment).trim()
        : null;

    if (reviewComment && reviewComment.length > 2000) {
        throw httpError("Review comment must not exceed 2000 characters.");
    }

    const report = await repo.updateReplyReportStatus({
        reportId: id,
        adminId,
        status,
        reviewComment
    });

    if (!report) {
        throw httpError("Reply report not found.", 404);
    }

    return report;
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
