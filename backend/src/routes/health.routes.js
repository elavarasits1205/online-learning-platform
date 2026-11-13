const express = require("express");

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Check API health
 *     description: Check whether the OLP backend API is running.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: API is running successfully
 */
router.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "OLP Backend API is running",
        timestamp: new Date().toISOString()
    });
});

module.exports = router;