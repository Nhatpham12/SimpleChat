const users = require("../models/users.model");

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
      res.json({ status: "ok", data: result });
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
    const sqlString = `SELECT user_id, username, email, role, avatar_url, status, created_at, updated_at 
      FROM Users 
      WHERE username LIKE ? OR email LIKE ?`;
    const keyword = `%${q}%`;
    db.query(sqlString, [keyword, keyword], (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi tìm kiếm người dùng" });
      }
      res.json({ status: "ok", data: result });
    });
  },

  // PUT /api/users/:id
  updateProfile: (req, res) => {
    const { id } = req.params;
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

  // PATCH /api/users/:id/status
  updateStatus: (req, res) => {
    const { id } = req.params;
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

  // PATCH /api/users/:id/role
  updateRole: (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ["admin", "user"];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        status: "error",
        message: `Role phải là một trong: ${allowedRoles.join(", ")}`,
      });
    }

    users.updateRole(id, role, (err, success) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi cập nhật vai trò" });
      }
      if (!success) {
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy người dùng" });
      }
      res.json({ status: "ok", message: "Cập nhật vai trò thành công" });
    });
  },

  // DELETE /api/users/:id
  delete: (req, res) => {
    const { id } = req.params;

    users.delete(id, (err, success) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi khi xóa người dùng" });
      }
      if (!success) {
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy người dùng" });
      }
      res.json({ status: "ok", message: "Xóa người dùng thành công" });
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
      res.json({ status: "ok", data: result });
    });
  },
};

module.exports = usersController;
