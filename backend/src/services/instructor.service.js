
const pool = require("../config/database");
const instructorRepository =
    require("../repositories/instructor.repository");

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function validateId(id, field = "id") {
    if (!/^[1-9]\d*$/.test(String(id))) {
        throw createError(`Invalid ${field}`);
    }

    return String(id);
}

async function getMyProfile(userId) {
    const id = validateId(userId, "user ID");

    const instructor =
        await instructorRepository.findInstructorByUserId(pool, id);

    if (!instructor) {
        throw createError("Instructor profile not found", 404);
    }

    return instructor;
}

async function updateMyProfile(userId, input) {
    const id = validateId(userId, "user ID");

    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw createError("A valid profile object is required");
    }

    const instructor =
        await instructorRepository.findInstructorByUserId(pool, id);

    if (!instructor) {
        throw createError("Instructor profile not found", 404);
    }

    const allowedFields = {
        specialization: "specialization",
        qualification: "qualification",
        experience_years: "experienceYears",
        experienceYears: "experienceYears",
        profile_image_url: "profileImageUrl",
        profileImageUrl: "profileImageUrl",
        bio: "bio",
        designation: "designation"
    };

    const updates = {};

    for (const [field, value] of Object.entries(input)) {
        const targetField = allowedFields[field];

        if (!targetField) {
            throw createError(`Field '${field}' cannot be updated`);
        }

        // Prevent two aliases from silently overwriting each other.
        if (Object.hasOwn(updates, targetField)) {
            throw createError(`Provide only one form of '${targetField}'`);
        }

        updates[targetField] = value;
    }

    if (Object.keys(updates).length === 0) {
        throw createError("No profile fields provided");
    }

    if (updates.experienceYears !== undefined) {
        const years = Number(updates.experienceYears);

        if (
            updates.experienceYears === null ||
            updates.experienceYears === "" ||
            !Number.isInteger(years) ||
            years < 0
        ) {
            throw createError(
                "experience_years must be a non-negative integer"
            );
        }

        updates.experienceYears = years;
    }

    for (const field of [
        "specialization",
        "qualification",
        "profileImageUrl",
        "bio",
        "designation"
    ]) {
        if (
            updates[field] !== undefined &&
            updates[field] !== null &&
            typeof updates[field] !== "string"
        ) {
            throw createError(`${field} must be a string or null`);
        }
    }

    const updated = await instructorRepository.updateInstructor(
        pool,
        instructor.id,
        {
            specialization:
                updates.specialization ?? null,
            qualification:
                updates.qualification ?? null,
            experienceYears:
                updates.experienceYears ?? null,
            profileImageUrl:
                updates.profileImageUrl ?? null,
            bio:
                updates.bio ?? null,
            designation:
                updates.designation ?? null,
            updatedBy: id
        }
    );

    if (!updated) {
        throw createError("Instructor profile could not be updated", 404);
    }

    return updated;
}

module.exports = {
    getMyProfile,
    updateMyProfile
};
