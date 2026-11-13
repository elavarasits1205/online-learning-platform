
const repository = require("../repositories/studentProfile.repository");
const storageService = require("./storage.service");

const allowedUserFields = {
    firstName: "first_name",
    lastName: "last_name",
    phoneNumber: "phone_number"
};

const allowedStudentFields = {
    dateOfBirth: "date_of_birth",
    gender: "gender",
    profileImageUrl: "profile_image_url",
    addressLine1: "address_line1",
    addressLine2: "address_line2",
    city: "city",
    state: "state",
    postalCode: "postal_code",
    country: "country",
    bio: "bio"
};

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// GET PROFILE
async function getMyProfile(userId) {
    const profile = await repository.findMyProfile(userId);

    if (!profile) {
        throw createError("Student profile not found", 404);
    }

    return profile;
}

// COLLECT ONLY ALLOWED FIELDS
function collectUpdates(body, allowedFields) {
    const updates = [];

    for (const [key, column] of Object.entries(allowedFields)) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            updates.push({
                column,
                value: body[key] === "" ? null : body[key]
            });
        }
    }

    return updates;
}

// VALIDATION
function validateProfile(body) {
    if (
        body.gender != null &&
        !["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]
            .includes(body.gender)
    ) {
        throw createError("Invalid gender value", 400);
    }

    if (
        body.dateOfBirth &&
        !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)
    ) {
        throw createError(
            "dateOfBirth must use YYYY-MM-DD format",
            400
        );
    }
}

// UPDATE PROFILE
async function updateMyProfile(userId, body = {}) {
    validateProfile(body);

    const userUpdates = collectUpdates(
        body,
        allowedUserFields
    );

    const studentUpdates = collectUpdates(
        body,
        allowedStudentFields
    );

    if (!userUpdates.length && !studentUpdates.length) {
        throw createError(
            "Provide at least one editable profile field",
            400
        );
    }

    return repository.withTransaction(async (client) => {
        const student = await repository.findActiveStudent(
            client,
            userId
        );

        if (!student) {
            throw createError(
                "Active student profile not found",
                404
            );
        }

        if (userUpdates.length) {
            await repository.updateUser(
                client,
                userId,
                userUpdates
            );
        }

        if (studentUpdates.length) {
            await repository.updateStudent(
                client,
                student.id,
                userId,
                studentUpdates
            );
        }

        return {
            success: true,
            message: "Student profile updated successfully"
        };
    });
}

async function uploadMyProfileImage(userId, file) {
    const profile = await getMyProfile(userId);

    if (profile.is_active !== true) {
        throw createError("Active student profile not found", 404);
    }

    const uploaded = await storageService.uploadProfileImage(file, userId);

    try {
        await updateMyProfile(userId, {
            profileImageUrl: uploaded.publicUrl
        });

        return {
            ...profile,
            profile_image_url: uploaded.publicUrl
        };
    } catch (error) {
        await storageService.removeStoredImage(uploaded.path);
        throw error;
    }
}

module.exports = {
    getMyProfile,
    updateMyProfile,
    uploadMyProfileImage
};
