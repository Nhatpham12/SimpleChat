export default function UserAvatar({ user, size = 40, showStatus = false, isOnline = false }) {
  const initials = user?.username
    ? user.username.charAt(0).toUpperCase()
    : "?";

  const colors = [
    "#4f46e5", "#7c3aed", "#db2777", "#dc2626",
    "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
    "#2563eb", "#9333ea", "#c026d3", "#e11d48",
  ];

  const colorIndex = user?.username
    ? user.username.charCodeAt(0) % colors.length
    : 0;

  return (
    <div className="user-avatar" style={{ width: size, height: size, position: "relative" }}>
      {user?.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.username}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: colors[colorIndex],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 600,
            fontSize: size * 0.4,
          }}
        >
          {initials}
        </div>
      )}
      {showStatus && (
        <span
          className={`status-dot ${isOnline ? "online" : "offline"}`}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: "50%",
            border: "2px solid white",
            backgroundColor: isOnline ? "#22c55e" : "#9ca3af",
          }}
        />
      )}
    </div>
  );
}
