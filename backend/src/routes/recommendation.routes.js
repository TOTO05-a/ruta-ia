const express = require("express");
const ratingController = require("../controllers/rating.controller");
const statisticsController = require("../controllers/statistics.controller");
const requireAuth = require("../middleware/require-auth");
const requireAdmin = require("../middleware/require-admin");

const router = express.Router();

router.post("/recommendations/:id/rating", requireAuth, ratingController.create);
router.get("/admin/statistics", requireAuth, requireAdmin, statisticsController.get);

module.exports = router;
