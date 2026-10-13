import Logo from "./Logo";

// Khung chung cho đăng nhập / đăng ký / xác nhận email / quên mật khẩu
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-logo">
          <Logo size={34} light />
          <span>SimpleChat</span>
        </div>
        <p className="auth-brand-line">Nhắn tin với bạn bè, gọn gàng và tức thì.</p>
        <div className="auth-brand-chat">
          <div className="demo-bubble other">Tối nay đi ăn bún chả không?</div>
          <div className="demo-bubble own">Ok, 7h ở chỗ cũ nhé</div>
          <div className="demo-bubble other">Để mình rủ thêm Lan 🙌</div>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-container">
          <div className="auth-mobile-logo">
            <Logo size={30} />
            <span>SimpleChat</span>
          </div>
          <header className="auth-header">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
