const handleTypingStart = (socket) => {
  return (conversationId) => {
    socket.to(`conversation:${conversationId}`).emit("user_typing", {
      user_id: socket.user.user_id,
      conversation_id: conversationId,
    });
  };
};

const handleTypingStop = (socket) => {
  return (conversationId) => {
    socket.to(`conversation:${conversationId}`).emit("user_stop_typing", {
      user_id: socket.user.user_id,
      conversation_id: conversationId,
    });
  };
};

module.exports = { handleTypingStart, handleTypingStop };
