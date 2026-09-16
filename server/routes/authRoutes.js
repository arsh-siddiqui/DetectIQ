const express = require("express");
const { register, login, logout, getMe, googleOAuth, googleOAuthCallback } = require("../controllers/authController");
const { registerValidator, loginValidator } = require("../validators/authValidators");
const validate = require("../middleware/validate");
const requireDb = require("../middleware/requireDb");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/register", requireDb, registerValidator, validate, register);
router.post("/login", requireDb, loginValidator, validate, login);
router.post("/logout", logout);
router.get("/me", requireDb, protect, getMe);
router.get("/google", requireDb, googleOAuth);
router.get("/google/callback", requireDb, googleOAuthCallback);

module.exports = router;
