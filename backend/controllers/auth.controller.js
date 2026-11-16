const bcrypt = require("bcrypt");
const { promisify } = require("util");
const users = require("../models/users.model");
const passwordResets = require("../models/passwordResets.model");
const emailVerifications = require("../models/emailVerifications.model");
const loginOtps = require("../models/loginOtps.model");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { issueOtp, checkOtp, OTP_TTL_MINUTES } = require("../common/otp");
const { sendOtpMail } = require("../common/mailer");
const { LOCKED_MESSAGE } = require("../middlewares/auth.middleware");

const SALT_ROUND = 10;

const getUserByEmail = promisify(users.getByEmail);
const getUserByUsername = promisify(users.getByUsername);
const getUserById = promisify(users.getById);
const getLockoutSeconds = promisify(users.getLockoutSeconds);

// Chống dò mật khẩu (lưu trong DB, bền qua restart và không phụ thuộc IP):
// sai MAX_FAILED_LOGINS lần liên tiếp → khóa tạm LOCKOUT_MINUTES phút.
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MINUTES = 15;

// Token tạm cho bước 2 (MFA). Ký bằng khóa riêng nên KHÔNG dùng được như access token.
const MFA_SECRET = `${config.jwt.secret}:mfa-challenge`;
const MFA_TOKEN_TTL = "10m";

const generateToken = (user, remember = false) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
    },
    config.jwt.secret,
    {
      expiresIn: remember ? config.jwt.rememberExpiresIn : config.jwt.expiresIn,
    },
  );
};

// Bỏ password_hash trước khi trả user về client
const publicUser = ({ password_hash, ...user }) => ({
  ...user,
  is_verified: Boolean(user.is_verified),
  is_locked: Boolean(user.is_locked),
  mfa_enabled: Boolean(user.mfa_enabled),
});

// "lan.nguyen@gmail.com" → "la***@gmail.com" (cho người đang đăng nhập biết mã gửi đi đâu)
const maskEmail = (email) => {
  const [name, domain] = String(email).split("@");
  return `${name.slice(0, 2)}***@${domain}`;
};

const recordFailedLogin = (user_id) =>
  promisify(users.recordFailedLogin)(user_id, MAX_FAILED_LOGINS, LOCKOUT_MINUTES);

const lockedOut = (res, seconds) =>
  res.status(429).json({
    status: "error",
    code: "LOGIN_LOCKED",
    message: `Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${Math.ceil(seconds / 60)} phút hoặc dùng "Quên mật khẩu".`,
    data: { retryAfter: seconds },
  });

const mfaExpired = (res) =>
  res.status(401).json({
    status: "error",
    code: "MFA_EXPIRED",
    message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
  });

// Đọc user từ token bước 2; null nếu token sai / hết hạn / user không còn
const userFromMfaToken = async (mfaToken) => {
  let payload;
  try {
    payload = jwt.verify(String(mfaToken || ""), MFA_SECRET);
  } catch {
    return null;
  }
  const user = await getUserById(payload.user_id);
  return user ? { user, remember: payload.remember === true } : null;
};

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

// Tạo OTP và gửi mail. Trả về số giây phải chờ nếu đang trong thời gian cooldown.
const sendOtp = async (model, user, purpose) => {
  const { otp, retryAfter } = await issueOtp(model, user.user_id);
  if (retryAfter) return retryAfter;
  try {
    await sendOtpMail(user.email, otp, purpose, OTP_TTL_MINUTES);
  } catch (err) {
    // Huỷ mã chưa gửi được để user thử lại ngay, không bị dính cooldown
    await promisify(model.invalidateByUserId)(user.user_id);
    throw err;
  }
  return 0;
};

const tooSoon = (res, retryAfter) =>
  res.status(429).json({
    status: "error",
    message: `Vui lòng đợi ${retryAfter} giây trước khi gửi lại mã`,
    data: { retryAfter },
  });

const loginResponse = async (res, user, message, remember = false) => {
  // Chặn cả đường đăng nhập qua xác nhận email
  if (user.is_locked) {
    return res.status(403).json({
      status: "error",
      code: "ACCOUNT_LOCKED",
      message: LOCKED_MESSAGE,
    });
  }
  await promisify(users.updateStatus)(user.user_id, "online");
  res.json({
    status: "ok",
    message,
    data: {
      user: publicUser({ ...user, status: "online" }),
      token: generateToken(user, remember),
    },
  });
};

const authController = {
  // POST /api/auth/register — tạo tài khoản chưa xác nhận + gửi OTP qua email
  register: async (req, res) => {
    const { username, password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (await getUserByUsername(username)) {
      return res
        .status(409)
        .json({ status: "error", message: "Username đã tồn tại" });
    }
    if (await getUserByEmail(email)) {
      return res
        .status(409)
        .json({ status: "error", message: "Email đã tồn tại" });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUND);
    const user_id = await promisify(users.insert)({
      username,
      email,
      password_hash,
    });

    try {
      await sendOtp(emailVerifications, { user_id, email }, "verify");
    } catch {
      // Tài khoản đã tạo — user có thể bấm "Gửi lại mã" ở trang xác nhận (mailer đã log lỗi)
    }

    res.status(201).json({
      status: "ok",
      message: "Đăng ký thành công. Vui lòng nhập mã xác nhận đã gửi tới email",
      data: { email },
    });
  },

  // POST /api/auth/login — đăng nhập bằng username hoặc email
  login: async (req, res) => {
    const { username, password } = req.body;
    const identifier = username.trim();
    const user = identifier.includes("@")
      ? await getUserByEmail(normalizeEmail(identifier))
      : await getUserByUsername(identifier);

    // Đang bị khóa tạm thì không kiểm tra mật khẩu (kẻ dò không biết đoán đúng hay sai)
    if (user) {
      const lockSeconds = await getLockoutSeconds(user.user_id);
      if (lockSeconds > 0) return lockedOut(res, lockSeconds);
    }

    const isMatch =
      user && (await bcrypt.compare(password, user.password_hash));
    if (!isMatch) {
      if (user) await recordFailedLogin(user.user_id);
      return res.status(401).json({
        status: "error",
        message: "Username hoặc password không đúng",
      });
    }

    if (user.is_locked) {
      return res.status(403).json({
        status: "error",
        code: "ACCOUNT_LOCKED",
        message: LOCKED_MESSAGE,
      });
    }

    if (!user.is_verified) {
      try {
        await sendOtp(emailVerifications, user, "verify");
      } catch {
        // User vẫn được chuyển sang trang xác nhận để bấm "Gửi lại mã" (mailer đã log lỗi)
      }
      return res.status(403).json({
        status: "error",
        code: "EMAIL_NOT_VERIFIED",
        message: "Email chưa được xác nhận. Vui lòng nhập mã đã gửi tới email",
        data: { email: user.email },
      });
    }

    const remember = req.body.remember === true;
    if (!user.mfa_enabled) {
      await promisify(users.resetFailedLogins)(user.user_id);
      return loginResponse(res, user, "Đăng nhập thành công", remember);
    }
    // Có MFA: chỉ reset bộ đếm sau khi nhập đúng mã, để kẻ đã biết mật khẩu
    // không thể đăng nhập lại liên tục nhằm xóa số lần dò mã sai.

    // Bước 2: gửi mã qua email. Mã cũ còn hạn (đang cooldown) thì dùng tiếp mã đó.
    await sendOtp(loginOtps, user, "login");
    const mfaToken = jwt.sign({ user_id: user.user_id, remember }, MFA_SECRET, {
      expiresIn: MFA_TOKEN_TTL,
    });
    res.json({
      status: "ok",
      code: "MFA_REQUIRED",
      message: "Nhập mã đăng nhập vừa gửi tới email",
      data: { mfaToken, email: maskEmail(user.email) },
    });
  },

  // POST /api/auth/login/mfa — bước 2: xác nhận mã đăng nhập gửi qua email
  verifyLoginMfa: async (req, res) => {
    const session = await userFromMfaToken(req.body.mfaToken);
    if (!session) return mfaExpired(res);
    const { user, remember } = session;

    const lockSeconds = await getLockoutSeconds(user.user_id);
    if (lockSeconds > 0) return lockedOut(res, lockSeconds);

    const { error } = await checkOtp(loginOtps, user.user_id, req.body.otp);
    if (error) {
      // Nhập sai mã cũng tính vào ngưỡng khóa tạm (chặn dò mã khi đã lộ mật khẩu)
      await recordFailedLogin(user.user_id);
      return res.status(400).json({ status: "error", message: error });
    }

    await promisify(users.resetFailedLogins)(user.user_id);
    await loginResponse(res, user, "Đăng nhập thành công", remember);
  },

  // POST /api/auth/login/mfa/resend — gửi lại mã đăng nhập
  resendLoginMfa: async (req, res) => {
    const session = await userFromMfaToken(req.body.mfaToken);
    if (!session) return mfaExpired(res);

    const lockSeconds = await getLockoutSeconds(session.user.user_id);
    if (lockSeconds > 0) return lockedOut(res, lockSeconds);

    const retryAfter = await sendOtp(loginOtps, session.user, "login");
    if (retryAfter) return tooSoon(res, retryAfter);
    res.json({ status: "ok", message: "Đã gửi mã đăng nhập mới" });
  },

  // PUT /api/auth/mfa — bật/tắt đăng nhập 2 bước, phải nhập lại mật khẩu
  setMfa: async (req, res) => {
    const { enabled, password } = req.body;
    if (typeof enabled !== "boolean" || typeof password !== "string" || !password) {
      return res.status(400).json({
        status: "error",
        message: "Vui lòng nhập mật khẩu hiện tại",
      });
    }

    const user = await getUserById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy user" });
    }
    // 400 chứ không phải 401: axios coi 401 là hết phiên và đẩy người dùng ra trang đăng nhập
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(400).json({ status: "error", message: "Mật khẩu hiện tại không đúng" });
    }

    await promisify(users.setMfaEnabled)(user.user_id, enabled);
    res.json({
      status: "ok",
      message: enabled ? "Đã bật đăng nhập 2 bước" : "Đã tắt đăng nhập 2 bước",
      data: { user: publicUser({ ...user, mfa_enabled: enabled }) },
    });
  },

  // GET api/auth/me
  getMe: (req, res) => {
    users.getById(req.user.user_id, (err, user) => {
      if (err)
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi lấy thông tin user" });
      if (!user)
        return res
          .status(401)
          .json({ status: "error", message: "Không tìm thấy user" });
      res.json({
        status: "ok",
        data: { user: publicUser(user) },
      });
    });
  },

  // api/auth/logout --> Đăng xuất
  logout: (req, res) => {
    users.updateStatus(req.user.user_id, "offline", (err) => {
      if (err)
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi cập nhật trạng thái" });

      res.json({
        status: "ok",
        message: "Đăng xuất thành công",
      });
    });
  },

  changePassword: (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Vui lòng nhập đầy đủ mật khẩu cũ và mới",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Mật khẩu mới phải có ít nhất 8 ký tự",
      });
    }

    users.getById(req.user.user_id, (err, user) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi lấy thông tin user" });
      }

      if (!user) {
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy user" });
      }

      bcrypt.compare(oldPassword, user.password_hash, (err, isMatch) => {
        if (err) {
          return res
            .status(500)
            .json({ status: "error", message: "Lỗi khi xác thực password" });
        }

        if (!isMatch) {
          return res
            .status(401)
            .json({ status: "error", message: "Mật khẩu cũ không đúng" });
        }

        bcrypt.hash(newPassword, SALT_ROUND, (err, password_hash) => {
          if (err) {
            return res
              .status(500)
              .json({ status: "error", message: "Lỗi khi mã hóa password" });
          }

          users.update(
            user.user_id,
            {
              username: user.username,
              email: user.email,
              password_hash,
              avatar_url: user.avatar_url,
            },
            (err, success) => {
              if (err) {
                return res.status(500).json({
                  status: "error",
                  message: "Lỗi khi cập nhật password",
                });
              }

              if (!success) {
                return res.status(500).json({
                  status: "error",
                  message: "Cập nhật mật khẩu thất bại",
                });
              }

              res.json({
                status: "ok",
                message: "Đổi mật khẩu thành công",
              });
            },
          );
        });
      });
    });
  },

  // POST /api/auth/verify-email — xác nhận email bằng OTP, thành công thì đăng nhập luôn
  verifyEmail: async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json({ status: "error", message: "Email và mã xác nhận là bắt buộc" });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(400)
        .json({ status: "error", message: "Mã xác nhận không hợp lệ" });
    }
    if (user.is_verified) {
      return res.status(400).json({
        status: "error",
        message: "Email đã được xác nhận, vui lòng đăng nhập",
      });
    }

    const { error } = await checkOtp(emailVerifications, user.user_id, otp);
    if (error) return res.status(400).json({ status: "error", message: error });

    await promisify(users.setVerified)(user.user_id);
    await loginResponse(
      res,
      { ...user, is_verified: 1 },
      "Xác nhận email thành công",
      true,
    );
  },

  // POST /api/auth/resend-verification — gửi lại OTP xác nhận email
  resendVerification: async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Email là bắt buộc" });
    }

    const user = await getUserByEmail(email);
    if (user && !user.is_verified) {
      const retryAfter = await sendOtp(emailVerifications, user, "verify");
      if (retryAfter) return tooSoon(res, retryAfter);
    }

    res.json({
      status: "ok",
      message: "Nếu email chưa được xác nhận, mã mới đã được gửi",
    });
  },

  // POST /api/auth/forgot-password — gửi OTP đặt lại mật khẩu
  forgotPassword: async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Email là bắt buộc" });
    }

    const user = await getUserByEmail(email);
    if (user) {
      const retryAfter = await sendOtp(passwordResets, user, "reset");
      if (retryAfter) return tooSoon(res, retryAfter);
    }

    // Không tiết lộ email có tồn tại hay không
    res.json({
      status: "ok",
      message: "Nếu email tồn tại, mã xác nhận đã được gửi tới email",
    });
  },

  // POST /api/auth/reset-password — đặt lại mật khẩu bằng OTP
  resetPassword: async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Email, mã xác nhận và mật khẩu mới là bắt buộc",
      });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Mật khẩu mới phải có ít nhất 8 ký tự",
      });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(400)
        .json({ status: "error", message: "Mã xác nhận không hợp lệ" });
    }

    const { error } = await checkOtp(passwordResets, user.user_id, otp);
    if (error) return res.status(400).json({ status: "error", message: error });

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUND);
    await promisify(users.updatePassword)(user.user_id, password_hash);
    // Nhận được OTP qua email cũng chứng minh sở hữu email
    if (!user.is_verified) await promisify(users.setVerified)(user.user_id);

    res.json({
      status: "ok",
      message: "Đặt lại mật khẩu thành công, vui lòng đăng nhập",
    });
  },
};

module.exports = authController;
