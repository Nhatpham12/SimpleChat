const users = require("../models/users.model");

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
      res.json({ status: "ok", data: publicUser(result) });
    });
  },

  // GET /api/users/search?q=keyword
  search: (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Từ khóa tìm kiếm là bắt buộc" });
    }

    const db = require("../common/connect");
    const userId = req.user.user_id;
    // Kèm trạng thái kết bạn với người đang tìm: none | outgoing | incoming | friends
    const sqlString = `SELECT u.user_id, u.username, u.email, u.role, u.avatar_url, u.status, u.created_at, u.updated_at,
        uc.contact_id, uc.status AS contact_status, uc.user_id AS contact_requester_id
      FROM Users u
      LEFT JOIN UserContacts uc
        ON (uc.user_id = ? AND uc.friend_id = u.user_id) OR (uc.friend_id = ? AND uc.user_id = u.user_id)
      WHERE (u.username LIKE ? OR u.email LIKE ?) AND u.user_id <> ?
      LIMIT 20`;
    const keyword = `%${q.trim().replace(/[\\%_]/g, "\\$&")}%`;
    db.query(sqlString, [userId, userId, keyword, keyword, userId], (err, result) => {
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

  // PUT /api/users/:id
  updateProfile: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;

    if (parseInt(id) !== userId && req.user.role !== "admin") {
      return res.status(403).json({ status: "error", message: "Bạn không có quyền cập nhật thông tin người dùng này" });
    }

    const { username, email } = req.body;

    if (!username || !email) {
      return res
        .status(400)
        .json({ status: "error", message: "Username và email là bắt buộc" });
    }

    users.getById(id, (err, existingUser) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi kiểm tra người dùng" });
      }
      if (!existingUser) {
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy người dùng" });
      }

      const updateData = {
        username,
        email,
        password_hash: existingUser.password_hash,
        avatar_url: existingUser.avatar_url,
      };

      users.update(id, updateData, (err, success) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res
              .status(409)
              .json({ status: "error", message: "Username hoặc email đã tồn tại" });
          }
          return res
            .status(500)
            .json({ status: "error", message: "Lỗi khi cập nhật thông tin" });
        }
        if (!success) {
          return res
            .status(404)
            .json({ status: "error", message: "Không tìm thấy người dùng" });
        }
        res.json({ status: "ok", message: "Cập nhật thành công" });
      });
    });
  },

  // PATCH /api/users/:id/avatar
  updateAvatar: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;

    if (parseInt(id) !== userId && req.user.role !== "admin") {
      return res.status(403).json({ status: "error", message: "Bạn không có quyền cập nhật avatar của người dùng này" });
    }

    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res
        .status(400)
        .json({ status: "error", message: "avatar_url là bắt buộc" });
    }

    users.updateAvatar(id, avatar_url, (err, success) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi cập nhật avatar" });
      }
      if (!success) {
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy người dùng" });
      }
      res.json({ status: "ok", message: "Cập nhật avatar thành công" });
    });
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
