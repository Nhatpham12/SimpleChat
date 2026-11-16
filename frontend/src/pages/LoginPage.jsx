import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AuthLayout from "../components/AuthLayout";
import useCountdown from "../hooks/useCountdown";
import { authAPI } from "../api/auth";

const RESEND_SECONDS = 60;

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  // Bước 2 khi tài khoản bật đăng nhập 2 bước: { mfaToken, email }
  const [mfa, setMfa] = useState(null);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useCountdown(0);
  const { login, verifyLoginMfa } = useAuth();
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
      const result = await login(username, password, remember);
      if (result.mfa) {
        setMfa(result.mfa);
        setOtp("");
        setCooldown(RESEND_SECONDS);
        return;
      }
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

  // Hết phiên bước 2 / bị khóa tạm → quay lại nhập mật khẩu
  const backToPassword = () => {
    setMfa(null);
    setOtp("");
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyLoginMfa(mfa.mfaToken, otp, remember);
      navigate("/chat");
    } catch (err) {
      const data = err.response?.data;
      toast.error(data?.message || "Mã đăng nhập không đúng hoặc đã hết hạn");
      if (data?.code === "MFA_EXPIRED" || data?.code === "LOGIN_LOCKED") backToPassword();
    } finally {
      setLoading(false);
    }
  };

  const handleResendMfa = async () => {
    try {
      await authAPI.resendLoginMfa(mfa.mfaToken);
      toast.success(`Đã gửi mã mới tới ${mfa.email}`);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      const data = err.response?.data;
      toast.error(data?.message || "Chưa gửi lại được mã");
      if (data?.code === "MFA_EXPIRED" || data?.code === "LOGIN_LOCKED") return backToPassword();
      setCooldown(data?.data?.retryAfter || 0);
    }
  };

  if (mfa) {
    return (
      <AuthLayout
        title="Xác minh đăng nhập"
        subtitle={
          <>
            Nhập mã 6 số vừa gửi tới <strong>{mfa.email}</strong>
          </>
        }
      >
        <form onSubmit={handleVerifyMfa} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-otp">Mã đăng nhập</label>
            <input
              id="login-otp"
              className="otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
              minLength={6}
              maxLength={6}
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading || otp.length !== 6}>
            {loading ? "Đang xác minh..." : "Xác minh"}
          </button>

          <button type="button" className="btn btn-ghost btn-block" onClick={handleResendMfa} disabled={cooldown > 0}>
            {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã"}
          </button>
        </form>

        <p className="auth-footer">
          <button type="button" className="link-button" onClick={backToPassword}>
            Quay lại đăng nhập
          </button>
        </p>
      </AuthLayout>
    );
  }

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

        <label className="checkbox-row">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Ghi nhớ đăng nhập
        </label>

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
