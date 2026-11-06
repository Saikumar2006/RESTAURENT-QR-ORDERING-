const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireAiAccess } = require("../middleware/aiAuth");
const controller = require("../controllers/aiController");

const router = express.Router();

// All AI endpoints require tenant authentication & active subscription/trial
router.use(requireAuth);
router.use(requireAiAccess);

// Status & capabilities
router.get("/status", controller.getAiStatus);
router.get("/menu-assist/status", controller.menuAssistStatus);

// Conversations lifecycle
router.get("/conversations", controller.listConversations);
router.post("/conversations", controller.createConversation);
router.get("/conversations/:id", controller.getConversation);
router.delete("/conversations/:id", controller.deleteConversation);
router.post("/conversations/:id/clear", controller.clearConversation);

// Messaging & conversational tool loop
router.post("/chat", controller.sendMessage);

// Two-step action proposal management
router.get("/proposals", controller.listProposals);
router.post("/proposals/:id/execute", controller.executeProposal);
router.post("/proposals/:id/reject", controller.rejectProposal);

// Direct intelligence endpoints
router.get("/forecast", controller.getInventoryForecast);
router.get("/festivals", controller.getUpcomingFestivalDemand);

module.exports = router;
