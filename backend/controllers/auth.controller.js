const bcrypt = require("bcrypt");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { promisify } = require("util");
const users = require("../models/users.model");
const passwordResets = require("../models/passwordResets.model");
const emailVerifications = require("../models/emailVerifications.model");
const mfaRecoveryCodes = require("../models/mfaRecoveryCodes.model");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { issueOtp, checkOtp, OTP_TTL_MINUTES } = require("../common/otp");
const { sendOtpMail, sendLockAlertMail } = require("../common/mailer");
const { validatePassword } = require("../common/passwordPolicy");
const mfa = require("../common/mfa");
const { LOCKED_MESSAGE } = require("../middlewares/auth.middleware");

const SALT_ROUND = 10;

const getUserByEmail = promisify(users.getByEmail);
const getUserByUsername = promisify(users.getByUsername);
const getUserById = promisify(users.getById);
const getMfaState = promisify(users.getMfaState);
const getLockoutSeconds = promisify(users.getLockoutSeconds);
const resetFailures = promisify(users.resetFailures);

// Khóa tạm theo tài khoản (lưu DB, không phụ thuộc IP → chặn cả dò phân tán từ nhiều IP).
// Ngưỡng mật khẩu cao hơn ngưỡng theo IP (5) để kẻ xấu khó cố tình khóa tài khoản người khác.
const LOCK_RULES = {
  login: { max: 10, minutes: 15 },
  mfa: { max: 5, minutes: 15 },
};

// Token tạm cho bước 2 (MFA). Ký bằng khóa riêng + purpose nên KHÔNG dùng được như access token
// (verifyToken và socket chỉ chấp nhận chữ ký bằng config.jwt.secret).
const MFA_SECRET = `${config.jwt.secret}:mfa-challenge`;
const MFA_TOKEN_TTL = "5m";

// Hash giả để vẫn chạy bcrypt khi không tìm thấy user → không lộ username qua thời gian phản hồi
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), SALT_ROUND);

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

const recordFailure = (user_id, kind) =>
  promisify(users.recordFailure)(user_id, kind, LOCK_RULES[kind].max, LOCK_RULES[kind].minutes);

// "45 giây" / "15 phút" / "3 giờ"
const formatWait = (seconds) => {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)} giờ`;
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} phút`;
  return `${seconds} giây`;
};

const lockedOut = (res, seconds, what) =>
  res.status(429).json({
    status: "error",
    code: "LOGIN_LOCKED",
    message: `Bạn đã nhập sai ${what} quá nhiều lần. Vui lòng thử lại sau ${formatWait(seconds)}.`,
    data: { retryAfter: seconds },
  });

const mfaExpired = (res) =>
  res.status(401).json({
    status: "error",
    code: "MFA_EXPIRED",
    message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
  });

// Đọc user từ token bước 2; null nếu token sai / hết hạn / user không còn bật MFA
const userFromMfaToken = async (mfaToken) => {
  let payload;
  try {
    payload = jwt.verify(String(mfaToken || ""), MFA_SECRET);
  } catch {
    return null;
  }
  if (payload.purpose !== "mfa") return null;
  const user = await getUserById(payload.user_id);
  return user?.mfa_enabled ? { user, remember: payload.remember === true } : null;
};

// Kiểm tra mã 2 bước: mã 6 số từ app (chống dùng lại) hoặc mã khôi phục (mỗi mã dùng 1 lần).
// Trả về true nếu hợp lệ; việc "đánh dấu đã dùng" làm nguyên tử ở DB.
const verifyMfaCode = async (user_id, code) => {
  const state = await getMfaState(user_id);
  if (!state?.mfa_secret) return false;

  const step = mfa.checkTotp(state.mfa_secret, state.mfa_last_step, code);
  if (step !== null) return promisify(users.claimMfaStep)(user_id, step);

  const recovery = mfa.normalizeRecoveryCode(code);
  if (!recovery) return false;
  for (const row of await promisify(mfaRecoveryCodes.getUnused)(user_id)) {
    if (await bcrypt.compare(recovery, row.code_hash)) {
      return promisify(mfaRecoveryCodes.markUsed)(row.id);
    }
  }
  return false;
};

// Kiểm tra mã 2 bước có tính khóa tạm theo tài khoản. Trả về response lỗi đã gửi, hoặc null nếu mã đúng.
const checkMfaOrRespond = async (res, user_id, code) => {
  const lockSeconds = await getLockoutSeconds(user_id, "mfa");
  if (lockSeconds > 0) return lockedOut(res, lockSeconds, "mã xác thực");

  if (!(await verifyMfaCode(user_id, code))) {
    await recordFailure(user_id, "mfa");
    return res.status(400).json({ status: "error", message: "Mã xác thực không đúng hoặc đã được dùng" });
  }
  await resetFailures(user_id, "mfa");
  return null;
};

const mfaUnavailable = (res) =>
  res.status(503).json({
    status: "error",
    message: "Server chưa cấu hình đăng nhập 2 bước, vui lòng liên hệ quản trị viên",
  });

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
    message: `Vui lòng đợi ${formatWait(retryAfter)} trước khi gửi lại mã`,
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
      const lockSeconds = await getLockoutSeconds(user.user_id, "login");
      if (lockSeconds > 0) return lockedOut(res, lockSeconds, "mật khẩu");
    }

    // Luôn chạy bcrypt (hash giả khi không có user) để thời gian phản hồi như nhau
    const passwordOk = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
    if (!user || !passwordOk) {
      if (user) {
        const justLocked = await recordFailure(user.user_id, "login");
        // Khóa tài khoản có thể bị lợi dụng để DoS. Báo cho chủ tài khoản khi vừa bị khóa
        // để họ biết và có thể đặt lại mật khẩu (reset gỡ khóa). Lỗi gửi mail không chặn luồng.
        if (justLocked) {
          try {
            await sendLockAlertMail(user.email, LOCK_RULES.login.minutes);
          } catch (err) {
            console.error("Không gửi được email cảnh báo khóa tài khoản:", err.message);
          }
        }
      }
      return res.status(401).json({
        status: "error",
        message: "Username hoặc password không đúng",
      });
    }
    await resetFailures(user.user_id, "login");

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
      return loginResponse(res, user, "Đăng nhập thành công", remember);
    }

    // Bước 2: đúng mật khẩu nhưng chưa cấp token thật cho tới khi nhập đúng mã từ app.
    // (Bộ đếm sai mã MFA riêng, chỉ reset khi nhập đúng mã → đăng nhập lại không xóa được.)
    const mfa_token = jwt.sign({ user_id: user.user_id, purpose: "mfa", remember }, MFA_SECRET, {
      expiresIn: MFA_TOKEN_TTL,
    });
    res.json({
      status: "ok",
      code: "MFA_REQUIRED",
      message: "Nhập mã 6 số từ ứng dụng xác thực",
      data: { mfa_token },
    });
  },

  // POST /api/auth/mfa/verify — bước 2 khi đăng nhập: mã từ app hoặc mã khôi phục
  verifyLoginMfa: async (req, res) => {
    const session = await userFromMfaToken(req.body.mfa_token);
    if (!session) return mfaExpired(res);
    if (await checkMfaOrRespond(res, session.user.user_id, req.body.code)) return;
    await loginResponse(res, session.user, "Đăng nhập thành công", session.remember);
  },

  // POST /api/auth/mfa/setup — tạo secret mới (chưa bật MFA), trả QR để quét bằng app
  mfaSetup: async (req, res) => {
    if (!mfa.isAvailable) return mfaUnavailable(res);
    const user = await getUserById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy user" });
    }

    const secret = mfa.authenticator.generateSecret();
    if (!(await promisify(users.setMfaSecret)(user.user_id, mfa.encrypt(secret)))) {
      return res.status(400).json({ status: "error", message: "Đăng nhập 2 bước đang bật" });
    }

    const otpauth = mfa.authenticator.keyuri(user.email, "SimpleChat", secret);
    res.json({
      status: "ok",
      // secret dạng chữ để nhập tay khi không quét được QR
      data: { qr: await QRCode.toDataURL(otpauth), secret },
    });
  },

  // POST /api/auth/mfa/enable — xác nhận mã đầu tiên từ app → bật MFA + cấp mã khôi phục (chỉ trả 1 lần)
  mfaEnable: async (req, res) => {
    if (!mfa.isAvailable) return mfaUnavailable(res);
    const user_id = req.user.user_id;
    const state = await getMfaState(user_id);
    if (!state?.mfa_secret || state.mfa_enabled) {
      return res.status(400).json({ status: "error", message: "Vui lòng bắt đầu cài đặt lại" });
    }

    const step = mfa.checkTotp(state.mfa_secret, null, req.body.code);
    if (step === null) {
      return res.status(400).json({
        status: "error",
        message: "Mã không đúng. Kiểm tra giờ trên điện thoại rồi nhập mã mới nhất",
      });
    }

    const codes = mfa.generateRecoveryCodes();
    const hashes = await Promise.all(codes.map((code) => bcrypt.hash(code, SALT_ROUND)));
    await promisify(mfaRecoveryCodes.replaceForUser)(user_id, hashes);
    if (!(await promisify(users.enableMfa)(user_id, step))) {
      return res.status(400).json({ status: "error", message: "Đăng nhập 2 bước đang bật" });
    }

    const user = await getUserById(user_id);
    res.json({
      status: "ok",
      message: "Đã bật đăng nhập 2 bước",
      data: { user: publicUser(user), recoveryCodes: codes.map(mfa.formatRecoveryCode) },
    });
  },

  // POST /api/auth/mfa/disable — tắt MFA, phải có cả mật khẩu lẫn mã xác thực
  mfaDisable: async (req, res) => {
    const { password, code } = req.body;
    if (typeof password !== "string" || !password || !code) {
      return res.status(400).json({ status: "error", message: "Vui lòng nhập mật khẩu và mã xác thực" });
    }

    const user = await getUserById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy user" });
    }
    if (!user.mfa_enabled) {
      return res.status(400).json({ status: "error", message: "Đăng nhập 2 bước đang tắt" });
    }
    // 400 chứ không phải 401: axios coi 401 là hết phiên và đẩy người dùng ra trang đăng nhập
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(400).json({ status: "error", message: "Mật khẩu hiện tại không đúng" });
    }
    if (await checkMfaOrRespond(res, user.user_id, code)) return;

    await promisify(users.disableMfa)(user.user_id);
    await promisify(mfaRecoveryCodes.replaceForUser)(user.user_id, []);
    res.json({
      status: "ok",
      message: "Đã tắt đăng nhập 2 bước",
      data: { user: publicUser({ ...user, mfa_enabled: false }) },
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

    const pwError = validatePassword(newPassword);
    if (pwError) {
      return res.status(400).json({ status: "error", message: pwError });
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
    const pwError = validatePassword(newPassword);
    if (pwError) {
      return res.status(400).json({ status: "error", message: pwError });
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
