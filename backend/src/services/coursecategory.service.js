const repository = require("../repositories/coursecategory.repository");

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// Keep PostgreSQL BIGINT IDs as strings.
function validateId(value) {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value)
    ) {
        throw createError("Invalid category ID.");
    }

    return value;
}

function normalizeCategory(body = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw createError("Request body must be a JSON object.");
    }

    const code =
        typeof body.code === "string" ? body.code.trim() : "";

    const name =
        typeof body.name === "string" ? body.name.trim() : "";

    if (!code) {
        throw createError("Category code is required.");
    }

    if (code.length > 50) {
        throw createError("Category code must not exceed 50 characters.");
    }

    if (!name) {
        throw createError("Category name is required.");
    }

    if (name.length > 150) {
        throw createError("Category name must not exceed 150 characters.");
    }

    let description = null;

    if (body.description !== undefined && body.description !== null) {
        if (typeof body.description !== "string") {
            throw createError("Description must be a string or null.");
        }

        description = body.description.trim() || null;
    }

    let parentCategoryId = null;

    if (
        body.parent_category_id !== undefined &&
        body.parent_category_id !== null &&
        body.parent_category_id !== ""
    ) {
        const parentId = String(body.parent_category_id);

        if (!/^[1-9]\d*$/.test(parentId)) {
            throw createError("Invalid parent category ID.");
        }

        parentCategoryId = parentId;
    }

    let displayOrder = 0;

    if (body.display_order !== undefined) {
        displayOrder = body.display_order;

        if (
            typeof displayOrder !== "number" ||
            !Number.isSafeInteger(displayOrder) ||
            displayOrder < 0
        ) {
            throw createError(
                "Display order must be a non-negative integer."
            );
        }
    }

    let isActive = true;

    if (body.is_active !== undefined) {
        if (typeof body.is_active !== "boolean") {
            throw createError("is_active must be true or false.");
        }

        isActive = body.is_active;
    }

    return {
        code,
        name,
        description,
        parent_category_id: parentCategoryId,
        display_order: displayOrder,
        is_active: isActive,
    };
}

async function getAll() {
    return repository.getAll();
}

async function getById(rawId) {
    const id = validateId(rawId);
    const category = await repository.getById(id);

    if (!category) {
        throw createError("Course category not found.", 404);
    }

    return category;
}

async function validateParent(category, currentId = null) {
    const parentId = category.parent_category_id;

    if (parentId === null) {
        return;
    }

    if (currentId !== null && parentId === currentId) {
        throw createError("A category cannot be its own parent.");
    }

    const parent = await repository.getById(parentId);

    if (!parent) {
        throw createError(
            "The selected parent category does not exist or is deleted.",
            400
        );
    }
}

async function validateUniqueFields(category, excludeId = null) {
    const duplicateCode = await repository.getByCode(
        category.code,
        excludeId
    );

    if (duplicateCode) {
        throw createError("Category code already exists.", 409);
    }

    const duplicateName = await repository.getByName(
        category.name,
        excludeId
    );

    if (duplicateName) {
        throw createError("Category name already exists.", 409);
    }
}

async function create(body, createdBy) {
    const category = normalizeCategory(body);

    await validateParent(category);
    await validateUniqueFields(category);

    return repository.create(category, createdBy);
}

async function update(rawId, body, updatedBy) {
    const id = validateId(rawId);
    const existing = await repository.getById(id);

    if (!existing) {
        throw createError("Course category not found.", 404);
    }

    const category = normalizeCategory(body);

    await validateParent(category, id);
    await validateUniqueFields(category, id);

    const updated = await repository.update(id, category, updatedBy);

    if (!updated) {
        throw createError("Course category not found.", 404);
    }

    return updated;
}

async function remove(rawId, updatedBy) {
    const id = validateId(rawId);
    const existing = await repository.getById(id);

    if (!existing) {
        throw createError("Course category not found.", 404);
    }

    const hasChildren = await repository.hasActiveChildren(id);

    if (hasChildren) {
        throw createError(
            "Cannot delete this category because it has active child categories.",
            409
        );
    }

    const deleted = await repository.softDelete(id, updatedBy);

    if (!deleted) {
        throw createError("Course category not found.", 404);
    }

    return deleted;
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
};
