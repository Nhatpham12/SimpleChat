import api from "./axios";

export const conversationsAPI = {
  getAll: () => api.get("/conversations"),
  getById: (id) => api.get(`/conversations/${id}`),
  create: (data) => api.post("/conversations", data),
  update: (id, data) => api.put(`/conversations/${id}`, data),
  delete: (id) => api.delete(`/conversations/${id}`),
  addMembers: (id, member_ids) => api.post(`/conversations/${id}/members`, { member_ids }),
  leave: (id, userId) => api.delete(`/conversations/${id}/members/${userId}`),
  removeMember: (id, memberId) => api.delete(`/conversations/${id}/members/${memberId}`),
};
