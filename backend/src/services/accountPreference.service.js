const repository = require("../repositories/accountPreference.repository");

const defaults = Object.freeze({
    language: "en",
    timezone: "UTC",
    emailFrequency: "immediately"
});

const languages = new Set(["en", "es", "fr", "hi"]);
const emailFrequencies = new Set(["immediately", "daily", "weekly"]);

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalize(preferences = {}) {
    return {
        language: languages.has(preferences.language)
            ? preferences.language
            : defaults.language,
        timezone: typeof preferences.timezone === "string"
            ? preferences.timezone
            : defaults.timezone,
        emailFrequency: emailFrequencies.has(preferences.emailFrequency)
            ? preferences.emailFrequency
            : defaults.emailFrequency
    };
}

async function getForUser(userId) {
    return normalize(await repository.findByUserId(userId));
}

async function updateForUser(userId, updates = {}) {
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
        throw createError("Account preferences must be an object.", 400);
    }

    const entries = Object.entries(updates);
    if (!entries.length) {
        throw createError("Provide at least one account preference.", 400);
    }

    for (const [key, value] of entries) {
        if (!Object.prototype.hasOwnProperty.call(defaults, key)) {
            throw createError(`Unsupported account preference: ${key}.`, 400);
        }
        if (key === "language" && !languages.has(value)) {
            throw createError("Choose a supported language.", 400);
        }
        if (key === "emailFrequency" && !emailFrequencies.has(value)) {
            throw createError("Choose a supported email frequency.", 400);
        }
        if (key === "timezone") {
            if (typeof value !== "string" || value.length > 100) {
                throw createError("Choose a valid timezone.", 400);
            }
            try {
                new Intl.DateTimeFormat("en", { timeZone: value });
            } catch {
                throw createError("Choose a valid timezone.", 400);
            }
        }
    }

    return normalize(await repository.mergeForUser(userId, updates));
}

module.exports = { getForUser, updateForUser };
