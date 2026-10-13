// Màu nền chữ cái đầu: tông trầm hợp với nền xanh lá sen
const colors = ["#24655e", "#3e6fa8", "#7a4fa3", "#b0476e", "#b7652b", "#5b7f2c", "#2c7f8a", "#8a5a44"];

export default function UserAvatar({ user, size = 40, showStatus = false, isOnline = false }) {
  const name = user?.username || "";
  const initials = name ? name.trim().charAt(0).toUpperCase() : "?";
  const colorIndex = name ? [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % colors.length : 0;

  return (
    <div className="user-avatar" style={{ width: size, height: size }}>
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt="" />
      ) : (
        <div
          className="avatar-initials"
          style={{ backgroundColor: colors[colorIndex], fontSize: Math.round(size * 0.42) }}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}
      {showStatus && (
        <span className={`status-dot ${isOnline ? "online" : ""}`} aria-label={isOnline ? "Đang hoạt động" : "Ngoại tuyến"} />
      )}
    </div>
  );
}
