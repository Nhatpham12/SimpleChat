import api from "./axios";

export const messagesAPI = {
  getByConversation: (conversationId, limit = 50, offset = 0) =>
    api.get(`/messages/${conversationId}?limit=${limit}&offset=${offset}`),
  getById: (messageId) => api.get(`/messages/single/${messageId}`),
  create: (data) => api.post("/messages", data),
  update: (messageId, content) => api.put(`/messages/${messageId}`, { content }),
  delete: (messageId) => api.delete(`/messages/${messageId}`),
  markAsRead: (messageId) => api.patch(`/messages/${messageId}/read`),
  markAllAsRead: (conversationId) => api.patch(`/messages/conversation/${conversationId}/read`),
  getUnreadCount: (conversationId) => api.get(`/messages/${conversationId}/unread`),
};
