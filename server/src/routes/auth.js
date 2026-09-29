const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { loginSchema } = require("../validators/schemas");

const router = express.Router();

router.post("/login", validateBody(loginSchema), authController.login);
router.get("/me", requireAuth, authController.me);

module.exports = router;
