const authConfig =
    require("../config/auth");

const {
    getAccessTokenExpiryInSeconds,
    getRefreshTokenExpiry
} = require("../services/token.service");


// ============================================================
// COOKIE PARSING
// ============================================================

function parseCookies(req) {

    const header =
        req?.headers?.cookie;

    if (!header) {
        return {};
    }

    return header
        .split(";")
        .reduce((cookies, pair) => {

            const separator =
                pair.indexOf("=");

            if (separator === -1) {
                return cookies;
            }

            const name =
                pair.slice(0, separator).trim();

            const value =
                pair.slice(separator + 1).trim();

            if (!name) {
                return cookies;
            }

            try {
                cookies[name] =
                    decodeURIComponent(value);
            } catch {
                cookies[name] =
                    value;
            }

            return cookies;

        }, {});
}


// ============================================================
// COOKIE MIDDLEWARE
// ============================================================

function cookieParser(req, res, next) {
    req.cookies =
        parseCookies(req);

    return next();
}


// ============================================================
// SERIALIZATION
// ============================================================

function baseOptions(req) {
    return {
        httpOnly: true,
        secure: authConfig.cookie.secure || Boolean(req?.secure),
        sameSite: authConfig.cookie.sameSite,
        domain: authConfig.cookie.domain
    };
}


function serializeCookie(
    name,
    value,
    options = {}
) {

    const parts = [
        `${name}=${encodeURIComponent(value)}`
    ];

    const path =
        options.path || "/";

    parts.push(`Path=${path}`);

    if (options.domain) {
        parts.push(`Domain=${options.domain}`);
    }

    if (options.maxAge != null) {
        parts.push(
            `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`
        );
    }

    if (options.expires) {
        parts.push(
            `Expires=${new Date(options.expires).toUTCString()}`
        );
    }

    if (options.httpOnly !== false) {
        parts.push("HttpOnly");
    }

    const sameSite =
        String(options.sameSite || "").toLowerCase();

    const normalizedSameSite =
        sameSite === "none"
            ? "None"
            : sameSite === "strict"
                ? "Strict"
                : sameSite === "lax"
                    ? "Lax"
                    : null;

    // SameSite=None is only valid together with Secure.
    if (
        options.secure ||
        normalizedSameSite === "None"
    ) {
        parts.push("Secure");
    }

    if (normalizedSameSite) {
        parts.push(`SameSite=${normalizedSameSite}`);
    }

    return parts.join("; ");
}


// ============================================================
// SET AUTH COOKIES
// ============================================================

function setAccessTokenCookie(
    res,
    accessToken,
    req
) {

    res.append(
        "Set-Cookie",
        serializeCookie(
            authConfig.cookie.accessName,
            accessToken,
            {
                ...baseOptions(req),
                path: authConfig.cookie.accessPath,
                maxAge:
                    getAccessTokenExpiryInSeconds()
            }
        )
    );
}


function setRefreshTokenCookie(
    res,
    refreshToken,
    expiresAt,
    req
) {

    res.append(
        "Set-Cookie",
        serializeCookie(
            authConfig.cookie.refreshName,
            refreshToken,
            {
                ...baseOptions(req),
                path: authConfig.cookie.refreshPath,
                expires: expiresAt
            }
        )
    );
}


function setAuthCookies(
    res,
    {
        accessToken,
        refreshToken,
        refreshTokenExpiresAt
    },
    req
) {

    if (accessToken) {
        setAccessTokenCookie(
            res,
            accessToken,
            req
        );
    }

    if (refreshToken) {
        setRefreshTokenCookie(
            res,
            refreshToken,
            refreshTokenExpiresAt,
            req
        );
    }
}


// ============================================================
// SET USER / LOGIN DETAILS COOKIE
// ============================================================
//
// This cookie is intentionally readable by the SPA so the UI
// can render the signed-in user, roles and permissions.
// It never contains access/refresh tokens or a password.

function setUserCookie(
    res,
    userData,
    req
) {

    if (!userData) {
        return;
    }

    let value;

    try {
        value = JSON.stringify(userData);
    } catch {
        return;
    }

    const maxAgeSeconds = Math.max(
        0,
        Math.floor(
            (getRefreshTokenExpiry().getTime() - Date.now()) / 1000
        )
    );

    res.append(
        "Set-Cookie",
        serializeCookie(
            authConfig.cookie.userName,
            value,
            {
                ...baseOptions(req),
                httpOnly: false,
                path: authConfig.cookie.userPath,
                maxAge: maxAgeSeconds
            }
        )
    );
}


// ============================================================
// CLEAR AUTH COOKIES
// ============================================================

function clearAuthCookies(res, req) {

    const expired = {
        maxAge: 0,
        expires: new Date(0)
    };

    res.append(
        "Set-Cookie",
        serializeCookie(
            authConfig.cookie.accessName,
            "",
            {
                ...baseOptions(req),
                path: authConfig.cookie.accessPath,
                ...expired
            }
        )
    );

    res.append(
        "Set-Cookie",
        serializeCookie(
            authConfig.cookie.refreshName,
            "",
            {
                ...baseOptions(req),
                path: authConfig.cookie.refreshPath,
                ...expired
            }
        )
    );

    res.append(
        "Set-Cookie",
        serializeCookie(
            authConfig.cookie.userName,
            "",
            {
                ...baseOptions(req),
                httpOnly: false,
                path: authConfig.cookie.userPath,
                ...expired
            }
        )
    );
}


// ============================================================
// GETTERS
// ============================================================

function getAccessToken(req) {
    return (
        req?.cookies?.[authConfig.cookie.accessName] ||
        parseCookies(req)[authConfig.cookie.accessName] ||
        null
    );
}


function getRefreshToken(req) {
    return (
        req?.cookies?.[authConfig.cookie.refreshName] ||
        parseCookies(req)[authConfig.cookie.refreshName] ||
        null
    );
}


module.exports = {
    cookieParser,
    parseCookies,
    serializeCookie,
    setAuthCookies,
    setUserCookie,
    clearAuthCookies,
    getAccessToken,
    getRefreshToken
};
