const blockedUsers = require("../models/blockedUsers.model");
const users = require("../models/users.model");

const blockedUsersController = {
  // GET /api/blocked — lấy danh sách người đã chặn
  getByUserId: (req, res) => {
    const userId = req.user.user_id;
    blockedUsers.getByUserId(userId, (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy danh sách chặn" });
      }
      res.json({ status: "ok", data: result });
    });
  },

  // GET /api/blocked/check/:blockedUserId — kiểm tra đã chặn chưa
  checkBlocked: (req, res) => {
    const userId = req.user.user_id;
    const { blockedUserId } = req.params;
    blockedUsers.isBlocked(userId, blockedUserId, (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra chặn" });
      }
      res.json({ status: "ok", data: { is_blocked: !!result } });
    });
  },

  // POST /api/blocked — chặn người dùng
  block: (req, res) => {
    const userId = req.user.user_id;
    const { blocked_user_id } = req.body;

    if (!blocked_user_id) {
      return res.status(400).json({ status: "error", message: "blocked_user_id là bắt buộc" });
    }

    if (parseInt(blocked_user_id) === userId) {
      return res.status(400).json({ status: "error", message: "Không thể chặn chính mình" });
    }

    users.getById(blocked_user_id, (err, user) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm kiếm người dùng" });
      }
      if (!user) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy người dùng" });
      }

      blockedUsers.isBlocked(userId, blocked_user_id, (err, existing) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra chặn" });
        }
        if (existing) {
          return res.status(409).json({ status: "error", message: "Đã chặn người dùng này rồi" });
        }

        blockedUsers.insert({ user_id: userId, blocked_user_id }, (err, blockId) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi chặn người dùng" });
          }
          res.status(201).json({ status: "ok", message: "Đã chặn người dùng", data: { block_id: blockId } });
        });
      });
    });
  },

  // DELETE /api/blocked/:blockedUserId — bỏ chặn
  unblock: (req, res) => {
    const userId = req.user.user_id;
    const { blockedUserId } = req.params;

    blockedUsers.delete(userId, blockedUserId, (err, success) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi bỏ chặn" });
      }
      if (!success) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy bản ghi chặn" });
      }
      res.json({ status: "ok", message: "Đã bỏ chặn người dùng" });
    });
  },
};

module.exports = blockedUsersController;
