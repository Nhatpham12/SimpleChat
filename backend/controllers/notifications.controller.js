const notifications = require("../models/notifications.model");
const db = require("../common/connect");

const notificationsController = {
  // GET /api/notifications — lấy tất cả thông báo của user
  getByUserId: (req, res) => {
    const userId = req.user.user_id;
    notifications.getByUserId(userId, (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy thông báo" });
      }
      res.json({ status: "ok", data: result });
    });
  },

  // GET /api/notifications/unread-count — lấy số thông báo chưa đọc
  getUnreadCount: (req, res) => {
    const userId = req.user.user_id;
    notifications.getUnreadCount(userId, (err, count) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy số thông báo chưa đọc" });
      }
      res.json({ status: "ok", data: { unread_count: count } });
    });
  },

  // POST /api/notifications — tạo thông báo mới (dùng nội bộ hoặc admin)
  create: (req, res) => {
    const { user_id, type, content, reference_id } = req.body;

    if (!user_id || !type) {
      return res.status(400).json({ status: "error", message: "user_id và type là bắt buộc" });
    }

    const validTypes = ["friend_request", "friend_accept", "message", "system", "group_invite"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ status: "error", message: `Type phải là một trong: ${validTypes.join(", ")}` });
    }

    notifications.insert({ user_id, type, content, reference_id }, (err, notificationId) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tạo thông báo" });
      }
      res.status(201).json({ status: "ok", message: "Tạo thông báo thành công", data: { notification_id: notificationId } });
    });
  },

  // PATCH /api/notifications/:id/seen — đánh dấu 1 thông báo đã đọc
  markAsSeen: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;

    const checkSql = `SELECT notification_id, user_id FROM Notifications WHERE notification_id = ?`;
    db.query(checkSql, [id], (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm thông báo" });
      }
      if (!result || result.length === 0) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy thông báo" });
      }
      if (result[0].user_id !== userId && req.user.role !== "admin") {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền đánh dấu thông báo này" });
      }

      notifications.markAsSeen(id, (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi đánh dấu đã đọc" });
        }
        res.json({ status: "ok", message: "Đã đánh dấu thông báo là đã đọc" });
      });
    });
  },

  // PATCH /api/notifications/seen-all — đánh dấu tất cả thông báo đã đọc
  markAllAsSeen: (req, res) => {
    const userId = req.user.user_id;
    notifications.markAllAsSeen(userId, (err, success) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi đánh dấu tất cả đã đọc" });
      }
      res.json({ status: "ok", message: "Đã đánh dấu tất cả thông báo là đã đọc" });
    });
  },

  // DELETE /api/notifications/:id — xóa thông báo
  delete: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;

    const checkSql = `SELECT notification_id, user_id FROM Notifications WHERE notification_id = ?`;
    db.query(checkSql, [id], (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm thông báo" });
      }
      if (!result || result.length === 0) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy thông báo" });
      }
      if (result[0].user_id !== userId && req.user.role !== "admin") {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền xóa thông báo này" });
      }

      notifications.delete(id, (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi xóa thông báo" });
        }
        res.json({ status: "ok", message: "Xóa thông báo thành công" });
      });
    });
  },
};

module.exports = notificationsController;
