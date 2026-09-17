import api from "./axios";

export const usersAPI = {
  getAll: () => api.get("/users"),
  getById: (id) => api.get(`/users/${id}`),
  search: (q) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
  getProfile: () => api.get("/users/profile"),
  updateProfile: (id, data) => api.put(`/users/${id}`, data),
  updateAvatar: (id, avatar_url) => api.patch(`/users/${id}/avatar`, { avatar_url }),
};
