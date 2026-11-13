const express = require("express");

const studentController = require("../controller/studentadmin.controller");

const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
    "/",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_VIEW"),
    studentController.getAllStudents
);

router.get(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "USER_VIEW"),
    studentController.getStudentById
);

module.exports = router;
