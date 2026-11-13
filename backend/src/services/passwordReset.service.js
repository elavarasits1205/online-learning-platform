const crypto = require("crypto");
const authRepository = require("../repositories/auth.repository");
const resetRepository = require("../repositories/passwordReset.repository");
const emailService = require("./email.service");
const { hashPassword } = require("../utils/password");
const authConfig = require("../config/auth");

const GENERIC_REQUEST_MESSAGE = "If an account exists for that email, a password reset link and code have been sent.";

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function hashResetSecret(kind, value) {
    return crypto.createHmac("sha256", authConfig.jwt.accessSecret)
        .update(`${kind}:${value}`)
        .digest("hex");
}

function hashesMatch(expected, actual) {
    const expectedBuffer = Buffer.from(expected || "", "hex");
    const actualBuffer = Buffer.from(actual || "", "hex");
    return expectedBuffer.length === 32 && actualBuffer.length === 32 && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function validateEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requestPasswordReset(emailInput) {
    const email = normalizeEmail(emailInput);
    if (!validateEmail(email)) throw createError("Enter a valid email address.", 400);
    if (!emailService.canDeliverPasswordResetEmail()) {
        throw createError("Password reset email is not configured on the server.", 503);
    }

    const deliveryMode = emailService.isConfigured()
        ? "email"
        : "development";

    const user = await authRepository.findUserByEmail(email);
    if (!user) return {
        message: GENERIC_REQUEST_MESSAGE,
        deliveryMode,
    };

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const linkToken = crypto.randomBytes(32).toString("hex");
    const challenge = await resetRepository.createChallenge({
        userId: user.id,
        email,
        otpHash: hashResetSecret("otp", otp),
        linkTokenHash: hashResetSecret("link", linkToken),
    });
    if (!challenge) return {
        message: GENERIC_REQUEST_MESSAGE,
        deliveryMode,
    };

    const frontendOrigin = String(process.env.FRONTEND_URL || "http://localhost:5173")
        .split(",")[0].trim().replace(/\/+$/, "");
    const resetUrl = `${frontendOrigin}/reset-password#token=${encodeURIComponent(linkToken)}&email=${encodeURIComponent(email)}`;

    try {
        await emailService.sendPasswordResetEmail({
            to: user.email,
            firstName: user.first_name,
            otp,
            resetUrl,
        });
    } catch (error) {
        await resetRepository.consumeChallenge(challenge.id).catch(() => {});
        console.error("Password reset email delivery failed:", error.message);
        throw createError("We could not send the reset email. Check the server's SMTP settings and try again.", 503);
    }

    return {
        message: GENERIC_REQUEST_MESSAGE,
        deliveryMode,
    };
}

async function verifyResetOtp({ email: emailInput, token, otp }) {
    const email = normalizeEmail(emailInput);
    const normalizedOtp = String(otp || "").trim();
    if (!validateEmail(email) || !/^[0-9]{6}$/.test(normalizedOtp) || !/^[a-f0-9]{64}$/i.test(String(token || ""))) {
        throw createError("The reset link or code is invalid or expired.", 400);
    }

    const challenge = await resetRepository.findChallengeForOtp(
        email,
        hashResetSecret("link", String(token)),
    );
    if (!challenge) throw createError("The reset link or code is invalid or expired.", 400);

    if (!hashesMatch(challenge.otp_hash, hashResetSecret("otp", normalizedOtp))) {
        await resetRepository.incrementFailedOtp(challenge.id);
        throw createError("The reset link or code is invalid or expired.", 400);
    }

    const resetTicket = crypto.randomBytes(32).toString("hex");
    const saved = await resetRepository.saveVerifiedTicket(
        challenge.id,
        hashResetSecret("ticket", resetTicket),
    );
    if (!saved) throw createError("The reset link or code is invalid or expired.", 400);

    return { reset_ticket: resetTicket };
}

async function resetPassword({ email: emailInput, resetTicket, newPassword }) {
    const email = normalizeEmail(emailInput);
    const password = String(newPassword || "");
    if (!validateEmail(email) || !/^[a-f0-9]{64}$/i.test(String(resetTicket || ""))) {
        throw createError("Your password reset session is invalid or expired. Request a new reset link.", 400);
    }
    if (password.length < 8) throw createError("Password must be at least 8 characters.", 400);
    if (Buffer.byteLength(password, "utf8") > 72) throw createError("Password must be no more than 72 bytes.", 400);

    const passwordHash = await hashPassword(password);
    const updated = await resetRepository.completePasswordReset({
        email,
        ticketHash: hashResetSecret("ticket", String(resetTicket)),
        passwordHash,
    });
    if (!updated) throw createError("Your password reset session is invalid or expired. Request a new reset link.", 400);
    return { message: "Your password has been reset. Sign in with your new password." };
}

module.exports = { requestPasswordReset, verifyResetOtp, resetPassword };
