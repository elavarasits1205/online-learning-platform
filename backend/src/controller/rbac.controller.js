const rbacRepository =
    require("../repositories/rbac.repository");


// ============================================================
// CURRENT USER ACCESS
// ============================================================



async function getMyAccess(req, res, next) {
    try {
        const data = await rbacRepository.getUserAccess(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: {
                userId: req.user.id,
                roles: data.roles.map((role) => role.code),
                permissions: data.permissions.map(
                    (permission) => permission.code
                ),
                menus: data.menus,
            },
        });
    } catch (error) {
        console.error("\n========== GET /api/rbac/me FAILED ==========");
        console.error("Message:", error.message);
        console.error("PostgreSQL code:", error.code);
        console.error("Detail:", error.detail);
        console.error("Hint:", error.hint);
        console.error("Position:", error.position);
        console.error("Where:", error.where);
        console.error("Stack:", error.stack);
        console.error("============================================\n");

        return next(error);
    }
}


// ============================================================
// LIST ROLES
// ============================================================

async function listRoles(req, res, next) {
    try {
        const data = await rbacRepository.listRoles();

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}


// ============================================================
// LIST PERMISSIONS
// ============================================================

async function listPermissions(req, res, next) {
    try {
        const data = await rbacRepository.listPermissions();

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}


module.exports = {
    getMyAccess,
    listRoles,
    listPermissions
};