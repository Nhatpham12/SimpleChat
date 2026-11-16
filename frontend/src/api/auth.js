import api from "./axios";

export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  verifyLoginMfa: (data) => api.post("/auth/mfa/verify", data),
  mfaSetup: () => api.post("/auth/mfa/setup"),
  mfaEnable: (code) => api.post("/auth/mfa/enable", { code }),
  mfaDisable: (data) => api.post("/auth/mfa/disable", data),
  register: (data) => api.post("/auth/register", data),
  getMe: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
  changePassword: (data) => api.put("/auth/change-password", data),
  verifyEmail: (data) => api.post("/auth/verify-email", data),
  resendVerification: (email) =>
    api.post("/auth/resend-verification", { email }),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (data) => api.post("/auth/reset-password", data),
};
