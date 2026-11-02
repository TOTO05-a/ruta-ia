const express = require("express");
const controller = require("../controllers/student.controller");
const requireAuth = require("../middleware/require-auth");
const requireAdmin = require("../middleware/require-admin");

const router = express.Router();

router.patch("/students/me", requireAuth, controller.updateMe);
router.get("/students", requireAuth, requireAdmin, controller.list);
router.get("/students/:id", requireAuth, requireAdmin, controller.getById);

module.exports = router;
