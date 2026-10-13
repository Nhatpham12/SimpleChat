const users = require("../../models/users.model");
const messageStatus = require("../../models/messageStatus.model");
const participants = require("../../models/participants.model");

const handleMarkRead = (socket) => {
  return (data) => {
    const { conversation_id, message_id } = data;
    const userId = socket.user.user_id;

    if (message_id) {
      messageStatus.markAsRead(message_id, userId, () => {});
    } else if (conversation_id) {
      messageStatus.markAllAsRead(conversation_id, userId, () => {});
    }
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
