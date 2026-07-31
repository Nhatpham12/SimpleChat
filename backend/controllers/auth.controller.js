const bcrypt = require("bcrypt");
const crypto = require("crypto");
const users = require("../models/users.model");
const passwordResets = require("../models/passwordResets.model");
const emailVerifications = require("../models/emailVerifications.model");
const jwt = require("jsonwebtoken");

const SALT_ROUND = 10;

const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "24h",
    },
  );
};

const authController = {
  // post api/auth/register
  register: (req, res) => {
    const { username, email, password } = req.body;

    users.getByUsername(username, (err, existingUser) => {
      if (err)
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi kiểm tra user" });

      if (existingUser) {
        return res
          .status(409)
          .json({ status: "error", message: "Username đã tồn tại" });
      }

      users.getByEmail(email, (err, existingEmail) => {
        if (err)
          return res
            .status(500)
            .json({ status: "error", message: "Lỗi khi kiểm tra email" });

        if (existingEmail) {
          return res
            .status(409)
            .json({ status: "error", message: "Email đã tồn tại" });
        }

        bcrypt.hash(password, SALT_ROUND, (err, password_hash) => {
          if (err)
            return res
              .status(500)
              .json({ status: "error", message: "Lỗi khi mã hóa password" });

          users.insert({ username, email, password_hash }, (err, user_id) => {
            if (err)
              return res
                .status(500)
                .json({ status: "error", message: "Lỗi khi tạo tài khoản" });

            users.getById(user_id, (err, user) => {
              if (err)
                return res.status(500).json({
                  status: "error",
                  message: "Lỗi khi lấy thông tin user",
                });

              const token = generateToken(user);
              res.status(201).json({
                status: "ok",
                message: "Đăng ký thành công",
                data: { user, token },
              });
            });
          });
        });
      });
    });
  },

  //Post api/auth/login --> Đăng nhập
  login: (req, res) => {
    const { username, password } = req.body;

    users.getByUsername(username, (err, user) => {
      if (err)
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi tìm kiếm user" });

      if (!user)
        return res.status(401).json({
          status: "error",
          message: "Username hoặc password không đúng",
        });
      bcrypt.compare(password, user.password_hash, (err, isMatch) => {
        if (err)
          return res
            .status(500)
            .json({ status: "error", message: "Lỗi xác thực password" });

        if (!isMatch) {
          return res.status(401).json({
            status: "error",
            message: "Username hoặc password không đúng",
          });
        }

        users.updateStatus(user.user_id, "online", (err) => {
          if (err)
            return res.status(500).json({
              status: "error",
              message: "Lỗi khi cập nhật trạng thái",
            });
          const token = generateToken(user);
          res.json({
            status: "ok",
            message: "Đăng nhập thành công",
            data: {
              user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url,
                status: "online",
              },
              token,
            },
          });
        });
      });
    });
  },

  // GET api/auth/getMe -->
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
        data: { user },
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

  // POST /api/auth/forgot-password — Gửi email đặt lại mật khẩu
  forgotPassword: (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: "error", message: "Email là bắt buộc" });
    }

    users.getByEmail(email, (err, user) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm kiếm email" });
      }
      if (!user) {
        // Tránh leak thông tin: luôn trả ok
        return res.json({ status: "ok", message: "Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

      passwordResets.insert({ user_id: user.user_id, token, expires_at }, (err) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi tạo token đặt lại mật khẩu" });
        }

        // TODO: Gửi email với nodemailer khi có SMTP config
        // nodemailer.sendMail({ to: email, subject: "Đặt lại mật khẩu", text: `Link: ${FRONTEND_URL}/reset-password?token=${token}` });

        res.json({ status: "ok", message: "Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu", data: { token } });
      });
    });
  },

  // POST /api/auth/reset-password — Đặt lại mật khẩu bằng token
  resetPassword: (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ status: "error", message: "Token và mật khẩu mới là bắt buộc" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ status: "error", message: "Mật khẩu mới phải có ít nhất 8 ký tự" });
    }

    passwordResets.getByToken(token, (err, resetRecord) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm kiếm token" });
      }
      if (!resetRecord) {
        return res.status(400).json({ status: "error", message: "Token không hợp lệ hoặc đã hết hạn" });
      }

      if (new Date(resetRecord.expires_at) < new Date()) {
        return res.status(400).json({ status: "error", message: "Token đã hết hạn" });
      }

      bcrypt.hash(newPassword, SALT_ROUND, (err, password_hash) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi mã hóa mật khẩu" });
        }

        users.getById(resetRecord.user_id, (err, user) => {
          if (err || !user) {
            return res.status(500).json({ status: "error", message: "Lỗi khi tìm kiếm user" });
          }

          users.update(user.user_id, { username: user.username, email: user.email, password_hash, avatar_url: user.avatar_url }, (err) => {
            if (err) {
              return res.status(500).json({ status: "error", message: "Lỗi khi cập nhật mật khẩu" });
            }

            passwordResets.markAsUsed(resetRecord.id, () => {
              res.json({ status: "ok", message: "Đặt lại mật khẩu thành công" });
            });
          });
        });
      });
    });
  },

  // POST /api/auth/verify-email — Xác minh email
  verifyEmail: (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ status: "error", message: "Token là bắt buộc" });
    }

    emailVerifications.getByToken(token, (err, record) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm kiếm token" });
      }
      if (!record) {
        return res.status(400).json({ status: "error", message: "Token không hợp lệ hoặc đã hết hạn" });
      }

      if (new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ status: "error", message: "Token đã hết hạn" });
      }

      emailVerifications.markAsUsed(record.id, (err) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi xác minh email" });
        }
        res.json({ status: "ok", message: "Xác minh email thành công" });
      });
    });
  },

  // POST /api/auth/resend-verification — Gửi lại email xác minh
  resendVerification: (req, res) => {
    const userId = req.user.user_id;

    users.getById(userId, (err, user) => {
      if (err || !user) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm kiếm user" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ

      emailVerifications.insert({ user_id: userId, token, expires_at }, (err) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi tạo token xác minh" });
        }

        // TODO: Gửi email với nodemailer
        res.json({ status: "ok", message: "Đã gửi email xác minh", data: { token } });
      });
    });
  },
};
