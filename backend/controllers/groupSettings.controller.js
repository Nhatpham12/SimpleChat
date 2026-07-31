const groupSettings = require("../models/groupSettings.model");
const conversations = require("../models/conversation.model");
const participants = require("../models/participants.model");

const groupSettingsController = {
  // GET /api/group-settings/:conversationId — lấy tất cả cài đặt của nhóm
  getByConversationId: (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.user_id;

    participants.getOne(conversationId, userId, (err, participant) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra thành viên" });
      }
      if (!participant) {
        return res.status(403).json({ status: "error", message: "Bạn không phải thành viên nhóm này" });
      }

      groupSettings.getByConversationId(conversationId, (err, result) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi lấy cài đặt nhóm" });
        }
        res.json({ status: "ok", data: result });
      });
    });
  },

  // GET /api/group-settings/:conversationId/:settingName — lấy 1 cài đặt cụ thể
  getOne: (req, res) => {
    const { conversationId, settingName } = req.params;
    const userId = req.user.user_id;

    participants.getOne(conversationId, userId, (err, participant) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra thành viên" });
      }
      if (!participant) {
        return res.status(403).json({ status: "error", message: "Bạn không phải thành viên nhóm này" });
      }

      groupSettings.getOne(conversationId, settingName, (err, result) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi lấy cài đặt" });
        }
        if (!result) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy cài đặt" });
        }
        res.json({ status: "ok", data: result });
      });
    });
  },

  // PUT /api/group-settings/:conversationId — cập nhật/ tạo cài đặt (chỉ admin)
  upsert: (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.user_id;
    const { setting_name, setting_value } = req.body;

    if (!setting_name) {
      return res.status(400).json({ status: "error", message: "setting_name là bắt buộc" });
    }

    if (setting_name.length > 50) {
      return res.status(400).json({ status: "error", message: "setting_name không được quá 50 ký tự" });
    }

    conversations.getById(conversationId, (err, conversation) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy thông tin nhóm" });
      }
      if (!conversation) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy nhóm" });
      }
      if (conversation.type !== "group") {
        return res.status(400).json({ status: "error", message: "Chỉ nhóm mới có cài đặt" });
      }

      participants.getOne(conversationId, userId, (err, participant) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra quyền" });
        }
        if (!participant || participant.role !== "admin") {
          return res.status(403).json({ status: "error", message: "Chỉ admin mới được cập nhật cài đặt nhóm" });
        }

        groupSettings.insertOrUpdate(conversationId, setting_name, setting_value || null, (err, result) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi cập nhật cài đặt" });
          }
          res.json({ status: "ok", message: "Cập nhật cài đặt thành công" });
        });
      });
    });
  },

  // DELETE /api/group-settings/:conversationId/:settingName — xóa cài đặt (chỉ admin)
  delete: (req, res) => {
    const { conversationId, settingName } = req.params;
    const userId = req.user.user_id;

    conversations.getById(conversationId, (err, conversation) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy thông tin nhóm" });
      }
      if (!conversation) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy nhóm" });
      }

      participants.getOne(conversationId, userId, (err, participant) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra quyền" });
        }
        if (!participant || participant.role !== "admin") {
          return res.status(403).json({ status: "error", message: "Chỉ admin mới được xóa cài đặt nhóm" });
        }

        groupSettings.delete(conversationId, settingName, (err, success) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi xóa cài đặt" });
          }
          if (!success) {
            return res.status(404).json({ status: "error", message: "Không tìm thấy cài đặt" });
          }
          res.json({ status: "ok", message: "Xóa cài đặt thành công" });
        });
      });
    });
  },
};

module.exports = groupSettingsController;
