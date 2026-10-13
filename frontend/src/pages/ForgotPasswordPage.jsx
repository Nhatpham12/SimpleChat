import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../api/auth";
import { useToast } from "../context/ToastContext";
import useCountdown from "../hooks/useCountdown";
import AuthLayout from "../components/AuthLayout";

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState("email"); // "email" → "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useCountdown(0);
  const toast = useToast();
  const navigate = useNavigate();

  const sendCode = async () => {
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email);
      toast.success(res.data.message || `Đã gửi mã tới ${email}`);
      setStep("reset");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa gửi được mã xác nhận");
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

    if (newPassword.length < 8) {
      toast.error("Mật khẩu cần ít nhất 8 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Hai mật khẩu chưa khớp nhau");
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.resetPassword({ email, otp, newPassword });
      navigate("/login", { state: { message: res.data.message || "Đã đặt lại mật khẩu. Hãy đăng nhập lại." } });
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa đặt lại được mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Quên mật khẩu"
      subtitle={
        step === "email" ? (
          "Nhập email đã đăng ký, chúng tôi sẽ gửi mã xác nhận"
        ) : (
          <>
            Nhập mã gửi tới <strong>{email}</strong> và mật khẩu mới
          </>
        )
      }
    >
      {step === "email" ? (
        <form onSubmit={handleEmailSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@vidu.com"
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Đang gửi..." : "Gửi mã xác nhận"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetSubmit} className="auth-form">
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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="newPassword">Mật khẩu mới</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự"
                required
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Nhập lại</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading || otp.length !== 6}>
            {loading ? "Đang lưu..." : "Đặt lại mật khẩu"}
          </button>

          <button type="button" className="btn btn-ghost btn-block" onClick={sendCode} disabled={loading || cooldown > 0}>
            {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã"}
          </button>
        </form>
      )}

      <p className="auth-footer">
        <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
