const studentService = require("../services/studentadmin.service");

function sendError(res, error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error("Student Admin API error:", error);
    }

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? "Internal server error."
                : error.message
    });
}

async function getAllStudents(req, res) {
    try {
        const students = await studentService.getAllStudents();

        return res.status(200).json({
            success: true,
            count: students.length,
            data: students
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function getStudentById(req, res) {
    try {
        const student = await studentService.getStudentById(
            req.params.id
        );

        return res.status(200).json({
            success: true,
            data: student
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    getAllStudents,
    getStudentById
};
