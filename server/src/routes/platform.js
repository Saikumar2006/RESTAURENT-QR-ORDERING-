const express = require("express");
const platformController = require("../controllers/platformController");
const { requirePlatformAuth } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { loginSchema } = require("../validators/schemas");

const router = express.Router();

router.post("/login", validateBody(loginSchema), platformController.login);
router.get("/me", requirePlatformAuth, platformController.me);
router.get("/overview", requirePlatformAuth, platformController.getOverview);
router.get("/restaurants", requirePlatformAuth, platformController.listRestaurants);

module.exports = router;
