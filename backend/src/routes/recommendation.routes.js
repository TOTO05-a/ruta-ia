const express = require("express");
const ratingController = require("../controllers/rating.controller");
const statisticsController = require("../controllers/statistics.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.post("/recommendations/:id/rating", requireAuth, ratingController.create);
router.get("/admin/statistics", requireAuth, requireAdmin, statisticsController.get);

module.exports = router;
