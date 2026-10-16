import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../api/auth";
import { getToken, saveSession as storeSession, updateStoredUser, clearSession } from "../utils/session";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await authAPI.getMe();
      setUser(res.data.data.user);
    } catch {
      clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Đăng xuất ở một tab → các tab khác (dùng chung localStorage) cũng đăng xuất
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "token" && !e.newValue && !getToken()) setUser(null);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveSession = (data, remember) => {
    storeSession(data, remember);
    setUser(data.user);
    return data.user;
  };

  const login = async (username, password, remember = true) => {
    const res = await authAPI.login({ username, password, remember });
    return saveSession(res.data.data, remember);
  };

  // Đăng ký chỉ tạo tài khoản, phải xác nhận OTP email mới đăng nhập được
  const register = async (username, email, password) => {
    const res = await authAPI.register({ username, email, password });
    return res.data.data.email;
  };

  // Server cấp token dài hạn cho lần đăng nhập ngay sau khi xác nhận email
  const verifyEmail = async (email, otp) => {
    const res = await authAPI.verifyEmail({ email, otp });
    return saveSession(res.data.data, true);
  };

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // ignore
    }
    clearSession();
    setUser(null);
  }, []);

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    updateStoredUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyEmail, logout, updateUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
