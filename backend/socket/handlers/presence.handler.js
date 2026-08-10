const users = require("../../models/users.model");
const messageStatus = require("../../models/messageStatus.model");

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
    socket.join(`conversation:${conversationId}`);
    console.log(`User ${userId} joined conversation ${conversationId}`);
  };
};

const handleLeaveConversation = (socket) => {
  return (conversationId) => {
    const userId = socket.user.user_id;
    socket.leave(`conversation:${conversationId}`);
    console.log(`User ${userId} left conversation ${conversationId}`);
  };
};

module.exports = {
  handleMarkRead,
  handleJoinConversation,
  handleLeaveConversation,
};
