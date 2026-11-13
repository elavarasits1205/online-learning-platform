
const repository = require("../repositories/institution.repository");
const storageService = require("./storage.service");

const MAX_BIGINT = 9223372036854775807n;

const FIELD_LIMITS = {
    code: 50,
    name: 200,
    institution_type: 50,
    email: 255,
    phone_number: 30,
    address_line1: 255,
    address_line2: 255,
    city: 100,
    state: 100,
    postal_code: 20,
    country: 100,
};

const EDITABLE_FIELDS = [
    "code",
    "name",
    "institution_type",
    "description",
    "email",
    "phone_number",
    "website_url",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "country",
    "logo_url",
    "is_active",
];

const NULLABLE_FIELDS = EDITABLE_FIELDS.filter(
    (field) => !["code", "name", "is_active"].includes(field)
);

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function validateId(value) {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value) ||
        BigInt(value) > MAX_BIGINT
    ) {
        throw createError("Invalid institution ID", 400);
    }

    return value;
}

function normalizeInput(input, { creating = false } = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw createError("Request body must be a JSON object");
    }

    const unknownFields = Object.keys(input).filter(
        (field) => !EDITABLE_FIELDS.includes(field)
    );

    if (unknownFields.length > 0) {
        throw createError(
            `Unsupported field(s): ${unknownFields.join(", ")}`
        );
    }

    const data = {};

    for (const field of EDITABLE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(input, field)) {
            continue;
        }

        const value = input[field];

        if (field === "is_active") {
            if (typeof value !== "boolean") {
                throw createError("is_active must be a boolean");
            }

            data[field] = value;
            continue;
        }

        if (value === null) {
            if (creating && !NULLABLE_FIELDS.includes(field)) {
                throw createError(`${field} cannot be null`);
            }

            if (!NULLABLE_FIELDS.includes(field)) {
                throw createError(`${field} cannot be null`);
            }

            data[field] = null;
            continue;
        }

        if (typeof value !== "string") {
            throw createError(`${field} must be a string or null`);
        }

        const normalized = value.trim();

        if (normalized === "") {
            if (NULLABLE_FIELDS.includes(field)) {
                data[field] = null;
                continue;
            }

            throw createError(`${field} cannot be empty`);
        }

        if (
            FIELD_LIMITS[field] &&
            normalized.length > FIELD_LIMITS[field]
        ) {
            throw createError(
                `${field} must not exceed ${FIELD_LIMITS[field]} characters`
            );
        }

        if (
            field === "email" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
        ) {
            throw createError("Invalid email address");
        }

        for (const urlField of ["website_url", "logo_url"]) {
            if (field === urlField) {
                let url;

                try {
                    url = new URL(normalized);
                } catch {
                    throw createError(`${field} must be a valid URL`);
                }

                if (!["http:", "https:"].includes(url.protocol)) {
                    throw createError(
                        `${field} must use HTTP or HTTPS`
                    );
                }
            }
        }

        data[field] = normalized;
    }

    if (creating) {
        for (const requiredField of ["code", "name"]) {
            if (!data[requiredField]) {
                throw createError(`${requiredField} is required`);
            }
        }

        if (!Object.prototype.hasOwnProperty.call(data, "is_active")) {
            data.is_active = true;
        }
    }

    if (Object.keys(data).length === 0) {
        throw createError("Provide at least one field to update");
    }

    return data;
}

async function checkDuplicates(data, excludeId = null) {
    for (const field of ["code", "name"]) {
        if (!Object.prototype.hasOwnProperty.call(data, field)) {
            continue;
        }

        const existing = await repository.findDuplicate(
            field,
            data[field],
            excludeId
        );

        if (existing) {
            throw createError(
                `An institution with this ${field} already exists`,
                409
            );
        }
    }
}

async function cleanupInstitutionLogo(uploadedLogo) {
    if (!uploadedLogo?.path) return;

    try {
        await storageService.removeInstitutionLogo(uploadedLogo.path);
    } catch (error) {
        console.error("Failed to clean up an unused institution logo:", error.message);
    }
}

function getActorId(user) {
    const id = user?.id;

    if (id === undefined || id === null || id === "") {
        return null;
    }

    return validateId(String(id));
}

function translateDatabaseError(error) {
    if (error.statusCode) {
        return error;
    }

    if (error.code === "23505") {
        return createError(
            "Institution code or name already exists",
            409
        );
    }

    if (error.code === "23514") {
        return createError(
            "Institution data violates a database constraint",
            400
        );
    }

    if (error.code === "22P02" || error.code === "22001") {
        return createError("Invalid data supplied", 400);
    }

    return error;
}

async function createInstitution(input, user, logoFile) {
    let uploadedLogo;

    try {
        const data = normalizeInput(input, { creating: true });
        await checkDuplicates(data);

        if (logoFile) {
            uploadedLogo = await storageService.uploadInstitutionLogo(logoFile);
            data.logo_url = uploadedLogo.publicUrl;
        }

        return await repository.create(data, getActorId(user));
    } catch (error) {
        await cleanupInstitutionLogo(uploadedLogo);
        throw translateDatabaseError(error);
    }
}

async function getInstitutions(query = {}) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);

    if (!Number.isInteger(page) || page < 1) {
        throw createError("page must be a positive integer");
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw createError("limit must be between 1 and 100");
    }

    let isActive;

    if (
        query.is_active !== undefined &&
        query.is_active !== ""
    ) {
        if (!["true", "false"].includes(String(query.is_active))) {
            throw createError("is_active must be true or false");
        }

        isActive = String(query.is_active) === "true";
    }

    const search = query.search === undefined
        ? ""
        : String(query.search).trim();

    return repository.findAll({
        search,
        isActive,
        page,
        limit,
    });
}

async function getInstitutionById(id) {
    validateId(id);

    const institution = await repository.findById(id);

    if (!institution) {
        throw createError("Institution not found", 404);
    }

    return institution;
}

async function updateInstitution(id, input, user, logoFile) {
    let uploadedLogo;

    try {
        validateId(id);

        const current = await repository.findById(id);

        if (!current) {
            throw createError("Institution not found", 404);
        }

        const data = normalizeInput(input);
        await checkDuplicates(data, id);

        if (logoFile) {
            uploadedLogo = await storageService.uploadInstitutionLogo(logoFile);
            data.logo_url = uploadedLogo.publicUrl;
        }

        const updated = await repository.update(
            id,
            data,
            getActorId(user)
        );

        if (!updated) {
            throw createError("Institution not found", 404);
        }

        return updated;
    } catch (error) {
        await cleanupInstitutionLogo(uploadedLogo);
        throw translateDatabaseError(error);
    }
}

async function deleteInstitution(id, user) {
    validateId(id);

    const existing = await repository.findById(id);

    if (!existing) {
        throw createError("Institution not found", 404);
    }

    return repository.softDelete(id, getActorId(user));
}

module.exports = {
    createInstitution,
    getInstitutions,
    getInstitutionById,
    updateInstitution,
    deleteInstitution,
};
