
const service = require("../services/course.service");

async function create(req, res, next) {
    try {
        const data = await service.create(req.body, req.user.id);
        res.status(201).json({
            success: true,
            message: "Course created successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

async function listMy(req, res, next) {
    try {
        const data = await service.listMy(req.user.id);
        res.status(200).json({
            success: true,
            message: "Courses retrieved successfully",
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
            message: "Course updated successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

async function submit(req, res, next) {
    try {
        const data = await service.submit(
            req.params.id, req.user.id
        );
        res.status(200).json({
            success: true,
            message: "Course submitted for approval",
            data
        });
    } catch (error) {
        next(error);
    }
}

async function uploadThumbnail(req, res, next) {
    try {
        const data = await service.uploadThumbnail(
            req.params.id,
            req.file,
            req.user.id
        );

        res.status(200).json({
            success: true,
            message: "Course thumbnail uploaded successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

async function getCourse(req, res, next) {
    try {
        const data = await service.getCourse(
            req.params.id,
            req.user.id
        );

        res.status(200).json({
            success: true,
            message: "Course retrieved successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}



async function getCategories(req, res, next) {
    try {
        const data = await service.getCategories();

        res.status(200).json({
            success: true,
            message: "Categories retrieved successfully",
            data
        });
    } catch (error) {
        next(error);
    }
}

module.exports = { create, listMy, update, submit,uploadThumbnail,getCourse,getCategories };
