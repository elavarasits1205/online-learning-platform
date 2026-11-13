
const service = require("../services/lesson.service");

async function create(req, res, next) {
    try {
        const data = await service.create(req.body, req.user.id);
        res.status(201).json({
            success: true,
            message: "Lesson created successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

async function listByModule(req, res, next) {
    try {
        const data = await service.listByModule(
            req.params.moduleId, req.user.id
        );
        res.status(200).json({
            success: true,
            message: "Lessons retrieved successfully",
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
            message: "Lesson updated successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

async function uploadVideo(req, res, next) {
    try {
        const data = await service.uploadVideo(
            req.params.moduleId,
            req.file,
            req.user.id
        );

        res.status(201).json({
            success: true,
            message: "Lesson video uploaded successfully",
            data,
        });
    } catch (error) {
        next(error);
    }
}



module.exports = { create, listByModule, update, uploadVideo};
