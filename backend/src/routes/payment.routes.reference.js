// Route wiring reference only — keep your existing middleware and route paths.
// backend/src/routes/payment.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const paymentController = require("../controller/payment.controller");

// If your current project uses a different middleware export/signature,
// retain the existing middleware lines and replace only the controller import.
router.post("/create-order", authenticate, requireRole("STUDENT"), paymentController.createOrder);
router.post("/verify", authenticate, requireRole("STUDENT"), paymentController.verifyPayment);
router.post("/apply-coupon", authenticate, requireRole("STUDENT"), paymentController.applyCoupon);
router.post("/demo-checkout", authenticate, requireRole("STUDENT"), paymentController.confirmDemoCheckout);

module.exports = router;
