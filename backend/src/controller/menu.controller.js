
const menuService = require("../services/menu.service");
const { getCreateAudit, getUpdateAudit, getDeleteAudit } = require("../utils/audit");

function sendError(res, error) {
    console.error("Menu API error:", error.message);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode === 500
                ? "Internal server error"
                : error.message
    });
}

// GET /api/menus
async function getAllMenus(req, res) {
    try {
        const menus = await menuService.getAllMenus();

        return res.status(200).json({
            success: true,
            message: "Menus retrieved successfully",
            data: menus
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// GET /api/menus/:id
async function getMenuById(req, res) {
    try {
        const menu = await menuService.getMenuById(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Menu retrieved successfully",
            data: menu
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// POST /api/menus
async function createMenu(req, res) {
    try {
        const { createdBy } = getCreateAudit(req);
        const menu = await menuService.createMenu(req.body, createdBy);

        return res.status(201).json({
            success: true,
            message: "Menu created successfully",
            data: menu
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// PUT /api/menus/:id
async function updateMenu(req, res) {
    try {
        const { updatedBy } = getUpdateAudit(req);
        const menu = await menuService.updateMenu(
            req.params.id,
            req.body,
            updatedBy
        );

        return res.status(200).json({
            success: true,
            message: "Menu updated successfully",
            data: menu
        });
    } catch (error) {
        return sendError(res, error);
    }
}

// DELETE /api/menus/:id
async function deleteMenu(req, res) {
    try {
        const { updatedBy } = getDeleteAudit(req);
        const menu = await menuService.deleteMenu(req.params.id, updatedBy);

        return res.status(200).json({
            success: true,
            message: "Menu soft-deleted successfully",
            data: menu
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    getAllMenus,
    getMenuById,
    createMenu,
    updateMenu,
    deleteMenu
};
