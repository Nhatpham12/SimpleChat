import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usersAPI } from "../api/users";
import { authAPI } from "../api/auth";
import UserAvatar from "../components/UserAvatar";
import PageHeader from "../components/PageHeader";

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
          <UserAvatar user={user} size={88} />
          <div>
            <h2>{user?.username}</h2>
            <p>{user?.email}</p>
            {user?.role === "admin" && <span className="role-badge">Quản trị viên</span>}
          </div>
        </section>

        <section className="panel">
          <h3 className="panel-title">Ảnh đại diện</h3>
          <form className="inline-form" onSubmit={handleUpdateAvatar}>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="Dán đường dẫn ảnh (https://...)"
              className="input"
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !avatarUrl.trim()}>
              Đổi ảnh
            </button>
          </form>
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
