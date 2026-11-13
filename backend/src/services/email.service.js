const nodemailer = require("nodemailer");

let transporter;

function getSmtpSettings() {
    const host = String(process.env.SMTP_HOST || "").trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const user = String(process.env.SMTP_USER || "").trim();
    const password = String(process.env.SMTP_PASSWORD || "");
    const from = String(process.env.SMTP_FROM || user).trim();

    console.log("[SMTP DEBUG]", {
        host,
        port,
        user,
        passwordExists: Boolean(password),
        passwordLength: password.length,
        from,
    });

    const secure =
        String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
        port === 465;

    if (
        !host ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535 ||
        !from ||
        Boolean(user) !== Boolean(password)
    ) {
        return null;
    }

    return {
        host,
        port,
        secure,
        ...(user ? { auth: { user, pass: password } } : {}),
        from,
    };
}

function isConfigured() {
    return Boolean(getSmtpSettings());
}

function isDevelopmentFallbackEnabled() {
    return process.env.NODE_ENV !== "production" &&
        String(process.env.PASSWORD_RESET_DEV_MODE || "").toLowerCase() === "true";
}

function canDeliverPasswordResetEmail() {
    return isConfigured() || isDevelopmentFallbackEnabled();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    })[character]);
}

async function sendPasswordResetEmail({ to, firstName, otp, resetUrl }) {
    const settings = getSmtpSettings();
    if (!settings) {
        if (isDevelopmentFallbackEnabled()) {
            console.warn(
                "[password-reset:development] SMTP is not configured. Reset link: %s | OTP: %s",
                resetUrl,
                otp,
            );
            return { mode: "development" };
        }

        const error = new Error("SMTP email settings are not configured.");
        error.statusCode = 503;
        throw error;
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: settings.host,
            port: settings.port,
            secure: settings.secure,
            ...(settings.auth ? { auth: settings.auth } : {}),
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
        });
    }

    const greeting = escapeHtml(firstName || "there");
    await transporter.sendMail({
        from: settings.from,
        to,
        subject: "Reset your Learnova password",
        text: `Hi ${firstName || "there"},\n\nUse this link to reset your Learnova password:\n${resetUrl}\n\nYour one-time verification code is ${otp}. It expires in 15 minutes. If you did not request this, you can ignore this email.`,
        html: `<!doctype html><html><body style="margin:0;background:#f7f6fc;font-family:Arial,sans-serif;color:#17152b"><div style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e9e8f2;border-radius:16px"><p style="margin:0 0 8px;color:#6d4aff;font-size:12px;font-weight:700;letter-spacing:1.5px">LEARNOVA ACCOUNT</p><h1 style="margin:0 0 16px;font-size:24px">Reset your password</h1><p>Hi ${greeting}, we received a request to reset your password.</p><p style="margin:24px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#6d4aff;border-radius:8px;color:#fff;font-weight:700;text-decoration:none">Continue password reset</a></p><p>Enter this one-time code on the reset page:</p><p style="padding:16px;border-radius:10px;background:#f3f0ff;color:#4320c7;font-size:28px;font-weight:800;letter-spacing:8px;text-align:center">${otp}</p><p style="color:#6e7086;font-size:13px">The link and code expire in 15 minutes. If you did not request this, ignore this email.</p></div></body></html>`,
    });
    return { mode: "smtp" };
}

module.exports = {
    isConfigured,
    isDevelopmentFallbackEnabled,
    canDeliverPasswordResetEmail,
    sendPasswordResetEmail,
};
