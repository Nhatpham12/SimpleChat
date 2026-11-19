const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const users = require("../models/users.model");
const emailVerifications = require("../models/emailVerifications.model");
const config = require("../config");
const { issueOtp, checkOtp, OTP_TTL_MINUTES } = require("../common/otp");
const { sendOtpMail, sendEmailChangedMail } = require("../common/mailer");

const getUserById = promisify(users.getById);
const getUserByEmail = promisify(users.getByEmail);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");
// Khóa riêng cho token đổi email → không dùng được như access token / mfa token
const EMAIL_CHANGE_SECRET = `${config.jwt.secret}:email-change`;

// Không bao giờ trả password_hash về client
const publicUser = ({ password_hash, ...user }) => user;

const usersController = {
  // GET /api/users
  getAll: (req, res) => {
    users.getAll((err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi lấy danh sách người dùng" });
      }
      res.json({ status: "ok", data: result });
    });
  },

  // GET /api/users/:id
  getById: (req, res) => {
    const { id } = req.params;
    users.getById(id, (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi lấy thông tin người dùng" });
      }
      if (!result) {
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy người dùng" });
      }
      // Xem người khác: chỉ lộ thông tin công khai (không email/role/trạng thái bảo mật).
      // Xem chính mình (hoặc admin): trả đủ, trừ password_hash.
      const isSelf = parseInt(id) === req.user.user_id || req.user.role === "admin";
      const { user_id, username, avatar_url, status } = result;
      const data = isSelf ? publicUser(result) : { user_id, username, avatar_url, status };
      res.json({ status: "ok", data });
    });
  },

  // GET /api/users/search?q=keyword
  search: (req, res) => {
    const term = (req.query.q || "").trim();
    // Yêu cầu tối thiểu 2 ký tự để hạn chế quét liệt kê người dùng
    if (term.length < 2) {
      return res
        .status(400)
        .json({ status: "error", message: "Từ khóa tìm kiếm phải có ít nhất 2 ký tự" });
    }

    const db = require("../common/connect");
    const userId = req.user.user_id;
    // KHÔNG trả email/role của người khác (chống thu thập PII). Email chỉ dùng để
    // tìm theo ĐÚNG địa chỉ (không substring) nên không thể dùng làm khóa dò hàng loạt.
    // Kèm trạng thái kết bạn với người đang tìm: none | outgoing | incoming | friends
    const sqlString = `SELECT u.user_id, u.username, u.avatar_url, u.status,
        uc.contact_id, uc.status AS contact_status, uc.user_id AS contact_requester_id
      FROM Users u
      LEFT JOIN UserContacts uc
        ON (uc.user_id = ? AND uc.friend_id = u.user_id) OR (uc.friend_id = ? AND uc.user_id = u.user_id)
      WHERE (u.username LIKE ? OR u.email = ?) AND u.user_id <> ?
      LIMIT 20`;
    const keyword = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    const exactEmail = term.toLowerCase();
    db.query(sqlString, [userId, userId, keyword, exactEmail, userId], (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi tìm kiếm người dùng" });
      }
      const data = result.map(({ contact_status, contact_requester_id, ...u }) => {
        let relation = "none";
        if (contact_status === "accepted") relation = "friends";
        else if (contact_status === "pending") relation = contact_requester_id === userId ? "outgoing" : "incoming";
        else if (contact_status) relation = contact_status;
        return { ...u, relation };
      });
      res.json({ status: "ok", data });
    });
  },

  // PUT /api/users/:id — đổi username; đổi email của chính mình phải nhập mật khẩu
  // và xác nhận OTP gửi tới email MỚI (POST /api/users/me/email) mới có hiệu lực.
  updateProfile: async (req, res) => {
    const id = parseInt(req.params.id);
    const isSelf = id === req.user.user_id;
    if (!isSelf && req.user.role !== "admin") {
      return res.status(403).json({ status: "error", message: "Bạn không có quyền cập nhật thông tin người dùng này" });
    }

    const { username, password } = req.body;
    const email = normalizeEmail(req.body.email);
    if (typeof username !== "string" || username.trim().length < 3 || username.trim().length > 50) {
      return res.status(400).json({ status: "error", message: "Username phải từ 3 đến 50 ký tự" });
    }
    if (!EMAIL_RE.test(email) || email.length > 255) {
      return res.status(400).json({ status: "error", message: "Email không hợp lệ" });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ status: "error", message: "Không tìm thấy người dùng" });
    }

    const emailChanged = email !== user.email;
    if (emailChanged && isSelf) {
      // 400 chứ không phải 401: axios coi 401 là hết phiên
      if (typeof password !== "string" || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(400).json({ status: "error", message: "Mật khẩu hiện tại không đúng" });
      }
    }
    if (emailChanged && (await getUserByEmail(email))) {
      return res.status(409).json({ status: "error", message: "Email đã được sử dụng" });
    }

    try {
      await promisify(users.updateUsername)(id, username.trim());
      // Admin sửa hộ người khác: đổi email ngay
      if (emailChanged && !isSelf) await promisify(users.updateEmail)(id, email);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ status: "error", message: "Username hoặc email đã tồn tại" });
      }
      throw err;
    }

    if (!emailChanged || !isSelf) {
      return res.json({ status: "ok", message: "Cập nhật thành công" });
    }

    const { otp, retryAfter } = await issueOtp(emailVerifications, id);
    if (retryAfter) {
      return res.status(429).json({ status: "error", message: "Vui lòng đợi một lát trước khi gửi lại mã", data: { retryAfter } });
    }
    await sendOtpMail(email, otp, "change_email", OTP_TTL_MINUTES);
    // Email mới nằm trong token ký (không lưu DB), chỉ có hiệu lực khi kèm đúng OTP
    const email_token = jwt.sign({ user_id: id, email, purpose: "email_change" }, EMAIL_CHANGE_SECRET, {
      expiresIn: `${OTP_TTL_MINUTES}m`,
    });
    res.json({
      status: "ok",
      code: "EMAIL_CHANGE_PENDING",
      message: "Đã gửi mã xác nhận tới email mới",
      data: { email_token },
    });
  },

  // POST /api/users/me/email — xác nhận OTP để hoàn tất đổi email, báo cho email cũ
  confirmEmailChange: async (req, res) => {
    let payload;
    try {
      payload = jwt.verify(String(req.body.email_token || ""), EMAIL_CHANGE_SECRET, { algorithms: config.jwt.algorithms });
    } catch {
      return res.status(400).json({ status: "error", message: "Yêu cầu đổi email đã hết hạn, vui lòng thử lại" });
    }
    if (payload.purpose !== "email_change" || payload.user_id !== req.user.user_id) {
      return res.status(400).json({ status: "error", message: "Yêu cầu đổi email không hợp lệ" });
    }

    const { error } = await checkOtp(emailVerifications, payload.user_id, req.body.otp);
    if (error) return res.status(400).json({ status: "error", message: error });

    const user = await getUserById(payload.user_id);
    try {
      await promisify(users.updateEmail)(payload.user_id, payload.email);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ status: "error", message: "Email đã được sử dụng" });
      }
      throw err;
    }
    await sendEmailChangedMail(user.email);
    res.json({ status: "ok", message: "Đã đổi email", data: { email: payload.email } });
  },

  // POST /api/users/me/avatar — ảnh đã được multer đẩy lên Cloudinary (crop vuông 400px)
  uploadAvatar: (req, res) => {
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "Chưa chọn ảnh" });
    }
    const avatarUrl = req.file.path;
    users.updateAvatar(req.user.user_id, avatarUrl, (err, success) => {
      if (err || !success) {
        return res.status(500).json({ status: "error", message: "Lỗi khi cập nhật avatar" });
      }
      res.json({ status: "ok", message: "Cập nhật avatar thành công", data: { avatar_url: avatarUrl } });
    });
  },

  // PATCH /api/users/:id/status
  updateStatus: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;

    if (parseInt(id) !== userId && req.user.role !== "admin") {
      return res.status(403).json({ status: "error", message: "Bạn không có quyền cập nhật trạng thái của người dùng này" });
    }

    const { status } = req.body;

    const allowedStatuses = ["online", "offline", "away"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: `Status phải là một trong: ${allowedStatuses.join(", ")}`,
      });
    }

    users.updateStatus(id, status, (err, success) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi cập nhật trạng thái" });
      }
      if (!success) {
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy người dùng" });
      }
      res.json({ status: "ok", message: "Cập nhật trạng thái thành công" });
    });
  },

  // GET /api/users/profile (từ token JWT)
  getProfile: (req, res) => {
    const userId = req.user.user_id;
    users.getById(userId, (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi lấy thông tin hồ sơ" });
      }
      if (!result) {
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy người dùng" });
      }
      res.json({ status: "ok", data: publicUser(result) });
    });
  },
};

module.exports = usersController;
