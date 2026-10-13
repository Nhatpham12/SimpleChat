export default function PageHeader({ title, onBack, children }) {
  return (
    <header className="page-header">
      <button type="button" onClick={onBack} className="icon-btn" aria-label="Quay lại trò chuyện">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1>{title}</h1>
      {children}
    </header>
  );
}
