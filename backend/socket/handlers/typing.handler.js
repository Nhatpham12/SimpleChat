const { createSocketLimiter } = require("../../middlewares/rateLimit.middleware");

// Chỉ phát "đang gõ" vào cuộc trò chuyện mà socket đã ở trong room (= là thành viên,
// server tự join khi kết nối / được thêm vào nhóm), có giới hạn tần suất chống spam.
const makeTypingHandler = (socket, event, withUsername) => {
  const allow = createSocketLimiter(30, 10 * 1000);
  return (conversationId) => {
    const room = `conversation:${conversationId}`;
    if (!socket.rooms.has(room) || !allow()) return;
    socket.to(room).emit(event, {
      user_id: socket.user.user_id,
      ...(withUsername && { username: socket.user.username }),
      conversation_id: conversationId,
    });
  };
};

const handleTypingStart = (socket) => makeTypingHandler(socket, "user_typing", true);
const handleTypingStop = (socket) => makeTypingHandler(socket, "user_stop_typing", false);

module.exports = { handleTypingStart, handleTypingStop };
