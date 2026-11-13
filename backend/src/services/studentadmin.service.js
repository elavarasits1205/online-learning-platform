const studentRepository = require("../repositories/studentadmin.repository");

function validateStudentId(id) {
    const value = String(id ?? "").trim();

    if (!/^[1-9]\d*$/.test(value)) {
        const error = new Error("Invalid student ID.");
        error.statusCode = 400;
        throw error;
    }

    return value;
}

async function getAllStudents() {
    return await studentRepository.findAllStudents();
}

async function getStudentById(id) {
    const studentId = validateStudentId(id);

    const student = await studentRepository.findStudentById(
        studentId
    );

    if (!student) {
        const error = new Error("Student not found.");
        error.statusCode = 404;
        throw error;
    }

    return student;
}

module.exports = {
    getAllStudents,
    getStudentById
};
