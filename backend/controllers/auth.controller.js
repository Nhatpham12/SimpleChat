const bcrypt = require("bcrypt");
const { promisify } = require("util");
const users = require("../models/users.model");
const passwordResets = require("../models/passwordResets.model");
const emailVerifications = require("../models/emailVerifications.model");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { issueOtp, checkOtp, OTP_TTL_MINUTES } = require("../common/otp");
const { sendOtpMail } = require("../common/mailer");

const SALT_ROUND = 10;

const getUserByEmail = promisify(users.getByEmail);
const getUserByUsername = promisify(users.getByUsername);

const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
    },
  );
};

// Bỏ password_hash trước khi trả user về client
const publicUser = ({ password_hash, ...user }) => ({
  ...user,
  is_verified: Boolean(user.is_verified),
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
    message: `Vui lòng đợi ${retryAfter} giây trước khi gửi lại mã`,
    data: { retryAfter },
  });

const loginResponse = async (res, user, message) => {
  await promisify(users.updateStatus)(user.user_id, "online");
  res.json({
    status: "ok",
    message,
    data: {
      user: publicUser({ ...user, status: "online" }),
      token: generateToken(user),
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

    const isMatch = user && (await bcrypt.compare(password, user.password_hash));
    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        message: "Username hoặc password không đúng",
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

    await loginResponse(res, user, "Đăng nhập thành công");
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
      return res
        .status(400)
        .json({ status: "error", message: "Email đã được xác nhận, vui lòng đăng nhập" });
    }

    const { error } = await checkOtp(emailVerifications, user.user_id, otp);
    if (error) return res.status(400).json({ status: "error", message: error });

    await promisify(users.setVerified)(user.user_id);
    await loginResponse(res, { ...user, is_verified: 1 }, "Xác nhận email thành công");
  },

  // POST /api/auth/resend-verification — gửi lại OTP xác nhận email
  resendVerification: async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ status: "error", message: "Email là bắt buộc" });
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
      return res.status(400).json({ status: "error", message: "Email là bắt buộc" });
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
      return res
        .status(400)
        .json({ status: "error", message: "Mật khẩu mới phải có ít nhất 8 ký tự" });
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
