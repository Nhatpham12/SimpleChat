import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AuthLayout from "../components/AuthLayout";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const noticeShownRef = useRef(false);

  // Thông báo chuyển từ trang khác (vd. đặt lại mật khẩu thành công)
  useEffect(() => {
    if (noticeShownRef.current) return;
    const notice = location.state?.message;
    if (notice) {
      noticeShownRef.current = true;
      toast.success(notice);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    // Lý do bị đăng xuất (hết phiên / tài khoản bị khóa), do axios hoặc socket để lại
    const flash = sessionStorage.getItem("flash");
    if (flash) {
      noticeShownRef.current = true;
      sessionStorage.removeItem("flash");
      toast.error(flash);
    }
  }, [location, navigate, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(username, password);
      navigate("/chat");
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "EMAIL_NOT_VERIFIED") {
        toast.info("Hãy xác nhận email trước khi đăng nhập");
        navigate(`/verify-email?email=${encodeURIComponent(data.data.email)}`);
        return;
      }
      toast.error(data?.message || "Không đăng nhập được. Kiểm tra lại tài khoản và mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Đăng nhập" subtitle="Chào mừng bạn quay lại">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="username">Username hoặc email</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="vd. lan.nguyen"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <div className="label-row">
            <label htmlFor="password">Mật khẩu</label>
            <Link to="/forgot-password">Quên mật khẩu?</Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p className="auth-footer">
        Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link>
      </p>
    </AuthLayout>
  );
}
