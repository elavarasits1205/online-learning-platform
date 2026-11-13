// backend/src/controller/payment.controller.js
// Thin controller layer: delegates to the existing payment workflow.
// Request/response behavior and response JSON are preserved by the service methods.
const paymentService = require("../services/payment.service");

module.exports = {
    createOrder: (req, res, next) =>
        paymentService.createOrder(req, res, next),

    verifyPayment: (req, res, next) =>
        paymentService.verifyPayment(req, res, next),

    getAutomaticCoupon: (req, res, next) =>
        paymentService.getAutomaticCoupon(req, res, next),

    applyCoupon: (req, res, next) =>
        paymentService.applyCoupon(req, res, next),

    confirmDemoCheckout: (req, res, next) =>
        paymentService.confirmDemoCheckout(req, res, next)
};
