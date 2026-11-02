const express = require("express");
const controller = require("../controllers/query.controller");
const requireAuth = require("../middleware/require-auth");
const requireN8nCallback = require("../middleware/require-n8n-callback");
const requireN8nSync = require("../middleware/require-n8n-sync");
const internalController = require("../controllers/internal.controller");

const router = express.Router();

router.post("/queries", requireAuth, controller.create);
router.get("/queries", requireAuth, controller.list);
router.get("/queries/:id", requireAuth, controller.get);
router.get("/students/:id/history", requireAuth, controller.studentHistory);
router.post("/internal/n8n/results", requireN8nCallback, controller.callback);
router.get("/internal/courses/active", requireN8nSync, internalController.activeCourses);
router.get("/internal/rag/index-config", requireN8nSync, internalController.indexingConfig);

module.exports = router;
