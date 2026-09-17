import api from "./axios";

export const contactsAPI = {
  getAll: () => api.get("/contacts"),
  getPending: () => api.get("/contacts/pending"),
  checkStatus: (friendId) => api.get(`/contacts/check/${friendId}`),
  sendRequest: (friend_id) => api.post("/contacts/request", { friend_id }),
  accept: (contactId) => api.put(`/contacts/accept/${contactId}`),
  reject: (contactId) => api.delete(`/contacts/reject/${contactId}`),
  remove: (friendId) => api.delete(`/contacts/${friendId}`),
};
