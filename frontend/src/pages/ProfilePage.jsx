import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usersAPI } from "../api/users";
import { authAPI } from "../api/auth";
import UserAvatar from "../components/UserAvatar";

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await usersAPI.updateProfile(user.user_id, { username, email });
      updateUser({ ...user, username, email });
      setEditing(false);
      setSuccess("Cập nhật thành công");
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi cập nhật");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvatar = async () => {
    if (!avatarUrl.trim()) return;
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await usersAPI.updateAvatar(user.user_id, avatarUrl);
      updateUser({ ...user, avatar_url: avatarUrl });
      setSuccess("Cập nhật avatar thành công");
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi cập nhật avatar");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await authAPI.changePassword({ oldPassword, newPassword });
      setSuccess("Đổi mật khẩu thành công");
      setShowPasswordForm(false);
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi đổi mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Bạn có chắc muốn xóa tài khoản? Hành động này không thể hoàn tác.")) return;
    try {
      await usersAPI.deleteAccount?.(user.user_id);
      await logout();
      navigate("/login");
    } catch (err) {
      setError("Lỗi khi xóa tài khoản");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <button onClick={() => navigate("/chat")} className="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2>Hồ sơ</h2>
      </div>

      <div className="profile-content">
        <div className="profile-avatar-section">
          <UserAvatar user={user} size={100} showStatus isOnline />
          <div className="avatar-edit">
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="URL avatar mới"
              className="avatar-input"
            />
            <button onClick={handleUpdateAvatar} className="btn-small" disabled={loading || !avatarUrl.trim()}>
              Cập nhật avatar
            </button>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        {!editing ? (
          <div className="profile-info">
            <div className="info-row">
              <label>Username</label>
              <span>{user?.username}</span>
            </div>
            <div className="info-row">
              <label>Email</label>
              <span>{user?.email}</span>
            </div>
            <div className="info-row">
              <label>Vai trò</label>
              <span className={`role-badge ${user?.role}`}>{user?.role}</span>
            </div>
            <div className="info-row">
              <label>Trạng thái</label>
              <span className={`status-text ${user?.status}`}>{user?.status}</span>
            </div>
            <div className="profile-actions">
              <button onClick={() => { setEditing(true); setUsername(user?.username); setEmail(user?.email); }} className="auth-btn">
                Chỉnh sửa hồ sơ
              </button>
              <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="auth-btn secondary">
                Đổi mật khẩu
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="profile-actions">
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Đang lưu..." : "Lưu"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="auth-btn secondary">
                Hủy
              </button>
            </div>
          </form>
        )}

        {showPasswordForm && (
          <form onSubmit={handleChangePassword} className="profile-form">
            <h3>Đổi mật khẩu</h3>
            <div className="form-group">
              <label>Mật khẩu cũ</label>
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Mật khẩu mới</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="profile-actions">
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Đang lưu..." : "Đổi mật khẩu"}
              </button>
              <button type="button" onClick={() => setShowPasswordForm(false)} className="auth-btn secondary">
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
