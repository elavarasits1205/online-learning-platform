const jwt =
    require("jsonwebtoken");

const crypto =
    require("crypto");

const authConfig =
    require("../config/auth");


// ============================================================
// GENERATE ACCESS TOKEN
// ============================================================

function generateAccessToken({

    userId,

    email,

    username,

    sessionVersion = 0,

    roles = [],

    permissions = []

}) {

    return jwt.sign(

        {
            // IMPORTANT
            // auth.middleware reads decoded.sub

            sub:
                String(userId),

            email,

            username,

            sv: Number(sessionVersion) || 0,

            roles,

            permissions
        },

        authConfig.jwt.accessSecret,

        {
            expiresIn:
                authConfig.jwt.accessExpiresIn,

            issuer:
                authConfig.jwt.issuer,

            audience:
                authConfig.jwt.audience
        }
    );
}


// ============================================================
// VERIFY ACCESS TOKEN
// ============================================================

function verifyAccessToken(
    token
) {

    return jwt.verify(
        token,
        authConfig.jwt.accessSecret,
        {
            issuer:
                authConfig.jwt.issuer,

            audience:
                authConfig.jwt.audience
        }
    );
}


// ============================================================
// REFRESH TOKEN
// ============================================================

function generateRefreshToken() {

    return crypto
        .randomBytes(64)
        .toString("hex");
}


function hashRefreshToken(
    token
) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


// ============================================================
// DURATION
// ============================================================

function parseDurationToMilliseconds(
    value
) {

    if (
        typeof value === "number"
    ) {

        return value * 1000;
    }


    const match =
        /^(\d+)(s|m|h|d)$/i
            .exec(String(value));


    if (!match) {

        throw new Error(
            `Invalid duration format: ${value}`
        );
    }


    const amount =
        Number(match[1]);


    const unit =
        match[2].toLowerCase();


    const multipliers = {

        s: 1000,

        m: 60 * 1000,

        h: 60 * 60 * 1000,

        d: 24 * 60 * 60 * 1000
    };


    return (
        amount *
        multipliers[unit]
    );
}


// ============================================================
// REFRESH EXPIRY
// ============================================================

function getRefreshTokenExpiry() {

    const milliseconds =
        parseDurationToMilliseconds(
            authConfig.jwt.refreshExpiresIn
        );


    return new Date(
        Date.now() + milliseconds
    );
}


// ============================================================
// ACCESS EXPIRY
// ============================================================

function getAccessTokenExpiryInSeconds() {

    const milliseconds =
        parseDurationToMilliseconds(
            authConfig.jwt.accessExpiresIn
        );


    return Math.floor(
        milliseconds / 1000
    );
}


module.exports = {

    generateAccessToken,

    verifyAccessToken,

    generateRefreshToken,

    hashRefreshToken,

    getRefreshTokenExpiry,

    getAccessTokenExpiryInSeconds
};
