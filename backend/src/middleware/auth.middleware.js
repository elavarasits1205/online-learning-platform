const {
    verifyAccessToken
} = require("../services/token.service");

const authRepository =
    require("../repositories/auth.repository");

const {
    getAccessToken
} = require("../utils/cookies");

// ============================================================
// AUTHENTICATE + LOAD CURRENT RBAC DATA
// ============================================================

async function authenticate(req, res, next) {
    try {
        // Preferred source: HttpOnly cookie set at login.
        let token = getAccessToken(req);

        // Fallback for Swagger/API clients that send a Bearer header.
        const authorization = req.headers.authorization;

        if (!token && authorization) {
            const parts = authorization.trim().split(/\s+/);

            if (
                parts.length !== 2 ||
                parts[0].toLowerCase() !== "bearer" ||
                !parts[1]
            ) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid authorization format"
                });
            }

            token = parts[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authorization token is required"
            });
        }

        const decoded = verifyAccessToken(token);

        // Preserve PostgreSQL BIGINT IDs as strings.
        const userId = String(decoded.sub ?? "").trim();

        if (!/^[1-9]\d*$/.test(userId)) {
            return res.status(401).json({
                success: false,
                message: "Invalid user identity in access token"
            });
        }

        // Load the current account from PostgreSQL.
        const user = await authRepository.findUserById(userId);

        if (!user || user.soft_delete) {
            return res.status(401).json({
                success: false,
                message: "User account not found"
            });
        }

        if (Number(decoded.sv ?? 0) !== Number(user.session_version ?? 0)) {
            return res.status(401).json({
                success: false,
                message: "This session has ended. Please sign in again."
            });
        }

        if (
            !user.is_active ||
            user.is_locked ||
            user.approval_status !== "APPROVED"
        ) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive, locked, or not approved"
            });
        }

        // Load current RBAC assignments.
        const [roles, permissions] = await Promise.all([
            authRepository.getUserRoles(userId),
            authRepository.getUserPermissions(userId)
        ]);

        req.user = {
            id: userId,
            email: user.email,
            username: user.username,
            roles: roles.map(role => role.code),
            permissions: permissions.map(
                permission => permission.code
            )
        };

        return next();
    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired access token"
            });
        }

        return next(error);
    }
}

// ============================================================
// OPTIONAL AUTHENTICATION
// ============================================================

function optionalAuthenticate(req, res, next) {
    if (
        !getAccessToken(req) &&
        !req.headers.authorization
    ) {
        return next();
    }

    return authenticate(req, res, next);
}

// ============================================================
// REQUIRE ROLE
// ============================================================

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const userRoles = Array.isArray(req.user.roles)
            ? req.user.roles
            : [];

        const hasRole = userRoles.some(role =>
            allowedRoles.includes(role)
        );

        if (!hasRole) {
            return res.status(403).json({
                success: false,
                message: "Access denied: insufficient role"
            });
        }

        return next();
    };
}

// ============================================================
// REQUIRE PERMISSION
// ============================================================

function requirePermission(...requiredPermissions) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const userPermissions = Array.isArray(req.user.permissions)
            ? req.user.permissions
            : [];

        const hasPermissions = requiredPermissions.every(
            permission => userPermissions.includes(permission)
        );

        if (!hasPermissions) {
            return res.status(403).json({
                success: false,
                message: "Permission denied"
            });
        }

        return next();
    };
}

function requireRoleOrPermission(allowedRoles = [], ...requiredPermissions) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const roles = Array.isArray(req.user.roles)
            ? req.user.roles.map((role) =>
                String(typeof role === "string" ? role : role?.code ?? role?.name ?? "")
                    .trim()
                    .toUpperCase()
            )
            : [];
        const permissions = Array.isArray(req.user.permissions)
            ? req.user.permissions.map((permission) =>
                String(
                    typeof permission === "string"
                        ? permission
                        : permission?.code ?? permission?.permission_code ?? ""
                )
                    .trim()
                    .toUpperCase()
            )
            : [];

        const roleAllowed = allowedRoles.some((role) =>
            roles.includes(String(role).trim().toUpperCase())
        );
        const permissionAllowed = requiredPermissions.some((permission) =>
            permissions.includes(String(permission).trim().toUpperCase())
        );

        if (!roleAllowed && !permissionAllowed) {
            return res.status(403).json({
                success: false,
                message: "Permission denied"
            });
        }

        return next();
    };
}

module.exports = {
    authenticate,
    requireRole,
    requirePermission,
    requireRoleOrPermission,
    optionalAuthenticate
};
