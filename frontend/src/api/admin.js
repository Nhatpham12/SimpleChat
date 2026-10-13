import api from "./axios";

export const adminAPI = {
  getStats: () => api.get("/admin/stats"),
  getUsers: (params) => api.get("/admin/users", { params }),
  setRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  setLocked: (id, locked) => api.patch(`/admin/users/${id}/lock`, { locked }),
  verifyEmail: (id) => api.patch(`/admin/users/${id}/verify`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
};
