const attachments = require("../models/attachments.model");

const attachmentsController = {
  // GET /api/attachments/:messageId — lấy attachments của tin nhắn
  getByMessageId: (req, res) => {
    const { messageId } = req.params;
    attachments.getByMessageId(messageId, (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy tệp đính kèm" });
      }
      res.json({ status: "ok", data: result });
    });
  },

  // POST /api/attachments — upload attachment
  create: (req, res) => {
    const { message_id, file_url, file_type, file_size } = req.body;

    if (!message_id || !file_url) {
      return res.status(400).json({ status: "error", message: "message_id và file_url là bắt buộc" });
    }

    attachments.insert({ message_id, file_url, file_type, file_size }, (err, attachmentId) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lưu tệp đính kèm" });
      }
      res.status(201).json({ status: "ok", message: "Upload thành công", data: { attachment_id: attachmentId } });
    });
  },

  // DELETE /api/attachments/:attachmentId — xóa attachment
  delete: (req, res) => {
    const { attachmentId } = req.params;
    attachments.delete(attachmentId, (err, success) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi xóa tệp đính kèm" });
      }
      if (!success) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tệp đính kèm" });
      }
      res.json({ status: "ok", message: "Xóa tệp đính kèm thành công" });
    });
  },
};

module.exports = attachmentsController;
