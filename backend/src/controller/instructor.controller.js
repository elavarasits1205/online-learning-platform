
const instructorService =
    require("../services/instructor.service");
const enrollmentRepository = require("../repositories/enrollment.repository");
const storageService = require("../services/storage.service");

async function uploadProfileImage(req, res, next) {
    try {
        const uploaded = await storageService.uploadInstructorProfileImage(
            req.file,
            req.user.id
        );
        return res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully.",
            data: { profileImageUrl: uploaded.publicUrl }
        });
    } catch (error) {
        return next(error);
    }
}

async function getEnrollmentReport(req, res, next) {
    try {
        const { status, fromDate, toDate, page, limit } = req.query;
        if (fromDate && Number.isNaN(Date.parse(fromDate))) {
            return res.status(400).json({ success: false, message: "fromDate must be a valid date." });
        }
        if (toDate && Number.isNaN(Date.parse(toDate))) {
            return res.status(400).json({ success: false, message: "toDate must be a valid date." });
        }
        if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({ success: false, message: "fromDate must not be later than toDate." });
        }
        const result = await enrollmentRepository.getInstructorEnrollmentReport(req.user.id, {
            status: status ? String(status).trim() : "",
            fromDate,
            toDate,
            page,
            limit
        });
        return res.status(200).json({ success: true, message: "Instructor enrollment report retrieved successfully.", data: result });
    } catch (error) {
        return next(error);
    }
}

async function getMyStudents(req, res, next) {
    try {
        const rows = await enrollmentRepository.getInstructorStudents(req.user.id);
        return res.status(200).json({
            success: true,
            message: "Instructor students retrieved successfully.",
            data: rows
        });
    } catch (error) {
        return next(error);
    }
}

async function getMyProfile(req, res, next) {
    try {
        const result = await instructorService.getMyProfile(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "Instructor profile retrieved successfully",
            data: result
        });
    } catch (error) {
        return next(error);
    }
}

async function updateMyProfile(req, res, next) {
    try {
        const result = await instructorService.updateMyProfile(
            req.user.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Instructor profile updated successfully",
            data: result
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getEnrollmentReport,
    getMyStudents,
    getMyProfile,
    updateMyProfile,
    uploadProfileImage
};
