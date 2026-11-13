
const menuRepository =
    require("../repositories/menu.repository");

class MenuError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = "MenuError";
        this.statusCode = statusCode;
    }
}

function validateId(id) {
    const value = String(id);

    if (!/^[1-9]\d*$/.test(value)) {
        throw new MenuError("Invalid menu ID", 400);
    }

    if (BigInt(value) > 9223372036854775807n) {
        throw new MenuError("Menu ID is out of range", 400);
    }

    return value;
}

function normalizeMenuInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new MenuError(
            "Request body must be a JSON object",
            400
        );
    }

    const {
        parentId = null,
        code,
        name,
        menuType = "MENU",
        routePath = null,
        icon = null,
        sortOrder = 0,
        isParent = false,
        isActive = true,
        permissionId
    } = body;

    function requiredString(value, field, maxLength) {
        if (typeof value !== "string" || !value.trim()) {
            throw new MenuError(`${field} is required`, 400);
        }

        const normalized = value.trim();

        if (normalized.length > maxLength) {
            throw new MenuError(
                `${field} must not exceed ${maxLength} characters`,
                400
            );
        }

        return normalized;
    }

    function nullableString(value, field, maxLength) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value !== "string") {
            throw new MenuError(
                `${field} must be a string or null`,
                400
            );
        }

        const normalized = value.trim();

        if (normalized.length > maxLength) {
            throw new MenuError(
                `${field} must not exceed ${maxLength} characters`,
                400
            );
        }

        return normalized || null;
    }

    const normalizedCode = requiredString(code, "code", 100);
    const normalizedName = requiredString(name, "name", 150);

    const allowedTypes = ["MENU", "SUBMENU", "ACTION"];

    if (
        typeof menuType !== "string" ||
        !allowedTypes.includes(menuType.trim().toUpperCase())
    ) {
        throw new MenuError(
            "menuType must be MENU, SUBMENU, or ACTION",
            400
        );
    }

    function normalizeForeignKey(value, field, nullable) {
        if (nullable && (value === null || value === undefined || value === "")) {
            return null;
        }

        if (!/^[1-9]\d*$/.test(String(value))) {
            throw new MenuError(`${field} must be a valid positive ID`, 400);
        }

        if (BigInt(value) > 9223372036854775807n) {
            throw new MenuError(`${field} is out of range`, 400);
        }

        return String(value);
    }

    const normalizedParentId =
        normalizeForeignKey(parentId, "parentId", true);

    const normalizedPermissionId =
        normalizeForeignKey(permissionId, "permissionId", false);

    if (
        !Number.isInteger(sortOrder) ||
        sortOrder < 0 ||
        sortOrder > 2147483647
    ) {
        throw new MenuError(
            "sortOrder must be a non-negative 32-bit integer",
            400
        );
    }

    if (typeof isParent !== "boolean") {
        throw new MenuError("isParent must be true or false", 400);
    }

    if (typeof isActive !== "boolean") {
        throw new MenuError("isActive must be true or false", 400);
    }

    return {
        parentId: normalizedParentId,
        code: normalizedCode,
        name: normalizedName,
        menuType: menuType.trim().toUpperCase(),
        routePath: nullableString(routePath, "routePath", 255),
        icon: nullableString(icon, "icon", 100),
        sortOrder,
        isParent,
        isActive,
        permissionId: normalizedPermissionId
    };
}

function handleDatabaseError(error) {
    if (error.code === "23505") {
        throw new MenuError("Menu code already exists", 409);
    }

    if (error.code === "23503") {
        throw new MenuError(
            "The specified parent menu or permission does not exist, or is referenced by another record",
            400
        );
    }

    if (error.code === "23514") {
        throw new MenuError(
            "Menu data violates a database constraint",
            400
        );
    }

    throw error;
}

async function validateReferences(menu, currentId = null) {
    if (menu.parentId !== null) {
        if (menu.parentId === currentId) {
            throw new MenuError(
                "A menu cannot be its own parent",
                400
            );
        }

        const parent = await menuRepository.findActiveParentMenu(
            menu.parentId
        );

        if (!parent) {
            throw new MenuError(
                "Parent menu not found or has been deleted",
                400
            );
        }
    }

    const permission = await menuRepository.findActivePermission(
        menu.permissionId
    );

    if (!permission) {
        throw new MenuError(
            "Permission not found or has been deleted",
            400
        );
    }

    if (
        currentId !== null &&
        await menuRepository.wouldCreateParentCycle(
            currentId,
            menu.parentId
        )
    ) {
        throw new MenuError(
            "This parent selection would create a circular menu hierarchy",
            400
        );
    }
}

async function getAllMenus() {
    return menuRepository.findAllMenus();
}

async function getMenuById(id) {
    validateId(id);

    const menu = await menuRepository.findMenuById(id);

    if (!menu) {
        throw new MenuError("Menu not found", 404);
    }

    return menu;
}

async function createMenu(body, createdBy) {
    const menu = normalizeMenuInput(body);

    const duplicate = await menuRepository.findDuplicateMenuCode(
        menu.code
    );

    if (duplicate) {
        throw new MenuError("Menu code already exists", 409);
    }

    await validateReferences(menu);

    try {
        return await menuRepository.createMenu(menu, createdBy);
    } catch (error) {
        handleDatabaseError(error);
    }
}

async function updateMenu(id, body, updatedBy) {
    validateId(id);

    const existing = await menuRepository.findMenuById(id);

    if (!existing) {
        throw new MenuError("Menu not found", 404);
    }

    const menu = normalizeMenuInput(body);

    const duplicate = await menuRepository.findDuplicateMenuCode(
        menu.code,
        id
    );

    if (duplicate) {
        throw new MenuError(
            "Another menu already uses this code",
            409
        );
    }

    await validateReferences(menu, id);

    try {
        const updated = await menuRepository.updateMenu(id, menu, updatedBy);

        if (!updated) {
            throw new MenuError("Menu not found", 404);
        }

        return updated;
    } catch (error) {
        handleDatabaseError(error);
    }
}

async function deleteMenu(id, updatedBy) {
    validateId(id);

    const existing = await menuRepository.findMenuById(id);

    if (!existing) {
        throw new MenuError("Menu not found", 404);
    }

    try {
        // A parent referenced by another menu cannot be
        // permanently deleted because of the FK constraint.
        // This operation is a soft delete, not a physical delete.
        const deleted = await menuRepository.softDeleteMenu(id, updatedBy);

        if (!deleted) {
            throw new MenuError("Menu not found", 404);
        }

        return deleted;
    } catch (error) {
        handleDatabaseError(error);
    }
}

module.exports = {
    getAllMenus,
    getMenuById,
    createMenu,
    updateMenu,
    deleteMenu
};
