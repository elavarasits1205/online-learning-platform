
const service = require("../services/module.service");

async function create(req, res, next) {
    try {
        const data = await service.create(req.body, req.user.id);
        res.status(201).json({
            success: true,
            message: "Module created successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

async function listByCourse(req, res, next) {
    try {
        const data = await service.listByCourse(
            req.params.courseId, req.user.id
        );
        res.status(200).json({
            success: true,
            message: "Modules retrieved successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

async function update(req, res, next) {
    try {
        const data = await service.update(
            req.params.id, req.body, req.user.id
        );
        res.status(200).json({
            success: true,
            message: "Module updated successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

module.exports = { create, listByCourse, update };
