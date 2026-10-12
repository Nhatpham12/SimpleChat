import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../api/auth";
import useCountdown from "../hooks/useCountdown";

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState("email"); // "email" → "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useCountdown(0);
  const navigate = useNavigate();

  const sendCode = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email);
      setSuccess(res.data.message);
      setStep("reset");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.message || "Gửi mã thất bại");
      const retryAfter = err.response?.data?.data?.retryAfter;
      if (retryAfter) {
        setStep("reset");
        setCooldown(retryAfter);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    sendCode();
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.resetPassword({ email, otp, newPassword });
      navigate("/login", { state: { message: res.data.message } });
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.message || "Đặt lại mật khẩu thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1>Quên mật khẩu</h1>
          <p>
            {step === "email"
              ? "Nhập email để nhận mã xác nhận"
              : "Nhập mã xác nhận và mật khẩu mới"}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email đã đăng ký"
                required
                autoFocus
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Đang gửi..." : "Gửi mã xác nhận"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <div className="form-group">
              <label htmlFor="otp">Mã xác nhận</label>
              <input
                id="otp"
                className="otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="______"
                required
                minLength={6}
                maxLength={6}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">Mật khẩu mới</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                required
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading || otp.length !== 6}>
              {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
            </button>

            <button
              type="button"
              className="auth-btn secondary"
              onClick={sendCode}
              disabled={loading || cooldown > 0}
            >
              {cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : "Gửi lại mã"}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <Link to="/login">Quay lại đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
