export default function TypingIndicator({ username }) {
  return (
    <div className="typing-indicator">
      <span className="typing-text">{username} đang nhập...</span>
      <div className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}
