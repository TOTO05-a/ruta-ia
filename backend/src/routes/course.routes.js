const express = require("express");
const controller = require("../controllers/course.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const admin = [requireAuth, requireAdmin];

router.get("/courses", controller.list);
router.get("/courses/:id", controller.get);
router.get("/admin/courses", ...admin, controller.adminList);
router.get("/admin/courses/:id", ...admin, controller.adminGet);
router.post("/admin/courses", ...admin, controller.create);
router.patch("/admin/courses/:id", ...admin, controller.update);
router.patch("/admin/courses/:id/status", ...admin, controller.setStatus);

module.exports = router;
