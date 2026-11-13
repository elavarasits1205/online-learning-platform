const authService =
    require("../services/auth.service");

const {
    getCreateAudit
} = require("../utils/audit");

const {
    setAuthCookies,
    setUserCookie,
    clearAuthCookies,
    getRefreshToken
} = require("../utils/cookies");


// ============================================================
// REGISTER STUDENT
// ============================================================

async function registerStudent(req, res, next) {

    try {

        // Public registration
        // Therefore createdBy = NULL

        const {
            createdBy
        } = getCreateAudit(
            req,
            false
        );


        const result =
            await authService.registerStudent(
                req.body,
                {
                    createdBy
                }
            );


        return res.status(201).json({

            success: true,

            message:
                "Student registered successfully",

            data:
                result
        });

    } catch (error) {

        next(error);
    }
}


// ============================================================
// REGISTER INSTRUCTOR
// ============================================================

async function registerInstructor(req, res, next) {

    try {

        // Public registration
        // Therefore createdBy = NULL

        const {
            createdBy
        } = getCreateAudit(
            req,
            false
        );


        const result =
            await authService.registerInstructor(
                req.body,
                {
                    createdBy
                }
            );


        return res.status(201).json({

            success: true,

            message:
                "Instructor registration submitted successfully. Waiting for admin approval.",

            data:
                result
        });

    } catch (error) {

        next(error);
    }
}


// ============================================================
// LOGIN
// ============================================================

async function login(req, res, next) {

    try {

        const {
            identifier,
            password
        } = req.body;


        if (!identifier || !password) {

            const error =
                new Error(
                    "Identifier and password are required"
                );

            error.statusCode = 400;

            throw error;
        }


        const result =
            await authService.login(
                identifier,
                password,
                req.ip,
                req.get("user-agent")
            );


        // Tokens are delivered as HttpOnly cookies and are
        // never exposed to browser JavaScript.
        setAuthCookies(res, result, req);


        const {
            accessToken,
            refreshToken,
            refreshTokenExpiresAt,
            ...safeResult
        } = result;


        // Store the full login details (user, roles, permissions)
        // in the readable user cookie.
        setUserCookie(res, safeResult, req);


        return res.status(200).json({

            success: true,

            message:
                "Login successful",

            data:
                safeResult
        });

    } catch (error) {

        next(error);
    }
}


// ============================================================
// REFRESH
// ============================================================

async function refresh(req, res, next) {

    try {

        // Refresh tokens are accepted only from the HttpOnly cookie.
        const refreshToken = getRefreshToken(req);


        if (!refreshToken) {

            const error =
                new Error(
                    "Refresh token is required"
                );

            error.statusCode = 400;

            throw error;
        }


        const result =
            await authService.refreshAccessToken(
                refreshToken,
                req.ip,
                req.get("user-agent")
            );


        // Rotate both cookies with the new token pair.
        setAuthCookies(res, result, req);


        const {
            accessToken,
            refreshToken: newRefreshToken,
            refreshTokenExpiresAt,
            ...safeResult
        } = result;


        return res.status(200).json({

            success: true,

            message:
                "Access token refreshed successfully",

            data:
                safeResult
        });

    } catch (error) {

        // An expired/revoked refresh token must not stay in the browser.
        clearAuthCookies(res, req);

        next(error);
    }
}


// ============================================================
// LOGOUT
// ============================================================

async function logout(req, res, next) {

    try {

        const refreshToken = getRefreshToken(req);


        await authService.logout(
            refreshToken,
            req.user?.id ?? null
        );


        // Remove both auth cookies from the browser.
        clearAuthCookies(res, req);


        return res.status(200).json({

            success: true,

            message:
                "Logout successful"
        });

    } catch (error) {

        // Clear the browser session even if revoking the refresh token fails.
        clearAuthCookies(res, req);
        next(error);
    }
}

async function changePassword(req, res, next) {
    try {
        const result = await authService.changePassword(
            req.user.id,
            req.body?.currentPassword,
            req.body?.newPassword
        );
        clearAuthCookies(res, req);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return next(error);
    }
}

async function logoutAll(req, res, next) {
    try {
        const result = await authService.logoutAll(req.user.id);
        clearAuthCookies(res, req);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return next(error);
    }
}


// ============================================================
// CURRENT USER
// ============================================================

async function me(req, res, next) {

    try {

        const result =
            await authService.getCurrentUser(
                req.user.id
            );


        // Keep the readable login-details cookie in sync with
        // the current user, roles and permissions.
        setUserCookie(res, result, req);


        return res.status(200).json({

            success: true,

            data:
                result
        });

    } catch (error) {

        next(error);
    }
}


// ============================================================
// UPDATE CURRENT USER PROFILE
// ============================================================

async function updateMe(req, res, next) {
    try {
        const result = await authService.updateCurrentUserProfile(
            req.user.id,
            req.body,
            req
        );

        // Keep the SPA's readable user details cookie in sync with the DB.
        setUserCookie(res, result, req);

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: result
        });
    } catch (error) {
        next(error);
    }
}


module.exports = {
    registerStudent,
    registerInstructor,
    login,
    refresh,
    logout,
    updateMe,
    changePassword,
    logoutAll,
    me
};
