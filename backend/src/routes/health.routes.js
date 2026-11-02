const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "rutaia-api",
        timestamp: new Date().toISOString()
    });
});

router.get("/ready", async (req, res) => {
    try {
        const pool = require("../db/pool");
        await pool.query("SELECT 1");
        return res.status(200).json({ status: "ready", dependencies: { postgres: "ok" } });
    } catch (error) {
        return res.status(503).json({
            status: "not_ready",
            dependencies: { postgres: "unavailable" },
            requestId: req.requestId
        });
    }
});

module.exports = router;
