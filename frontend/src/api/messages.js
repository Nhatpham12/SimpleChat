import api from "./axios";

export const messagesAPI = {
  getByConversation: (conversationId, limit = 50, offset = 0) =>
    api.get(`/messages/${conversationId}?limit=${limit}&offset=${offset}`),
  getAround: (conversationId, messageId, limit = 50) =>
    api.get(`/messages/${conversationId}?limit=${limit}&around=${messageId}`),
  search: (conversationId, q) =>
    api.get(`/messages/${conversationId}/search?q=${encodeURIComponent(q)}`),
  getShared: (conversationId, kind) => api.get(`/messages/${conversationId}/shared?kind=${kind}`),
  getSeen: (conversationId) => api.get(`/messages/${conversationId}/seen`),
  clearHistory: (conversationId) => api.delete(`/messages/conversation/${conversationId}/history`),
  sendFile: (conversationId, file, onProgress) => {
    const form = new FormData();
    form.append("conversation_id", conversationId);
    form.append("file", file);
    return api.post("/attachments", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    });
  },
  getById: (messageId) => api.get(`/messages/single/${messageId}`),
  create: (data) => api.post("/messages", data),
  update: (messageId, content) => api.put(`/messages/${messageId}`, { content }),
  delete: (messageId) => api.delete(`/messages/${messageId}`),
  markAsRead: (messageId) => api.patch(`/messages/${messageId}/read`),
  markAllAsRead: (conversationId) => api.patch(`/messages/conversation/${conversationId}/read`),
  getUnreadCount: (conversationId) => api.get(`/messages/${conversationId}/unread`),
};
