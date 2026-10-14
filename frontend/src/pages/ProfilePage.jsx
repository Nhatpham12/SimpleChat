import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usersAPI } from "../api/users";
import { authAPI } from "../api/auth";
import UserAvatar from "../components/UserAvatar";
import PageHeader from "../components/PageHeader";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const avatarInputRef = useRef(null);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersAPI.updateProfile(user.user_id, { username, email });
      updateUser({ ...user, username, email });
      setEditing(false);
      toast.success("Đã lưu thông tin hồ sơ");
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa lưu được hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvatar = async (e) => {
    e.preventDefault();
    if (!avatarUrl.trim()) return;
    setLoading(true);
    try {
      await usersAPI.updateAvatar(user.user_id, avatarUrl.trim());
      updateUser({ ...user, avatar_url: avatarUrl.trim() });
      toast.success("Đã đổi ảnh đại diện");
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa đổi được ảnh đại diện");
    } finally {
      setLoading(false);
    }
  };

  // Chọn ảnh từ máy → xem trước → tải lên (server cắt vuông 400px)
  const handlePickAvatar = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Chỉ hỗ trợ ảnh JPG, PNG, GIF hoặc WEBP");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Ảnh đại diện tối đa 5 MB");
      return;
    }
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ file, url: URL.createObjectURL(file) });
  };

  const cancelPreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleUploadAvatar = async () => {
    if (!preview) return;
    setUploadProgress(0);
    try {
      const res = await usersAPI.uploadAvatar(preview.file, setUploadProgress);
      const url = res.data.data.avatar_url;
      updateUser({ ...user, avatar_url: url });
      setAvatarUrl(url);
      cancelPreview();
      toast.success("Đã đổi ảnh đại diện");
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa tải được ảnh lên");
    } finally {
      setUploadProgress(null);
    }
  };

  useEffect(() => () => preview && URL.revokeObjectURL(preview.url), [preview]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Mật khẩu mới cần ít nhất 8 ký tự");
      return;
    }
    setLoading(true);
    try {
      await authAPI.changePassword({ oldPassword, newPassword });
      toast.success("Đã đổi mật khẩu");
      setShowPasswordForm(false);
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa đổi được mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="Hồ sơ" onBack={() => navigate("/chat")} />

      <div className="page-body">
        <section className="profile-hero">
          <button
            type="button"
            className="avatar-picker"
            onClick={() => avatarInputRef.current?.click()}
            title="Đổi ảnh đại diện"
            aria-label="Đổi ảnh đại diện"
          >
            <UserAvatar user={preview ? { ...user, avatar_url: preview.url } : user} size={88} />
            <span className="avatar-picker-badge" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
          </button>
          <div>
            <h2>{user?.username}</h2>
            <p>{user?.email}</p>
            {user?.role === "admin" && <span className="role-badge">Quản trị viên</span>}
          </div>
        </section>

        <section className="panel">
          <h3 className="panel-title">Ảnh đại diện</h3>
          <input ref={avatarInputRef} type="file" accept={AVATAR_TYPES.join(",")} onChange={handlePickAvatar} hidden />

          {preview ? (
            <div className="avatar-upload">
              <UserAvatar user={{ ...user, avatar_url: preview.url }} size={64} />
              <div className="avatar-upload-info">
                <span className="avatar-upload-name">{preview.file.name}</span>
                {uploadProgress !== null ? (
                  <span className="upload-bar"><span style={{ width: `${uploadProgress}%` }} /></span>
                ) : (
                  <span className="avatar-upload-hint">Ảnh sẽ được cắt vuông, ưu tiên khuôn mặt.</span>
                )}
              </div>
              <div className="avatar-upload-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancelPreview} disabled={uploadProgress !== null}>
                  Hủy
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleUploadAvatar} disabled={uploadProgress !== null}>
                  {uploadProgress !== null ? `Đang tải ${uploadProgress}%` : "Lưu ảnh"}
                </button>
              </div>
            </div>
          ) : (
            <div className="avatar-upload">
              <p className="avatar-upload-hint">JPG, PNG, GIF hoặc WEBP, tối đa 5 MB.</p>
              <button type="button" className="btn btn-primary" onClick={() => avatarInputRef.current?.click()}>
                Tải ảnh từ máy
              </button>
            </div>
          )}

          <details className="avatar-url-option">
            <summary>Hoặc dùng đường dẫn ảnh</summary>
            <form className="inline-form" onSubmit={handleUpdateAvatar}>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Dán đường dẫn ảnh (https://...)"
                className="input"
              />
              <button type="submit" className="btn btn-outline" disabled={loading || !avatarUrl.trim()}>
                Đổi ảnh
              </button>
            </form>
          </details>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Thông tin tài khoản</h3>
            {!editing && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setEditing(true);
                  setUsername(user?.username);
                  setEmail(user?.email);
                }}
              >
                Sửa
              </button>
            )}
          </div>

          {!editing ? (
            <dl className="info-list">
              <div className="info-row">
                <dt>Username</dt>
                <dd>{user?.username}</dd>
              </div>
              <div className="info-row">
                <dt>Email</dt>
                <dd>{user?.email}</dd>
              </div>
            </dl>
          ) : (
            <form onSubmit={handleUpdateProfile} className="stack-form">
              <div className="form-group">
                <label htmlFor="pf-username">Username</label>
                <input id="pf-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
              </div>
              <div className="form-group">
                <label htmlFor="pf-email">Email</label>
                <input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Mật khẩu</h3>
            {!showPasswordForm && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPasswordForm(true)}>
                Đổi mật khẩu
              </button>
            )}
          </div>

          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="stack-form">
              <div className="form-group">
                <label htmlFor="pf-old">Mật khẩu hiện tại</label>
                <input id="pf-old" type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="pf-new">Mật khẩu mới</label>
                <input id="pf-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" required minLength={8} />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowPasswordForm(false)} className="btn btn-ghost">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Đang lưu..." : "Đổi mật khẩu"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
