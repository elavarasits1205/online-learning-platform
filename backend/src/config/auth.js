// ========================================
// Authentication Configuration
// ========================================

const accessSecret =
    process.env.JWT_ACCESS_SECRET;

const cookieSameSite =
    String(process.env.COOKIE_SAME_SITE || "lax").trim().toLowerCase();

if (!["strict", "lax", "none"].includes(cookieSameSite)) {
    throw new Error(
        "COOKIE_SAME_SITE must be one of: strict, lax, none"
    );
}

if (!accessSecret) {

    throw new Error(
        "JWT_ACCESS_SECRET is not configured"
    );
}


module.exports = {

    // ========================================
    // JWT
    // ========================================

    jwt: {

        accessSecret,

        accessExpiresIn:
            process.env.JWT_ACCESS_EXPIRES_IN || "15m",

        refreshExpiresIn:
            process.env.JWT_REFRESH_EXPIRES_IN || "7d",

        issuer:
            process.env.JWT_ISSUER || "olp-backend",

        audience:
            process.env.JWT_AUDIENCE || "olp-frontend"
    },


    // ========================================
    // HTTP-ONLY AUTH COOKIES
    // ========================================

    cookie: {

        accessName:
            process.env.COOKIE_ACCESS_NAME || "olp_access_token",

        refreshName:
            process.env.COOKIE_REFRESH_NAME || "olp_refresh_token",

        userName:
            process.env.COOKIE_USER_NAME || "olp_user",

        accessPath:
            process.env.COOKIE_ACCESS_PATH || "/api",

        refreshPath:
            process.env.COOKIE_REFRESH_PATH || "/api/auth",

        userPath:
            process.env.COOKIE_USER_PATH || "/",

        // Auth cookies are HTTPS-only in every environment.
        secure: true,

        // "lax" is safe for same-site SPA + API deployments.
        // Use "none" (with HTTPS) only when the SPA and API are on
        // different sites.
        sameSite: cookieSameSite,

        domain:
            process.env.COOKIE_DOMAIN || undefined
    },


    // ========================================
    // BCRYPT
    // ========================================

    bcrypt: {

        saltRounds:
            Number(
                process.env.BCRYPT_SALT_ROUNDS || 12
            )
    }

};
