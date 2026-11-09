const express = require("express");
const controller = require("../controllers/account.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.post("/auth/register", controller.register);
router.post("/auth/login", controller.login);
router.post("/auth/token", controller.token);
router.post("/auth/logout", requireAuth, controller.logout);
router.get("/auth/me", requireAuth, controller.me);
router.get("/auth/csrf", requireAuth, controller.csrf);

router.patch("/students/me", requireAuth, controller.updateMe);
router.get("/students", requireAuth, requireAdmin, controller.list);
router.get("/students/:id", requireAuth, requireAdmin, controller.getById);

module.exports = router;
