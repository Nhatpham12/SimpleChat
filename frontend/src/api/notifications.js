import api from "./axios";

export const notificationsAPI = {
  getAll: () => api.get("/notifications"),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsSeen: (id) => api.patch(`/notifications/${id}/seen`),
  markAllAsSeen: () => api.patch("/notifications/seen-all"),
  delete: (id) => api.delete(`/notifications/${id}`),
};
