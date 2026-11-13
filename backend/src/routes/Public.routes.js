const express = require("express");
const publicController = require("../controller/public.controller");
const courseReviewController = require("../controller/courseReview.controller");
const {
    optionalAuthenticate
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/catalog", publicController.getCatalog);

router.get(
    "/courses/:courseId",
    optionalAuthenticate,
    publicController.getCourseDetails
);
router.get(
    "/courses/:courseId/reviews",
    optionalAuthenticate,
    courseReviewController.getCourseReviews
);
router.get(
    "/institutions",
    publicController.getInstitutions
);

module.exports = router;
