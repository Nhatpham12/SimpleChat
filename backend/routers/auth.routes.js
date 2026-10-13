const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { validateLogin, validateRegister, validateChangePassword } = require("../middlewares/validation.middlewares");
const {
  loginIpLimiter,
  loginAccountLimiter,
  registerLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  changePasswordLimiter,
} = require("../middlewares/rateLimit.middleware");

router.post("/register", registerLimiter, validateRegister, authController.register);
router.post("/login", loginIpLimiter, loginAccountLimiter, validateLogin, authController.login);
router.get("/me", verifyToken, authController.getMe);
router.post("/logout", verifyToken, authController.logout);
router.put("/change-password", verifyToken, changePasswordLimiter, validateChangePassword, authController.changePassword);
router.post("/forgot-password", otpSendLimiter, authController.forgotPassword);
router.post("/reset-password", otpVerifyLimiter, authController.resetPassword);
router.post("/verify-email", otpVerifyLimiter, authController.verifyEmail);
router.post("/resend-verification", otpSendLimiter, authController.resendVerification);

module.exports = router;
