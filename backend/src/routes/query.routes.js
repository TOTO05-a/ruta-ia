const express = require("express");
const controller = require("../controllers/query.controller");
const { requireAuth } = require("../middleware/auth");
const requireN8nCallback = require("../middleware/require-n8n-callback");
const requireN8nSync = require("../middleware/require-n8n-sync");
const internalController = require("../controllers/internal.controller");

const router = express.Router();

router.post("/queries", requireAuth, controller.create);
router.get("/queries", requireAuth, controller.list);
router.get("/queries/export.csv", requireAuth, controller.exportHistory);
router.get("/queries/:id", requireAuth, controller.get);
router.get("/students/:id/history", requireAuth, controller.studentHistory);
router.post("/internal/n8n/results", requireN8nCallback, controller.callback);
router.get("/internal/courses/active", requireN8nSync, internalController.activeCourses);
router.get("/internal/rag/index-config", requireN8nSync, internalController.indexingConfig);
router.get("/internal/courses/sync-config", requireN8nSync, internalController.courseSyncConfig);
router.post("/internal/courses/sync-events/claim", requireN8nSync, internalController.claimCourseSyncEvents);
router.post("/internal/courses/sync-events/ack", requireN8nSync, internalController.acknowledgeCourseSyncEvent);
router.post("/internal/ai/chat", requireN8nSync, internalController.generateChat);
router.post("/internal/ai/embeddings", requireN8nSync, internalController.generateEmbeddings);

module.exports = router;
