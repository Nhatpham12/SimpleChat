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
// Đăng nhập 2 bước (TOTP). /verify là bước 2 khi đăng nhập nên không cần access token.
router.post("/mfa/verify", otpVerifyLimiter, authController.verifyLoginMfa);
router.post("/mfa/setup", verifyToken, authController.mfaSetup);
router.post("/mfa/enable", verifyToken, changePasswordLimiter, authController.mfaEnable);
router.post("/mfa/disable", verifyToken, changePasswordLimiter, authController.mfaDisable);
router.get("/me", verifyToken, authController.getMe);
router.post("/logout", verifyToken, authController.logout);
router.put("/change-password", verifyToken, changePasswordLimiter, validateChangePassword, authController.changePassword);
router.post("/forgot-password", otpSendLimiter, authController.forgotPassword);
router.post("/reset-password", otpVerifyLimiter, authController.resetPassword);
router.post("/verify-email", otpVerifyLimiter, authController.verifyEmail);
router.post("/resend-verification", otpSendLimiter, authController.resendVerification);

module.exports = router;
