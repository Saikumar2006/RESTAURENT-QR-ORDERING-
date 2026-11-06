const express = require("express");
const platformController = require("../controllers/platformController");
const { requirePlatformAuth, requirePlatformPermission } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { loginSchema, platformRoleUpdateSchema, platformRestaurantCreateSchema, accountActivationSchema } = require("../validators/schemas");
const { z } = require("zod");

const router = express.Router();

// Public platform authentication & activation routes
router.post("/login", validateBody(loginSchema), platformController.login);
router.post("/logout", platformController.logout);
router.get("/invitations/:token", platformController.getRestaurantInvitation);
router.post("/invitations/:token/activate", validateBody(accountActivationSchema), platformController.activateRestaurantInvitation);

// Protected session & profile
router.get("/me", requirePlatformAuth, platformController.me);
router.post("/password", requirePlatformAuth, validateBody(z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})), platformController.changePassword);

// Overview & Analytics
router.get("/overview", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), platformController.getOverview);

// Tenant Management
router.get("/restaurants", requirePlatformAuth, requirePlatformPermission("platform.restaurants.view"), platformController.listRestaurants);
router.get("/restaurants/:id", requirePlatformAuth, requirePlatformPermission("platform.restaurants.view"), platformController.getRestaurantDetail);
router.put("/restaurants/:id/status", requirePlatformAuth, requirePlatformPermission("platform.restaurants.manage"), validateBody(z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().max(500).optional(),
})), platformController.updateRestaurantStatus);
router.post("/restaurants", requirePlatformAuth, requirePlatformPermission("platform.restaurants.manage"), validateBody(platformRestaurantCreateSchema), platformController.createRestaurant);
router.post("/restaurants/:id/invitation", requirePlatformAuth, requirePlatformPermission("platform.restaurants.manage"), validateBody(z.object({ reason: z.string().trim().min(8).max(500) })), platformController.issueOwnerInvitation);

// Cross-Tenant User Management
router.get("/users", requirePlatformAuth, requirePlatformPermission("platform.restaurants.view"), platformController.listUsers);
router.put("/users/:id/status", requirePlatformAuth, requirePlatformPermission("platform.restaurants.manage"), validateBody(z.object({
  isActive: z.boolean(),
})), platformController.toggleUserStatus);

// Role & Admin Identity Management
router.get("/admins", requirePlatformAuth, requirePlatformPermission("platform.admins.manage"), platformController.listAdmins);
router.put("/admins/:id/role", requirePlatformAuth, requirePlatformPermission("platform.admins.manage"), validateBody(platformRoleUpdateSchema), platformController.updateAdminRole);
router.get("/audit", requirePlatformAuth, requirePlatformPermission("platform.audit.view"), platformController.listAudit);

// SaaS Subscriptions, Packages & Pricing
router.get("/packages", requirePlatformAuth, platformController.getPackages);
router.put("/packages", requirePlatformAuth, requirePlatformPermission("platform.restaurants.manage"), platformController.updatePackages);
router.get("/subscriptions", requirePlatformAuth, requirePlatformPermission("platform.restaurants.view", "platform.finance.view"), platformController.listSubscriptions);
router.get("/transactions", requirePlatformAuth, requirePlatformPermission("platform.finance.view"), platformController.listTransactions);
router.get("/pending-onboardings", requirePlatformAuth, requirePlatformPermission("platform.restaurants.view"), platformController.listPendingOnboardings);
router.get("/onboarding-funnel", requirePlatformAuth, requirePlatformPermission("platform.restaurants.view"), platformController.getOnboardingFunnel);

// Support & Operations
router.get("/tickets", requirePlatformAuth, requirePlatformPermission("platform.support.manage"), platformController.listSupportTickets);
router.post("/tickets", requirePlatformAuth, requirePlatformPermission("platform.support.manage"), validateBody(z.object({
  restaurantId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(3000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z.enum(["BILLING", "TECHNICAL", "ONBOARDING", "GENERAL"]).optional(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().max(30).optional().nullable(),
  internalNotes: z.string().max(2000).optional(),
})), platformController.createSupportTicket);
router.put("/tickets/:id", requirePlatformAuth, requirePlatformPermission("platform.support.manage"), validateBody(z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  internalNotes: z.string().max(2000).optional(),
  assignedAdminId: z.string().uuid().optional().nullable(),
})), platformController.updateSupportTicket);

// System Health & Monitoring
router.get("/system-health", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), platformController.getSystemHealth);

// Platform Settings
router.get("/settings", requirePlatformAuth, requirePlatformPermission("platform.admins.manage"), platformController.getPlatformSettings);
router.put("/settings", requirePlatformAuth, requirePlatformPermission("platform.admins.manage"), validateBody(z.object({
  key: z.string().min(2).max(100),
  value: z.string().min(1).max(1000),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
})), platformController.updatePlatformSetting);

// Centralized Communications
const communicationsRoutes = require("./communications");
router.use("/communications", communicationsRoutes);

// Platform AI Assistant & Telemetry
const platformAiController = require("../controllers/platformAiController");
const { requirePlatformAiAccess } = require("../middleware/aiAuth");

router.get("/ai/status", requirePlatformAuth, platformAiController.getStatus);
router.get("/ai/conversations", requirePlatformAuth, platformAiController.listConversations);
router.post("/ai/conversations", requirePlatformAuth, platformAiController.createConversation);
router.get("/ai/conversations/:id", requirePlatformAuth, platformAiController.getConversation);
router.delete("/ai/conversations/:id", requirePlatformAuth, platformAiController.deleteConversation);
router.post("/ai/conversations/:id/clear", requirePlatformAuth, platformAiController.clearConversation);
router.post("/ai/chat", requirePlatformAuth, requirePlatformAiAccess, platformAiController.sendMessage);
router.get("/ai/telemetry", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), platformAiController.getTelemetry);

module.exports = router;
