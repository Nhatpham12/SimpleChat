const attachments = require("../models/attachments.model");
const { cloudinary } = require("../config/cloudinary.config");

const attachmentsController = {
  getByMessageId: (req, res) => {
    const { messageId } = req.params;
    attachments.getByMessageId(messageId, (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy tệp đính kèm" });
      }
      res.json({ status: "ok", data: result });
    });
  },

  create: (req, res) => {
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "Không có file nào được upload" });
    }

    const { message_id } = req.body;
    if (!message_id) {
      return res.status(400).json({ status: "error", message: "message_id là bắt buộc" });
    }

    const fileData = {
      message_id,
      file_url: req.file.path,
      file_type: req.file.mimetype,
      file_size: req.file.size,
    };

    attachments.insert(fileData, (err, attachmentId) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lưu tệp đính kèm" });
      }
      res.status(201).json({
        status: "ok",
        message: "Upload thành công",
        data: {
          attachment_id: attachmentId,
          file_url: req.file.path,
          file_type: req.file.mimetype,
          file_size: req.file.size,
        },
      });
    });
  },

  delete: (req, res) => {
    const { attachmentId } = req.params;

    attachments.getById(attachmentId, (err, attachment) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm tệp đính kèm" });
      }
      if (!attachment) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tệp đính kèm" });
      }

      const fileUrl = attachment.file_url;
      const publicId = fileUrl.split("/").pop().split(".")[0];

      cloudinary.uploader.destroy(`simplechat/${publicId}`, (err) => {
        if (err) {
          console.error("Lỗi xóa file trên Cloudinary:", err.message);
        }

        attachments.delete(attachmentId, (err, success) => {
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
