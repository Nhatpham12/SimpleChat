const onlineUsers = new Map();

const addOnlineUser = (userId, socketId) => {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
};

const removeOnlineUser = (userId, socketId) => {
  const userSockets = onlineUsers.get(userId);
  if (userSockets) {
    userSockets.delete(socketId);
    if (userSockets.size === 0) {
      onlineUsers.delete(userId);
      return true;
    }
  }
  return false;
};

const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

const getOnlineUserIds = () => {
  return [...onlineUsers.keys()];
};

module.exports = {
  addOnlineUser,
  removeOnlineUser,
  isUserOnline,
  getOnlineUserIds,
};
