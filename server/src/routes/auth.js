const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { loginSchema } = require("../validators/schemas");
const { preferredLanguageSchema } = require("../validators/schemas");
const { validateBody: validate } = require("../middleware/validate");
const staffAccessController = require("../controllers/staffAccessController");
const { staffPasswordSetSchema } = require("../validators/schemas");

const router = express.Router();

router.post("/login", validateBody(loginSchema), authController.login);
router.get("/staff-access/:token", staffAccessController.getLink);
router.post("/staff-access/:token/password", validateBody(staffPasswordSetSchema), staffAccessController.setPassword);
router.get("/google", authController.googleStart);
router.get("/google/callback", authController.googleCallback);
router.get("/me", requireAuth, authController.me);
router.put("/preferred-language", requireAuth, validate(preferredLanguageSchema), authController.updatePreferredLanguage);

module.exports = router;
