const express = require("express");
const platformController = require("../controllers/platformController");
const { requirePlatformAuth, requirePlatformPermission } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { loginSchema, platformRoleUpdateSchema, platformRestaurantCreateSchema, accountActivationSchema } = require("../validators/schemas");
const { z } = require("zod");

const router = express.Router();

router.post("/login", validateBody(loginSchema), platformController.login);
router.post("/logout", platformController.logout);
router.get("/invitations/:token", platformController.getRestaurantInvitation);
router.post("/invitations/:token/activate", validateBody(accountActivationSchema), platformController.activateRestaurantInvitation);
router.get("/me", requirePlatformAuth, platformController.me);
router.get("/overview", requirePlatformAuth, requirePlatformPermission("platform.dashboard.view"), platformController.getOverview);
router.get("/restaurants", requirePlatformAuth, requirePlatformPermission("platform.restaurants.view"), platformController.listRestaurants);
router.post("/restaurants", requirePlatformAuth, requirePlatformPermission("platform.restaurants.manage"), validateBody(platformRestaurantCreateSchema), platformController.createRestaurant);
router.post("/restaurants/:id/invitation", requirePlatformAuth, requirePlatformPermission("platform.restaurants.manage"), validateBody(z.object({ reason: z.string().trim().min(8).max(500) })), platformController.issueOwnerInvitation);
router.get("/admins", requirePlatformAuth, requirePlatformPermission("platform.admins.manage"), platformController.listAdmins);
router.put("/admins/:id/role", requirePlatformAuth, requirePlatformPermission("platform.admins.manage"), validateBody(platformRoleUpdateSchema), platformController.updateAdminRole);
router.get("/audit", requirePlatformAuth, requirePlatformPermission("platform.audit.view"), platformController.listAudit);

module.exports = router;
