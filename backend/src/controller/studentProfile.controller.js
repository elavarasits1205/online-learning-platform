
const profileService = require("../services/studentProfile.service");

// GET LOGGED-IN STUDENT PROFILE
async function getMyProfile(req, res, next) {
    try {
        const profile = await profileService.getMyProfile(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: {
                profile
            }
        });
    } catch (error) {
        return next(error);
    }
}

// UPDATE LOGGED-IN STUDENT PROFILE
async function updateMyProfile(req, res, next) {
    try {
        const result = await profileService.updateMyProfile(
            req.user.id,
            req.body || {}
        );

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
}

// UPLOAD AND SAVE THE LOGGED-IN STUDENT'S PROFILE IMAGE
async function uploadMyProfileImage(req, res, next) {
    try {
        const profile = await profileService.uploadMyProfileImage(
            req.user.id,
            req.file
        );

        return res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully.",
            data: { profile }
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getMyProfile,
    updateMyProfile,
    uploadMyProfileImage
};
