const db = require("./connect");
const messages = require("../models/messages.model");
const attachments = require("../models/attachments.model");
const users = require("../models/users.model");
const notifications = require("../models/notifications.model");
const { isUserOnline } = require("../socket/onlineUsers");

// Nội dung ngắn gọn của 1 tin (preview thông báo)
const previewText = (type, content) => {
  if (type === "image") return "[Hình ảnh]";
  if (type === "file") return `[Tệp] ${content}`;
  return content;
};

// Lưu tin nhắn + trạng thái đã nhận cho từng thành viên, rồi phát realtime "new_message".
// MessageStatus được ghi TRƯỚC khi phát để client nhận tin và báo "đã xem" ngay không bị mất.
// Tin "system" (vd. "X đã rời nhóm") không tính là chưa đọc.
// callback(err, messageData)
const deliverMessage = (io, { conversation_id, sender_id, content, type = "text", attachment = null }, callback = () => {}) => {
  messages.insert({ conversation_id, sender_id, content, type }, (err, messageId) => {
    if (err) return callback(err);

    const afterAttachment = (err) => {
      if (err) return callback(err);

      users.getById(sender_id, (err, sender) => {
        const messageData = {
          message_id: messageId,
          conversation_id: Number(conversation_id),
          sender_id,
          sender_name: sender ? sender.username : "Unknown",
          sender_avatar: sender ? sender.avatar_url : null,
          content,
          type,
          is_deleted: false,
          created_at: new Date().toISOString(),
          ...(attachment && {
            file_url: attachment.file_url,
            file_name: attachment.file_name,
            file_type: attachment.file_type,
            file_size: attachment.file_size,
          }),
        };

        const getMembersSql = `SELECT user_id FROM Participants WHERE conversation_id = ? AND user_id != ?`;
        db.query(getMembersSql, [conversation_id, sender_id], (err, members) => {
          const others = !err && members ? members : [];

          const emit = () => {
            io?.to(`conversation:${conversation_id}`).emit("new_message", messageData);
            callback(null, messageData);

            if (type === "system") return;
            others.forEach((member) => {
              if (isUserOnline(member.user_id)) return;
              notifications.insert(
                {
                  user_id: member.user_id,
                  type: "message",
                  content: `${messageData.sender_name}: ${previewText(type, content).substring(0, 100)}`,
                  reference_id: conversation_id,
                },
                () => {},
              );
            });
          };

          if (type === "system" || others.length === 0) return emit();
          const rows = others.map((m) => [messageId, m.user_id, "sent"]);
          db.query(`INSERT IGNORE INTO MessageStatus (message_id, receiver_id, status) VALUES ?`, [rows], () => emit());
        });
      });
    };

    if (!attachment) return afterAttachment(null);
    attachments.insert({ message_id: messageId, ...attachment }, afterAttachment);
  });
};

module.exports = { deliverMessage, previewText };
