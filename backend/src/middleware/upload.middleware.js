const multer = require("multer");
const path = require("path");

const IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;

const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

/*
 * Common image upload configuration
 *
 * Used for:
 * - Course thumbnail
 * - Profile image
 */
const imageUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: IMAGE_SIZE_LIMIT,
        files: 1
    },

    fileFilter: (req, file, callback) => {
        if (!allowedImageTypes.includes(file.mimetype)) {
            return callback(
                new Error("Only JPEG, PNG, and WebP images are allowed.")
            );
        }

        callback(null, true);
    }
});


/*
 * Course thumbnail upload
 *
 * Expected form-data field:
 * thumbnail
 */
const uploadThumbnail = imageUpload.single("thumbnail");

const institutionLogoParser = imageUpload.single("logo");

function uploadInstitutionLogo(req, res, next) {
    institutionLogoParser(req, res, (error) => {
        if (error) {
            if (error.code === "LIMIT_FILE_SIZE") {
                error.message = "Institution logo must not exceed 5 MB.";
            } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
                error.message = "Upload one logo image using the logo field.";
            }

            error.statusCode = error.statusCode || 400;
            return next(error);
        }

        next();
    });
}


/*
 * Profile image parser
 *
 * IMPORTANT:
 * Do not name this variable uploadProfileImage
 * because uploadProfileImage is the middleware function below.
 */
const profileImageParser = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: IMAGE_SIZE_LIMIT,
        files: 1
    },

    fileFilter: (req, file, callback) => {
        if (!allowedImageTypes.includes(file.mimetype)) {
            const error = new Error(
                "Only JPEG, PNG, and WebP images are allowed."
            );

            error.statusCode = 400;

            return callback(error);
        }

        callback(null, true);
    }
}).single("image");


/*
 * Profile image upload middleware
 *
 * Handles:
 * - Invalid file type
 * - File size limit
 * - Multer errors
 */
function uploadProfileImage(req, res, next) {
    profileImageParser(req, res, (error) => {
        if (error) {
            /*
             * Multer file-size error
             */
            if (error.code === "LIMIT_FILE_SIZE") {
                error.message = "Profile image must not exceed 5 MB.";
            }

            /*
             * Make sure the error reaches the global
             * error-handling middleware with HTTP 400.
             */
            error.statusCode = error.statusCode || 400;

            return next(error);
        }

        next();
    });
}


/*
 * Community attachment configuration
 */

const COMMUNITY_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;

const COMMUNITY_ATTACHMENT_MAX_FILES = 5;

const COMMUNITY_ATTACHMENT_TYPES = {
    ".pdf": [
        "application/pdf"
    ],

    ".doc": [
        "application/msword"
    ],

    ".docx": [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],

    ".ppt": [
        "application/vnd.ms-powerpoint"
    ],

    ".pptx": [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ],

    ".xls": [
        "application/vnd.ms-excel"
    ],

    ".xlsx": [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ],

    ".txt": [
        "text/plain"
    ],

    ".csv": [
        "text/csv",
        "application/vnd.ms-excel"
    ],

    ".jpg": [
        "image/jpeg"
    ],

    ".jpeg": [
        "image/jpeg"
    ],

    ".png": [
        "image/png"
    ],

    ".gif": [
        "image/gif"
    ],

    ".webp": [
        "image/webp"
    ]
};


/*
 * Community attachment parser
 *
 * Expected form-data field:
 * attachments
 *
 * Maximum:
 * - 10 MB per file
 * - 5 files per request
 */
const communityAttachmentParser = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: COMMUNITY_ATTACHMENT_MAX_SIZE,
        files: COMMUNITY_ATTACHMENT_MAX_FILES
    },

    fileFilter: (req, file, callback) => {
        const extension = path
            .extname(file.originalname || "")
            .toLowerCase();

        const acceptedMimeTypes =
            COMMUNITY_ATTACHMENT_TYPES[extension];

        /*
         * Validate both:
         * 1. File extension
         * 2. MIME type
         */
        if (
            !acceptedMimeTypes ||
            !acceptedMimeTypes.includes(file.mimetype)
        ) {
            const error = new Error("Unsupported file type.");

            error.statusCode = 400;

            return callback(error);
        }

        callback(null, true);
    }
}).array(
    "attachments",
    COMMUNITY_ATTACHMENT_MAX_FILES
);


/*
 * Community attachment upload middleware
 */
function uploadCommunityAttachments(req, res, next) {
    communityAttachmentParser(req, res, (error) => {
        if (error) {

            /*
             * Individual file exceeds 10 MB
             */
            if (error.code === "LIMIT_FILE_SIZE") {
                error.message =
                    "File is too large. Maximum size is 10 MB.";
            }

            /*
             * More than 5 files uploaded
             */
            else if (error.code === "LIMIT_FILE_COUNT") {
                error.message =
                    "You can attach up to 5 files to a post.";
            }

            error.statusCode = error.statusCode || 400;

            return next(error);
        }

        next();
    });
}


/*
 * Export middleware and constants
 */
module.exports = {
    uploadThumbnail,
    uploadInstitutionLogo,
    uploadProfileImage,
    uploadCommunityAttachments,

    COMMUNITY_ATTACHMENT_MAX_SIZE,
    COMMUNITY_ATTACHMENT_MAX_FILES,
    COMMUNITY_ATTACHMENT_TYPES
};
