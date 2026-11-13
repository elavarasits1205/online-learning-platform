const express = require("express");

const router = express.Router();

const controller =
    require("../controller/rbac.controller");

const {
    authenticate,
    requireRole
} = require("../middleware/auth.middleware");


// ============================================================
// SWAGGER DOCUMENTATION
// ============================================================

/**
 * @swagger
 * tags:
 *   name: RBAC
 *   description: Role-based access control APIs
 */


// All RBAC endpoints require a valid access token.
router.use(authenticate);


// ============================================================
// CURRENT USER ACCESS
// ============================================================

/**
 * @swagger
 * /api/rbac/me:
 *   get:
 *     summary: Get current user's roles and permissions
 *     tags: [RBAC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user's access details
 *       401:
 *         description: Authentication required
 */
router.get(
    "/me",
    controller.getMyAccess
);


// ============================================================
// LIST ROLES
// ============================================================

/**
 * @swagger
 * /api/rbac/roles:
 *   get:
 *     summary: List roles
 *     tags: [RBAC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles returned successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 */
router.get(
    "/roles",
    requireRole("ADMIN"),
    controller.listRoles
);


// ============================================================
// LIST PERMISSIONS
// ============================================================

/**
 * @swagger
 * /api/rbac/permissions:
 *   get:
 *     summary: List permissions
 *     tags: [RBAC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions returned successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 */
router.get(
    "/permissions",
    requireRole("ADMIN"),
    controller.listPermissions
);


module.exports = router;

