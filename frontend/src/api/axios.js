import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Chỉ đẩy về /login khi phiên đăng nhập hết hạn, không phải khi nhập sai mật khẩu
    if (error.response?.status === 401 && sessionStorage.getItem("token")) {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      // Trang đăng nhập hiện lý do (vd. tài khoản bị khóa) bằng pop-up
      const reason = error.response.data?.code === "ACCOUNT_LOCKED" ? error.response.data.message : "Phiên đăng nhập đã hết hạn, hãy đăng nhập lại";
      sessionStorage.setItem("flash", reason);
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
