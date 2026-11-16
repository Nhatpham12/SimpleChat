import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authAPI } from "../api/auth";

// Đăng nhập 2 bước (TOTP): Bật → quét QR → nhập mã → lưu mã khôi phục (chỉ hiện 1 lần).
// Tắt cần cả mật khẩu lẫn mã xác thực (hoặc mã khôi phục).
export default function MfaSettings({ required = false }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(null); // null | "setup" | "codes" | "disable"
  const [setup, setSetup] = useState(null); // { qr, secret }
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const close = () => {
    setStep(null);
    setSetup(null);
    setRecoveryCodes([]);
    setCode("");
    setPassword("");
  };

  const run = async (action, fallbackMessage) => {
    setLoading(true);
    try {
      await action();
    } catch (err) {
      toast.error(err.response?.data?.message || fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const res = await authAPI.mfaSetup();
      setSetup(res.data.data);
      setCode("");
      setStep("setup");
    }, "Chưa bắt đầu cài đặt được, vui lòng thử lại");

  const confirmSetup = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await authAPI.mfaEnable(code);
      updateUser(res.data.data.user);
      setRecoveryCodes(res.data.data.recoveryCodes);
      setSetup(null);
      setCode("");
      setStep("codes");
      toast.success(res.data.message);
    }, "Mã không đúng, vui lòng thử lại");
  };

  const disable = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await authAPI.mfaDisable({ password, code });
      updateUser(res.data.data.user);
      close();
      toast.success(res.data.message);
    }, "Chưa tắt được đăng nhập 2 bước");
  };

  const downloadCodes = () => {
    const text = `Mã khôi phục SimpleChat (${user.email})\nMỗi mã chỉ dùng được một lần.\n\n${recoveryCodes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "simplechat-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const enabled = Boolean(user?.mfa_enabled);

  return (
    <section className="panel" id="mfa">
      <div className="panel-head">
        <h3 className="panel-title">Đăng nhập 2 bước</h3>
        {!step && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={enabled ? () => setStep("disable") : startSetup}
            disabled={loading}
          >
            {enabled ? "Tắt" : "Bật"}
          </button>
        )}
      </div>

      {required && !enabled && (
        <p className="mfa-note" role="alert">
          Quản trị viên phải bật đăng nhập 2 bước trước khi vào trang quản trị.
        </p>
      )}

      <dl className="info-list">
        <div className="info-row">
          <dt>Trạng thái</dt>
          <dd>{enabled ? "Đang bật (ứng dụng xác thực)" : "Đang tắt"}</dd>
        </div>
      </dl>

      {step === "setup" && setup && (
        <form onSubmit={confirmSetup} className="stack-form">
          <ol className="mfa-steps">
            <li>Mở ứng dụng xác thực (Google Authenticator, Authy, Microsoft Authenticator…) và quét mã QR.</li>
            <li>Nhập mã 6 số mà ứng dụng hiển thị.</li>
          </ol>
          <img className="mfa-qr" src={setup.qr} alt="Mã QR để thêm SimpleChat vào ứng dụng xác thực" width="200" height="200" />
          <p className="mfa-secret">
            Không quét được? Nhập khóa này vào ứng dụng: <code>{setup.secret}</code>
          </p>
          <div className="form-group">
            <label htmlFor="mfa-setup-code">Mã xác thực</label>
            <input
              id="mfa-setup-code"
              className="otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
              minLength={6}
              maxLength={6}
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={close} className="btn btn-ghost">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || code.length !== 6}>
              {loading ? "Đang bật..." : "Bật đăng nhập 2 bước"}
            </button>
          </div>
        </form>
      )}

      {step === "codes" && (
        <div className="stack-form">
          <p className="mfa-note">
            Lưu các mã khôi phục này ở nơi an toàn. Khi mất điện thoại, mỗi mã dùng được một lần để đăng nhập.
            Mã chỉ hiện <strong>một lần duy nhất</strong>.
          </p>
          <ul className="recovery-codes">
            {recoveryCodes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button type="button" onClick={downloadCodes} className="btn btn-ghost">
              Tải về
            </button>
            <button type="button" onClick={close} className="btn btn-primary">
              Tôi đã lưu
            </button>
          </div>
        </div>
      )}

      {step === "disable" && (
        <form onSubmit={disable} className="stack-form">
          <div className="form-group">
            <label htmlFor="mfa-disable-password">Mật khẩu hiện tại</label>
            <input
              id="mfa-disable-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="mfa-disable-code">Mã xác thực hoặc mã khôi phục</label>
            <input
              id="mfa-disable-code"
              type="text"
              autoComplete="one-time-code"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, 11))}
              placeholder="000000"
              required
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={close} className="btn btn-ghost">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Đang tắt..." : "Tắt đăng nhập 2 bước"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
