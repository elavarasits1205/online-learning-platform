const express = require("express");

const router = express.Router();

const instructorAdminController =
    require("../controller/instructoradmincontroller");

const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

router.get(
    "/",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_VIEW"),
    instructorAdminController.getAllInstructors
);

router.get(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_VIEW"),
    instructorAdminController.getInstructorById
);

module.exports = router;
