
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

    const normalizedUserRoles = userRoles.map(role =>
      String(role).trim().toLowerCase()
    );

    const normalizedAllowedRoles = allowedRoles.map(role =>
      String(role).trim().toLowerCase()
    );

    const hasRole = normalizedAllowedRoles.some(role =>
      normalizedUserRoles.includes(role)
    );

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    return next();
  };
}

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

    const normalizedUserPermissions = userPermissions.map(permission =>
      String(permission).trim().toLowerCase()
    );

    const normalizedRequiredPermissions = requiredPermissions.map(permission =>
      String(permission).trim().toLowerCase()
    );

    const hasPermissions = normalizedRequiredPermissions.every(permission =>
      normalizedUserPermissions.includes(permission)
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
      ? req.user.roles.map(role =>
          String(typeof role === "string" ? role : role?.code ?? role?.name ?? "")
            .trim()
            .toLowerCase()
        )
      : [];
    const permissions = Array.isArray(req.user.permissions)
      ? req.user.permissions.map(permission =>
          String(
            typeof permission === "string"
              ? permission
              : permission?.code ?? permission?.permission_code ?? ""
          )
            .trim()
            .toLowerCase()
        )
      : [];

    const roleAllowed = allowedRoles.some(role =>
      roles.includes(String(role).trim().toLowerCase())
    );
    const permissionAllowed = requiredPermissions.some(permission =>
      permissions.includes(String(permission).trim().toLowerCase())
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
  requireRole,
  requirePermission,
  requireRoleOrPermission
};
