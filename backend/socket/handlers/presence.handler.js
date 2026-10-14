const users = require("../../models/users.model");
const messageStatus = require("../../models/messageStatus.model");
const participants = require("../../models/participants.model");

// Đánh dấu đã đọc cả cuộc trò chuyện, rồi báo các thành viên khác để hiện "Đã xem"
const handleMarkRead = (socket, io) => {
  return (data) => {
    const { conversation_id } = data || {};
    const userId = socket.user.user_id;
    if (!conversation_id) return;

    participants.getOne(conversation_id, userId, (err, participant) => {
      if (err || !participant) return;
      messageStatus.markAllAsRead(conversation_id, userId, (err) => {
        if (err) return;
        messageStatus.getLastMessageId(conversation_id, (err, lastId) => {
          if (err || !lastId) return;
          io.to(`conversation:${conversation_id}`).emit("messages_seen", {
            conversation_id: Number(conversation_id),
            user_id: userId,
            message_id: lastId,
          });
        });
      });
    });
  };
};

const handleJoinConversation = (socket) => {
  return (conversationId) => {
    const userId = socket.user.user_id;
    participants.getOne(conversationId, userId, (err, participant) => {
      if (err || !participant) return;
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${userId} joined conversation ${conversationId}`);
    });
  };
};

// Socket được tự join mọi conversation khi kết nối, nên không rời room ở đây
// (nếu rời, user sẽ không nhận được tin nhắn mới của conversation đó nữa)
const handleLeaveConversation = () => {
  return () => {};
};

module.exports = {
  handleMarkRead,
  handleJoinConversation,
  handleLeaveConversation,
};
