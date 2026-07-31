const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { validateLogin, validateRegister, validateChangePassword } = require("../middlewares/validation.middlewares");

router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.get("/me", verifyToken, authController.getMe);
router.post("/logout", verifyToken, authController.logout);
router.put("/change-password", verifyToken, validateChangePassword, authController.changePassword);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", verifyToken, authController.resendVerification);

module.exports = router;
