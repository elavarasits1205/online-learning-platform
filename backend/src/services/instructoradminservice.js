const instructorRepository = require("../repositories/instructoradminrepository");

const validateInstructorId = (id) => {
    const instructorId = String(id ?? "").trim();

    if (!/^[1-9]\d*$/.test(instructorId)) {
        const error = new Error("Invalid instructor ID.");
        error.statusCode = 400;
        throw error;
    }

    return instructorId;
};

const getAllInstructors = async () => {
    return await instructorRepository.findAllInstructors();
};

const getInstructorById = async (id) => {
    const instructorId = validateInstructorId(id);

    const instructor =
        await instructorRepository.findInstructorById(instructorId);

    if (!instructor) {
        const error = new Error("Instructor not found.");
        error.statusCode = 404;
        throw error;
    }

    return instructor;
};

module.exports = {
    getAllInstructors,
    getInstructorById
};
