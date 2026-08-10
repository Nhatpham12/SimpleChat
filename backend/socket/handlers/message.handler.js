const messages = require("../../models/messages.model");
const participants = require("../../models/participants.model");
const messageStatus = require("../../models/messageStatus.model");
const users = require("../../models/users.model");
const db = require("../../common/connect");
const notifications = require("../../models/notifications.model");

const handleMessage = (socket, io, onlineUsers) => {
  return (data) => {
    const { conversation_id, content, type } = data;
    const userId = socket.user.user_id;

    if (!conversation_id || !content) {
      return socket.emit("error", {
        message: "conversation_id và content là bắt buộc",
      });
    }

    participants.getOne(conversation_id, userId, (err, participant) => {
      if (err || !participant) {
        return socket.emit("error", {
          message: "Bạn không phải thành viên cuộc trò chuyện này",
        });
      }

      messages.insert(
        { conversation_id, sender_id: userId, content, type: type || "text" },
        (err, messageId) => {
          if (err) {
            return socket.emit("error", { message: "Lỗi khi gửi tin nhắn" });
          }

          users.getById(userId, (err, sender) => {
            const messageData = {
              message_id: messageId,
              conversation_id,
              sender_id: userId,
              sender_name: sender ? sender.username : "Unknown",
              content,
              type: type || "text",
              created_at: new Date().toISOString(),
            };

            io.to(`conversation:${conversation_id}`).emit(
              "new_message",
              messageData
            );

            const getMembersSql = `SELECT user_id FROM Participants WHERE conversation_id = ? AND user_id != ?`;
            db.query(
              getMembersSql,
              [conversation_id, userId],
              (err, members) => {
                if (!err && members) {
                  members.forEach((member) => {
                    messageStatus.insert(
                      {
                        message_id: messageId,
                        receiver_id: member.user_id,
                        status: "sent",
                      },
                      () => {}
                    );

                    if (!onlineUsers.has(member.user_id)) {
                      notifications.insert(
                        {
                          user_id: member.user_id,
                          type: "message",
                          content: `${sender ? sender.username : "Unknown"}: ${content.substring(0, 100)}`,
                          reference_id: conversation_id,
                        },
                        () => {}
                      );
                    }
                  });
                }
              }
            );
          });
        }
      );
    });
  };
};

module.exports = { handleMessage };
