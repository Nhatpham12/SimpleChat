const messages = require("../models/messages.model");
const messageStatus = require("../models/messageStatus.model");
const participants = require("../models/participants.model");
const db = require("../common/connect");

const messagesController = {
  // GET /api/messages/:conversationId — lấy tin nhắn theo conversation (phân trang)
  getByConversationId: (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.user_id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Kiểm tra user có phải thành viên không
    participants.getOne(conversationId, userId, (err, participant) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra thành viên" });
      }
      if (!participant) {
        return res.status(403).json({ status: "error", message: "Bạn không phải thành viên cuộc trò chuyện này" });
      }

      messages.getByConversationId(conversationId, limit, offset, (err, result) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi lấy tin nhắn" });
        }
        res.json({ status: "ok", data: result });
      });
    });
  },

  // GET /api/messages/single/:messageId — lấy 1 tin nhắn
  getById: (req, res) => {
    const { messageId } = req.params;

    messages.getById(messageId, (err, message) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy tin nhắn" });
      }
      if (!message) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tin nhắn" });
      }
      res.json({ status: "ok", data: message });
    });
  },

  // POST /api/messages — gửi tin nhắn
  create: (req, res) => {
    const userId = req.user.user_id;
    const { conversation_id, content, type } = req.body;

    if (!conversation_id) {
      return res.status(400).json({ status: "error", message: "conversation_id là bắt buộc" });
    }
    if (content === undefined || content === null || (typeof content === "string" && content.trim().length === 0)) {
      return res.status(400).json({ status: "error", message: "Content không được để trống" });
    }

    const msgType = type || "text";
    const validTypes = ["text", "image", "file", "system"];
    if (!validTypes.includes(msgType)) {
      return res.status(400).json({ status: "error", message: `Type phải là một trong: ${validTypes.join(", ")}` });
    }

    // Kiểm tra user là thành viên
    participants.getOne(conversation_id, userId, (err, participant) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra thành viên" });
      }
      if (!participant) {
        return res.status(403).json({ status: "error", message: "Bạn không phải thành viên cuộc trò chuyện này" });
      }

      messages.insert({ conversation_id, sender_id: userId, content, type: msgType }, (err, messageId) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi gửi tin nhắn" });
        }

        // Tạo message status cho tất cả thành viên khác
        const getMembersSql = `SELECT user_id FROM Participants WHERE conversation_id = ? AND user_id != ?`;
        db.query(getMembersSql, [conversation_id, userId], (err, members) => {
          if (err) {
            return res.status(201).json({ status: "ok", message: "Gửi tin nhắn thành công", data: { message_id: messageId } });
          }

          if (members.length === 0) {
            return res.status(201).json({ status: "ok", message: "Gửi tin nhắn thành công", data: { message_id: messageId } });
          }

          let created = 0;
          members.forEach((member) => {
            messageStatus.insert({ message_id: messageId, receiver_id: member.user_id, status: "sent" }, () => {
              created++;
              if (created === members.length) {
                res.status(201).json({ status: "ok", message: "Gửi tin nhắn thành công", data: { message_id: messageId } });
              }
            });
          });
        });
      });
    });
  },

  // PUT /api/messages/:messageId — chỉnh sửa tin nhắn
  update: (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.user_id;
    const { content } = req.body;

    if (!content || (typeof content === "string" && content.trim().length === 0)) {
      return res.status(400).json({ status: "error", message: "Content không được để trống" });
    }

    messages.getById(messageId, (err, message) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy tin nhắn" });
      }
      if (!message) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tin nhắn" });
      }
      if (message.sender_id !== userId) {
        return res.status(403).json({ status: "error", message: "Bạn chỉ có thể chỉnh sửa tin nhắn của mình" });
      }

      messages.update(messageId, content, (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi cập nhật tin nhắn" });
        }
        if (!success) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy tin nhắn" });
        }
        res.json({ status: "ok", message: "Cập nhật tin nhắn thành công" });
      });
    });
  },

  // DELETE /api/messages/:messageId — xóa tin nhắn (soft delete)
  delete: (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    messages.getById(messageId, (err, message) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy tin nhắn" });
      }
      if (!message) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tin nhắn" });
      }
      if (message.sender_id !== userId) {
        return res.status(403).json({ status: "error", message: "Bạn chỉ có thể xóa tin nhắn của mình" });
      }

      messages.softDelete(messageId, (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi xóa tin nhắn" });
        }
        if (!success) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy tin nhắn" });
        }
        res.json({ status: "ok", message: "Xóa tin nhắn thành công" });
      });
    });
  },

  // PATCH /api/messages/:messageId/read — đánh dấu đã đọc
  markAsRead: (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    messages.getById(messageId, (err, message) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy tin nhắn" });
      }
      if (!message) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tin nhắn" });
      }

      messageStatus.markAsRead(messageId, userId, (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi đánh dấu đã đọc" });
        }
        res.json({ status: "ok", message: "Đã đánh dấu tin nhắn là đã đọc" });
      });
    });
  },

  // PATCH /api/messages/conversation/:conversationId/read — đánh dấu tất cả tin nhắn trong conversation đã đọc
  markAllAsRead: (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.user_id;

    participants.getOne(conversationId, userId, (err, participant) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra thành viên" });
      }
      if (!participant) {
        return res.status(403).json({ status: "error", message: "Bạn không phải thành viên cuộc trò chuyện này" });
      }

      messageStatus.markAllAsRead(conversationId, userId, (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi đánh dấu đã đọc" });
        }
        res.json({ status: "ok", message: "Đã đánh dấu tất cả tin nhắn là đã đọc" });
      });
    });
  },

  // GET /api/messages/:conversationId/unread — lấy số tin nhắn chưa đọc
  getUnreadCount: (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.user_id;

    messageStatus.getUnreadCount(userId, conversationId, (err, count) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy số tin nhắn chưa đọc" });
      }
      res.json({ status: "ok", data: { unread_count: count } });
    });
  },
};

module.exports = messagesController;
