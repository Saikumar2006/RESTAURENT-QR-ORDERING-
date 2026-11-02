const express = require("express");
const communicationsController = require("../controllers/communicationsController");
const { requirePlatformAuth, requirePlatformPermission } = require("../middleware/auth");

const router = express.Router();

// Public Twilio Webhook (no platform auth required, signature validated internally)
router.post("/twilio/webhook/status", express.urlencoded({ extended: true }), communicationsController.twilioStatusWebhook);

// Platform Super Admin routes
router.get("/status", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), communicationsController.getStatus);
router.post("/test-connection", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), communicationsController.testTwilioConnection);
router.post("/test", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), communicationsController.sendTestMessage);
router.get("/stats", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), communicationsController.getStats);
router.get("/templates", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), communicationsController.listTemplates);
router.put("/templates/:key", requirePlatformAuth, requirePlatformPermission("platform.restaurants.manage"), communicationsController.updateTemplate);
router.get("/logs", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), communicationsController.listLogs);

module.exports = router;
