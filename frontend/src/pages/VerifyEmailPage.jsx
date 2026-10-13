import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authAPI } from "../api/auth";
import useCountdown from "../hooks/useCountdown";
import AuthLayout from "../components/AuthLayout";

const RESEND_SECONDS = 60;

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useCountdown(RESEND_SECONDS);
  const { verifyEmail } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  if (!email) return <Navigate to="/login" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await verifyEmail(email, otp);
      toast.success("Email đã được xác nhận. Chào mừng bạn!");
      navigate("/chat");
    } catch (err) {
      toast.error(err.response?.data?.message || "Mã xác nhận không đúng hoặc đã hết hạn");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authAPI.resendVerification(email);
      toast.success(`Đã gửi mã mới tới ${email}`);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa gửi lại được mã");
      setCooldown(err.response?.data?.data?.retryAfter || 0);
    }
  };

  return (
    <AuthLayout
      title="Xác nhận email"
      subtitle={
        <>
          Nhập mã 6 số vừa gửi tới <strong>{email}</strong>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form">
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
            placeholder="000000"
            required
            minLength={6}
            maxLength={6}
            autoFocus
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading || otp.length !== 6}>
          {loading ? "Đang xác nhận..." : "Xác nhận"}
        </button>

        <button type="button" className="btn btn-ghost btn-block" onClick={handleResend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã"}
        </button>
      </form>

      <p className="auth-footer">
        <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
