const { canSendMessage } = require("../../common/chatGuard");
const { createSocketLimiter } = require("../../middlewares/rateLimit.middleware");
const { deliverMessage } = require("../../common/deliverMessage");

const handleMessage = (socket, io) => {
  // Mỗi kết nối tối đa 20 tin / 10 giây
  const allowSend = createSocketLimiter(20, 10 * 1000);

  return (data) => {
    const { conversation_id, content } = data || {};
    const userId = socket.user.user_id;

    if (!allowSend()) {
      return socket.emit("error", { message: "Bạn gửi tin nhắn quá nhanh, chờ vài giây rồi gửi tiếp nhé" });
    }

    if (typeof content === "string" && content.length > 5000) {
      return socket.emit("error", { message: "Tin nhắn quá dài (tối đa 5000 ký tự)" });
    }

    if (!conversation_id || !content || typeof content !== "string") {
      return socket.emit("error", {
        message: "conversation_id và content là bắt buộc",
      });
    }

    canSendMessage(conversation_id, userId, (err, reason) => {
      if (err || reason) {
        return socket.emit("error", {
          message: reason || "Lỗi khi gửi tin nhắn",
          conversation_id,
        });
      }

      // Ảnh/tệp gửi qua POST /api/attachments, socket chỉ nhận tin văn bản
      deliverMessage(io, { conversation_id, sender_id: userId, content, type: "text" }, (err) => {
        if (err) socket.emit("error", { message: "Lỗi khi gửi tin nhắn" });
      });
    });
  };
};

module.exports = { handleMessage };
