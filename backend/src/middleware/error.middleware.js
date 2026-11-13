function errorHandler(error, req, res, next) {

    console.error(
        "ERROR:",
        error
    );


    const errorMap = {

        INVALID_CREDENTIALS: {
            status: 401,
            message: "Invalid username/email or password"
        },

        ACCOUNT_PENDING_APPROVAL: {
            status: 403,
            message: "Your account is waiting for admin approval"
        },

        ACCOUNT_REJECTED: {
            status: 403,
            message: "Your account registration was rejected"
        },

        ACCOUNT_DISABLED: {
            status: 403,
            message: "Your account is disabled"
        },

        ACCOUNT_LOCKED: {
            status: 403,
            message: "Your account is temporarily locked"
        },

        USERNAME_OR_EMAIL_ALREADY_EXISTS: {
            status: 409,
            message: "Username or email already exists"
        },

        USERNAME_EMAIL_OR_STUDENT_ALREADY_EXISTS: {
            status: 409,
            message:
                "Username, email, register number, or student already exists"
        },

        USERNAME_EMAIL_OR_INSTRUCTOR_ALREADY_EXISTS: {
            status: 409,
            message:
                "Username, email, or instructor already exists"
        },

        STUDENT_ROLE_NOT_FOUND: {
            status: 500,
            message: "STUDENT role is not configured"
        },

        INSTRUCTOR_ROLE_NOT_FOUND: {
            status: 500,
            message: "INSTRUCTOR role is not configured"
        },

        INVALID_INSTITUTION: {
            status: 400,
            message: "Invalid institution"
        },

        REFRESH_TOKEN_REQUIRED: {
            status: 400,
            message: "Refresh token is required"
        },

        INVALID_REFRESH_TOKEN: {
            status: 401,
            message: "Invalid refresh token"
        },

        REFRESH_TOKEN_REVOKED: {
            status: 401,
            message: "Refresh token has been revoked"
        },

        REFRESH_TOKEN_EXPIRED: {
            status: 401,
            message: "Refresh token has expired"
        },

        ACCOUNT_NOT_APPROVED: {
            status: 403,
            message: "Account is not approved"
        },

        USER_NOT_FOUND: {
            status: 404,
            message: "User not found"
        },

        USER_NOT_PENDING: {
            status: 400,
            message: "User is not pending approval"
        }
    };


    const mapped = errorMap[error.message];

    if (mapped) {
        return res.status(mapped.status).json({
            success: false,
            message: mapped.message
        });
    }

    // Services attach statusCode to expected client errors (for example,
    // invalid credentials and duplicate registrations). Preserve those
    // responses instead of turning every unmapped message into a 500.
    const statusCode = error.statusCode;
    const isClientError =
        Number.isInteger(statusCode) &&
        statusCode >= 400 &&
        statusCode < 500;

    if (isClientError) {
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Request failed"
        });
    }

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}


module.exports = errorHandler;
