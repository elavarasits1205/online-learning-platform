const multer = require("multer");

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB maximum
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only MP4, WebM, and MOV videos are allowed.")
      );
    }

    callback(null, true);
  },
}).single("video");

module.exports = { uploadVideo };