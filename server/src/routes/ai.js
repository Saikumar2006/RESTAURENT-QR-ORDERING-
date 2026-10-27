const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const controller = require("../controllers/aiController");

const router = express.Router();
router.get("/menu-assist/status", requireAuth, requirePermission("menu.update"), controller.menuAssistStatus);
module.exports = router;
