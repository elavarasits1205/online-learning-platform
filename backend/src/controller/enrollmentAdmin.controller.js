const service = require("../services/enrollmentAdmin.service");

async function getAllEnrollments(req, res, next) {
    try {
        const result = await service.getAllEnrollments(req.query);

        return res.status(200).json({
            success: true,
            data: result.rows,
            pagination: result.pagination
        });
    } catch (error) {
        return next(error);
    }
}

async function getEnrollmentById(req, res, next) {
    try {
        const enrollment = await service.getEnrollmentById(req.params.id);

        return res.status(200).json({
            success: true,
            data: enrollment
        });
    } catch (error) {
        return next(error);
    }
}

async function getStatusOptions(req, res, next) {
    try {
        const statuses = await service.getStatusOptions();

        return res.status(200).json({
            success: true,
            data: statuses
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getAllEnrollments,
    getEnrollmentById,
    getStatusOptions
};
