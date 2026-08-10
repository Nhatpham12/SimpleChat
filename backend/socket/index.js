const users = require("../models/users.model");
const { handleMessage } = require("./handlers/message.handler");
const { handleTypingStart, handleTypingStop } = require("./handlers/typing.handler");
const {
  handleMarkRead,
  handleJoinConversation,
  handleLeaveConversation,
} = require("./handlers/presence.handler");
const {
  addOnlineUser,
  removeOnlineUser,
  getOnlineUserIds,
} = require("./onlineUsers");

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.user.user_id;
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    addOnlineUser(userId, socket.id);

    users.updateStatus(userId, "online", () => {});
    socket.broadcast.emit("user_online", { user_id: userId });
    socket.emit("online_users", getOnlineUserIds());

    socket.on("join_conversation", handleJoinConversation(socket));
    socket.on("leave_conversation", handleLeaveConversation(socket));

    socket.on("send_message", handleMessage(socket, io, { has: (id) => require("./onlineUsers").isUserOnline(id) }));
    socket.on("typing_start", handleTypingStart(socket));
    socket.on("typing_stop", handleTypingStop(socket));
    socket.on("mark_read", handleMarkRead(socket));

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId} (socket: ${socket.id})`);
      const allDisconnected = removeOnlineUser(userId, socket.id);

      if (allDisconnected) {
        users.updateStatus(userId, "offline", () => {});
        socket.broadcast.emit("user_offline", { user_id: userId });
      }
    });
  });
};

module.exports = { setupSocket };
