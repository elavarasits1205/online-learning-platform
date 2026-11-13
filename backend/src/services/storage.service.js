
const supabase = require("../config/supabase");
const { randomUUID } = require("crypto");
const LESSON_VIDEO_BUCKET = "lesson-videos";

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

const INSTITUTION_LOGO_BUCKET =
    process.env.INSTITUTION_LOGO_BUCKET || "course-thumbnails";

async function uploadCourseThumbnail(file, courseId) {
    if (!file) {
        const error = new Error("Please select a thumbnail image.");
        error.statusCode = 400;
        throw error;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        const error = new Error("Only JPEG, PNG, and WebP images are allowed.");
        error.statusCode = 400;
        throw error;
    }

    if (file.size > 5 * 1024 * 1024) {
        const error = new Error("Thumbnail must not exceed 5 MB.");
        error.statusCode = 400;
        throw error;
    }

    const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    };

    const filePath =
        `courses/${courseId}/thumbnail-${Date.now()}.${extensions[file.mimetype]}`;

    const { data, error } = await supabase.storage
        .from("course-thumbnails")
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) {
        const uploadError = new Error(error.message);
        uploadError.statusCode = 502;
        throw uploadError;
    }

    const { data: publicData } = supabase.storage
        .from("course-thumbnails")
        .getPublicUrl(data.path);

    return {
        path: data.path,
        publicUrl: publicData.publicUrl,
    };
}

async function uploadInstitutionLogo(file) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
        const error = new Error("Please select an institution logo image.");
        error.statusCode = 400;
        throw error;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        const error = new Error("Only JPEG, PNG, and WebP images are allowed.");
        error.statusCode = 400;
        throw error;
    }

    if (file.buffer.length > 5 * 1024 * 1024) {
        const error = new Error("Institution logo must not exceed 5 MB.");
        error.statusCode = 400;
        throw error;
    }

    const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    };
    const filePath = `institutions/${randomUUID()}.${extensions[file.mimetype]}`;

    let data;
    let error;

    try {
        ({ data, error } = await supabase.storage
            .from(INSTITUTION_LOGO_BUCKET)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: "3600",
                upsert: false,
            }));
    } catch (cause) {
        const uploadError = new Error("Institution logo upload failed.");
        uploadError.statusCode = 502;
        uploadError.cause = cause;
        throw uploadError;
    }

    if (error) {
        const uploadError = new Error("Institution logo upload failed.");
        uploadError.statusCode = 502;
        uploadError.cause = error;
        throw uploadError;
    }

    const { data: publicData } = supabase.storage
        .from(INSTITUTION_LOGO_BUCKET)
        .getPublicUrl(data.path);

    return {
        path: data.path,
        publicUrl: publicData.publicUrl,
    };
}

async function removeInstitutionLogo(filePath) {
    if (typeof filePath !== "string" || !filePath.startsWith("institutions/")) {
        return;
    }

    const { error } = await supabase.storage
        .from(INSTITUTION_LOGO_BUCKET)
        .remove([filePath]);

    if (error) {
        console.error("Failed to remove unused institution logo:", error.message);
    }
}

async function uploadProfileImage(file, userId) {
    if (!file) {
        const error = new Error("Please select a profile image.");
        error.statusCode = 400;
        throw error;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        const error = new Error("Only JPEG, PNG, and WebP images are allowed.");
        error.statusCode = 400;
        throw error;
    }

    if (file.size > 5 * 1024 * 1024) {
        const error = new Error("Profile image must not exceed 5 MB.");
        error.statusCode = 400;
        throw error;
    }

    const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    };
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, "");

    if (!safeUserId) {
        const error = new Error("A valid student account is required.");
        error.statusCode = 400;
        throw error;
    }

    const filePath =
        `profiles/students/${safeUserId}/profile-${Date.now()}.${extensions[file.mimetype]}`;
    const { data, error } = await supabase.storage
        .from("course-thumbnails")
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) {
        const uploadError = new Error(error.message);
        uploadError.statusCode = 502;
        throw uploadError;
    }

    const { data: publicData } = supabase.storage
        .from("course-thumbnails")
        .getPublicUrl(data.path);

    return {
        path: data.path,
        publicUrl: publicData.publicUrl,
    };
}

async function removeStoredImage(filePath) {
    const { error } = await supabase.storage
        .from("course-thumbnails")
        .remove([filePath]);

    if (error) {
        console.error(
            "Failed to remove unused course thumbnail:",
            error.message
        );
    }
}

async function removeCourseThumbnail(filePath) {
    return removeStoredImage(filePath);
}

async function uploadLessonVideo(file, moduleId) {
  if (!file) {
    const error = new Error("Please select a lesson video.");
    error.statusCode = 400;
    throw error;
  }

  const allowedTypes = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error("Unsupported video format.");
    error.statusCode = 400;
    throw error;
  }

  const extensions = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };

  const filePath =
    `modules/${moduleId}/lesson-${Date.now()}.${extensions[file.mimetype]}`;

  const { data, error } = await supabase.storage
    .from(LESSON_VIDEO_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    const uploadError = new Error(error.message);
    uploadError.statusCode = 502;
    throw uploadError;
  }

  return {
    path: data.path,
    // Keep the bucket private. The lesson APIs issue short-lived playback URLs
    // only after checking instructor ownership or student enrollment.
    video_url: data.path,
  };
}

function getLessonVideoObjectPath(videoUrl) {
    const value = String(videoUrl ?? "").trim();
    if (!value) return "";

    if (/^https?:\/\//i.test(value)) {
        let parsed;
        try {
            parsed = new URL(value);
        } catch {
            return null;
        }

        const segments = parsed.pathname.split("/").filter(Boolean);
        const bucketIndex = segments.findIndex((segment, index) =>
            segment === LESSON_VIDEO_BUCKET &&
            ["public", "sign", "authenticated"].includes(segments[index - 1])
        );

        // External video providers such as YouTube remain directly playable.
        if (bucketIndex < 0) return null;

        return segments
            .slice(bucketIndex + 1)
            .map(segment => decodeURIComponent(segment))
            .join("/");
    }

    if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return null;

    return value.startsWith(`${LESSON_VIDEO_BUCKET}/`)
        ? value.slice(LESSON_VIDEO_BUCKET.length + 1)
        : value.replace(/^\/+/, "");
}

async function getLessonVideoPlaybackUrl(videoUrl) {
    if (!videoUrl) return videoUrl ?? null;

    const objectPath = getLessonVideoObjectPath(videoUrl);
    if (objectPath === null) return videoUrl;
    if (!objectPath) return null;

    const { data, error } = await supabase.storage
        .from(LESSON_VIDEO_BUCKET)
        .createSignedUrl(objectPath, 60 * 60);

    if (error || !data?.signedUrl) {
        const playbackError = new Error(
            error?.message || "Unable to create a lesson video playback URL."
        );
        playbackError.statusCode = 502;
        throw playbackError;
    }

    return data.signedUrl;
}


// Use the existing private, unrestricted bucket and isolate Community objects by path.
const COMMUNITY_ATTACHMENT_BUCKET =
    process.env.COMMUNITY_ATTACHMENT_BUCKET || "lesson-images";

async function uploadCommunityAttachment(file, postId) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
        const error = new Error("Please select a file to attach.");
        error.statusCode = 400;
        throw error;
    }

    const filePath =
        `community/posts/${postId}/${randomUUID()}-${file.extension}`;
    let data;
    let error;
    try {
        ({ data, error } = await supabase.storage
            .from(COMMUNITY_ATTACHMENT_BUCKET)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: "3600",
                upsert: false
            }));
    } catch (cause) {
        const uploadError = new Error("Upload failed. Please try again.");
        uploadError.statusCode = 502;
        uploadError.cause = cause;
        throw uploadError;
    }

    if (error) {
        const uploadError = new Error("Upload failed. Please try again.");
        uploadError.statusCode = 502;
        uploadError.cause = error;
        throw uploadError;
    }

    const { data: publicData } = supabase.storage
        .from(COMMUNITY_ATTACHMENT_BUCKET)
        .getPublicUrl(data.path);

    return {
        path: data.path,
        publicUrl: publicData.publicUrl,
        bucket: COMMUNITY_ATTACHMENT_BUCKET
    };
}

async function createCommunityAttachmentSignedUrl(filePath) {
    if (!filePath || typeof filePath !== "string") return null;

    try {
        const { data, error } = await supabase.storage
            .from(COMMUNITY_ATTACHMENT_BUCKET)
            .createSignedUrl(filePath, 60 * 60);

        if (error) return null;
        return data?.signedUrl || null;
    } catch {
        return null;
    }
}

async function removeCommunityAttachments(filePaths = []) {
    const safePaths = filePaths.filter(
        (filePath) => typeof filePath === "string" && filePath.startsWith("community/posts/")
    );
    if (!safePaths.length) return;

    try {
        const { error } = await supabase.storage
            .from(COMMUNITY_ATTACHMENT_BUCKET)
            .remove(safePaths);

        if (error) {
            console.error("Failed to remove unused community attachments:", error.message);
        }
    } catch (error) {
        console.error("Failed to remove unused community attachments:", error.message);
    }
}


async function uploadInstructorProfileImage(file, userId) {
    if (!file) {
        const error = new Error("Please select a profile image.");
        error.statusCode = 400;
        throw error;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        const error = new Error("Only JPEG, PNG, and WebP images are allowed.");
        error.statusCode = 400;
        throw error;
    }

    if (file.size > 5 * 1024 * 1024) {
        const error = new Error("Profile image must not exceed 5 MB.");
        error.statusCode = 400;
        throw error;
    }

    const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const filePath = `instructor/${userId}/profile-${Date.now()}.${extensions[file.mimetype]}`;
    const { data, error } = await supabase.storage
        .from("profile")
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });

    if (error) {
        const uploadError = new Error(error.message);
        uploadError.statusCode = 502;
        throw uploadError;
    }

    const { data: publicData } = supabase.storage
        .from("profile")
        .getPublicUrl(data.path);

    return { path: data.path, publicUrl: publicData.publicUrl };
}
async function removeCourseThumbnail(filePath) {
    const { error } = await supabase.storage
        .from("course-thumbnails")
        .remove([filePath]);

    if (error) {
        console.error(
            "Failed to remove unused course thumbnail:",
            error.message
        );
    }
}

module.exports = {
    uploadCourseThumbnail,
    uploadInstitutionLogo,
    removeInstitutionLogo,
    removeCourseThumbnail,
    removeStoredImage,
    uploadProfileImage,
    uploadLessonVideo,
    getLessonVideoPlaybackUrl,
    uploadCommunityAttachment,
    createCommunityAttachmentSignedUrl,
    removeCommunityAttachments,
    uploadInstructorProfileImage
};
