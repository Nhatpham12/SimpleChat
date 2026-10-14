import api from "./axios";

export const usersAPI = {
  getAll: () => api.get("/users"),
  getById: (id) => api.get(`/users/${id}`),
  search: (q) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
  getProfile: () => api.get("/users/profile"),
  updateProfile: (id, data) => api.put(`/users/${id}`, data),
  updateAvatar: (id, avatar_url) => api.patch(`/users/${id}/avatar`, { avatar_url }),
  // Content-Type multipart để axios không đổi FormData thành JSON; trình duyệt tự thêm boundary
  uploadAvatar: (file, onProgress) => {
    const form = new FormData();
    form.append("avatar", file);
    return api.post("/users/me/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    });
  },
};
