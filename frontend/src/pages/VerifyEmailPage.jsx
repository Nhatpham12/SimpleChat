import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../api/auth";
import useCountdown from "../hooks/useCountdown";

const RESEND_SECONDS = 60;

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(
    `Mã xác nhận gồm 6 số đã được gửi tới ${email}`,
  );
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useCountdown(RESEND_SECONDS);
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();

  if (!email) return <Navigate to="/login" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verifyEmail(email, otp);
      navigate("/chat");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.message || "Xác nhận thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await authAPI.resendVerification(email);
      setSuccess(`Đã gửi mã mới tới ${email}`);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.message || "Gửi lại mã thất bại");
      setCooldown(err.response?.data?.data?.retryAfter || 0);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h1>Xác nhận email</h1>
          <p>Nhập mã để kích hoạt tài khoản</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
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

          <button type="submit" className="auth-btn" disabled={loading || otp.length !== 6}>
            {loading ? "Đang xác nhận..." : "Xác nhận"}
          </button>

          <button
            type="button"
            className="auth-btn secondary"
            onClick={handleResend}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : "Gửi lại mã"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            <Link to="/login">Quay lại đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
