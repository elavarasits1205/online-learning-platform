const instructorService = require("../services/instructoradminservice");

const sendError = (res, error) => {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error("Instructor Admin API error:", error);
    }

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? "Internal server error."
                : error.message
    });
};

const getAllInstructors = async (req, res) => {
    try {
        const instructors =
            await instructorService.getAllInstructors();

        return res.status(200).json({
            success: true,
            count: instructors.length,
            data: instructors
        });
    } catch (error) {
        return sendError(res, error);
    }
};

const getInstructorById = async (req, res) => {
    try {
        const instructor =
            await instructorService.getInstructorById(req.params.id);

        return res.status(200).json({
            success: true,
            data: instructor
        });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = {
    getAllInstructors,
    getInstructorById
};
