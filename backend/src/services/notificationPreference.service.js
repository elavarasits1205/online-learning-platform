const repository = require("../repositories/notificationPreference.repository");

const defaultPreferences = Object.freeze({
    courseAnnouncements: true,
    assignmentAssessment: true,
    newCourses: true,
    community: true,
    payments: true,
    certificates: true,
    email: true
});

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizePreferences(preferences = {}) {
    return Object.fromEntries(
        Object.keys(defaultPreferences).map((key) => [
            key,
            typeof preferences[key] === "boolean"
                ? preferences[key]
                : defaultPreferences[key]
        ])
    );
}

async function getForUser(userId) {
    return normalizePreferences(await repository.findByUserId(userId));
}

async function updateForUser(userId, updates = {}) {
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
        throw createError("Notification preferences must be an object.", 400);
    }

    const entries = Object.entries(updates);
    if (!entries.length) {
        throw createError("Provide at least one notification preference.", 400);
    }

    for (const [key, value] of entries) {
        if (!Object.prototype.hasOwnProperty.call(defaultPreferences, key)) {
            throw createError(`Unsupported notification preference: ${key}.`, 400);
        }
        if (typeof value !== "boolean") {
            throw createError(`${key} must be true or false.`, 400);
        }
    }

    const saved = await repository.mergeForUser(userId, updates);
    return normalizePreferences(saved);
}

module.exports = { getForUser, updateForUser };
