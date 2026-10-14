const attachments = require("../models/attachments.model");
const messages = require("../models/messages.model");
const participants = require("../models/participants.model");
const { cloudinary, IMAGE_MIMES } = require("../config/cloudinary.config");
const { canSendMessage } = require("../common/chatGuard");
const { deliverMessage } = require("../common/deliverMessage");

// Upload xong nhưng không gửi được tin → xóa file trên Cloudinary cho khỏi rác
const discardUpload = (file) => {
  if (!file?.filename) return;
  const resourceType = file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "raw";
  cloudinary.uploader.destroy(file.filename, { resource_type: resourceType }, () => {});
};

const attachmentsController = {
  // GET /api/attachments/:messageId
  getByMessageId: (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    messages.getById(messageId, (err, message) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy tệp đính kèm" });
      }
      if (!message) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tin nhắn" });
      }
      participants.getOne(message.conversation_id, userId, (err, participant) => {
        if (err || !participant) {
          return res.status(403).json({ status: "error", message: "Bạn không phải thành viên cuộc trò chuyện này" });
        }
        attachments.getByMessageId(messageId, (err, result) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi lấy tệp đính kèm" });
          }
          res.json({ status: "ok", data: message.is_deleted ? [] : result });
        });
      });
    });
  },

  // POST /api/attachments (multipart: file, conversation_id) — gửi ảnh / tệp vào cuộc trò chuyện
  create: (req, res) => {
    const userId = req.user.user_id;
    const { conversation_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ status: "error", message: "Chưa chọn file" });
    }
    if (!conversation_id) {
      discardUpload(req.file);
      return res.status(400).json({ status: "error", message: "conversation_id là bắt buộc" });
    }

    canSendMessage(conversation_id, userId, (err, reason) => {
      if (err || reason) {
        discardUpload(req.file);
        return res.status(err ? 500 : 403).json({ status: "error", message: reason || "Lỗi khi gửi tệp" });
      }

      const fileName = req.file.originalname.slice(0, 255);
      const attachment = {
        file_url: req.file.path,
        file_name: fileName,
        file_type: req.file.mimetype,
        file_size: req.file.size || null,
      };
      const type = IMAGE_MIMES.includes(req.file.mimetype) ? "image" : "file";

      deliverMessage(req.app.get("io"), { conversation_id, sender_id: userId, content: fileName, type, attachment }, (err, messageData) => {
        if (err) {
          discardUpload(req.file);
          return res.status(500).json({ status: "error", message: "Lỗi khi gửi tệp" });
        }
        res.status(201).json({ status: "ok", message: "Đã gửi", data: messageData });
      });
    });
  },

  // DELETE /api/attachments/:attachmentId — chỉ người gửi
  delete: (req, res) => {
    const { attachmentId } = req.params;
    const userId = req.user.user_id;

    attachments.getById(attachmentId, (err, attachment) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm tệp đính kèm" });
      }
      if (!attachment) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tệp đính kèm" });
      }

      messages.getById(attachment.message_id, (err, message) => {
        if (err || !message || message.sender_id !== userId) {
          return res.status(403).json({ status: "error", message: "Bạn chỉ có thể xóa tệp của mình" });
        }

        attachments.delete(attachmentId, (err) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi xóa tệp đính kèm" });
          }
          res.json({ status: "ok", message: "Xóa tệp đính kèm thành công" });
        });
      });
    });
  },
};

module.exports = attachmentsController;
