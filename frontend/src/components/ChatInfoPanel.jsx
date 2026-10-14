import { useEffect, useRef, useState } from "react";
import { messagesAPI } from "../api/messages";
import { conversationsAPI } from "../api/conversations";
import UserAvatar from "./UserAvatar";
import {
  extractLinks,
  linkHost,
  formatFileSize,
  fileExt,
  thumbUrl,
  isVideo,
} from "../utils/messageContent";

const sameId = (a, b) => a != null && b != null && Number(a) === Number(b);

// Bỏ dấu + chữ thường từng ký tự (giữ nguyên độ dài để map vị trí về chuỗi gốc)
// (emoji 2 đơn vị UTF-16 → 1 ký tự giữ chỗ để vị trí không lệch)
const foldChar = (ch) => {
  if (ch.length > 1) return "￿";
  const f = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  return f.length === 1 ? f : ch;
};

// Tô sáng phần khớp từ khóa, không phân biệt hoa thường và dấu (giống cách server tìm)
const highlightText = (text, keyword) => {
  if (!keyword) return text;
  const chars = Array.from(text);
  const folded = chars.map(foldChar).join("");
  const key = Array.from(keyword).map(foldChar).join("");
  if (folded.length !== chars.length || !key) return text;
  const parts = [];
  let start = 0;
  let idx = folded.indexOf(key);
  while (idx !== -1) {
    if (idx > start) parts.push(chars.slice(start, idx).join(""));
    parts.push(<mark key={idx}>{chars.slice(idx, idx + key.length).join("")}</mark>);
    start = idx + key.length;
    idx = folded.indexOf(key, start);
  }
  if (start < chars.length) parts.push(chars.slice(start).join(""));
  return parts;
};

const formatDateTime = (value) =>
  new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

const formatDate = (value) => new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const svg = (children, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const Icon = {
  close: svg(<path d="M6 6l12 12M18 6 6 18" />),
  search: svg(<><circle cx="11" cy="11" r="7.5" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>),
  trash: svg(<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>),
  leave: svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  play: svg(<polygon points="7 4 20 12 7 20 7 4" fill="currentColor" stroke="none" />, 22),
  jump: svg(<><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>, 16),
};

const TABS = [
  { key: "media", label: "Ảnh/Video", empty: "Chưa có ảnh hay video nào được gửi." },
  { key: "file", label: "Tài liệu", empty: "Chưa có tài liệu nào được gửi." },
  { key: "link", label: "Link", empty: "Chưa có link nào được gửi." },
];

// Sidebar bên phải: tìm tin nhắn cũ, kho ảnh/tài liệu/link, thành viên nhóm, rời nhóm / xóa lịch sử
export default function ChatInfoPanel({
  conversation,
  title,
  subtitle,
  avatarSubject,
  currentUserId,
  onlineUsers,
  highlightId,
  focusSearchSignal,
  refreshKey,
  onJumpToMessage,
  onClearHistory,
  onLeaveGroup,
  onClose,
}) {
  const conversationId = conversation.conversation_id;
  const isGroup = conversation.type === "group";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState("media");
  const [shared, setShared] = useState({});
  const [loadingShared, setLoadingShared] = useState(false);
  const [members, setMembers] = useState([]);
  const searchRef = useRef(null);

  // Đổi cuộc trò chuyện → xóa dữ liệu cũ
  useEffect(() => {
    setQuery("");
    setResults([]);
    setShared({});
    setMembers([]);
  }, [conversationId]);

  useEffect(() => {
    if (focusSearchSignal) searchRef.current?.focus();
  }, [focusSearchSignal]);

  useEffect(() => {
    if (!isGroup) return;
    let cancelled = false;
    conversationsAPI
      .getById(conversationId)
      .then((res) => !cancelled && setMembers(res.data.data?.members || []))
      .catch((err) => console.error("Error loading members:", err));
    return () => {
      cancelled = true;
    };
  }, [conversationId, isGroup, refreshKey]);

  // Tải kho ảnh / tài liệu / link của tab đang mở
  useEffect(() => {
    let cancelled = false;
    setLoadingShared(true);
    messagesAPI
      .getShared(conversationId, tab)
      .then((res) => !cancelled && setShared((prev) => ({ ...prev, [tab]: res.data.data || [] })))
      .catch((err) => console.error("Error loading shared:", err))
      .finally(() => !cancelled && setLoadingShared(false));
    return () => {
      cancelled = true;
    };
  }, [conversationId, tab, refreshKey]);

  // Tìm tin nhắn (debounce 300ms)
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await messagesAPI.search(conversationId, q);
        if (!cancelled) setResults(res.data.data || []);
      } catch (err) {
        console.error("Error searching messages:", err);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, conversationId]);

  const items = shared[tab];
  const links = tab === "link" && items ? items.flatMap((m) => extractLinks(m.content).map((url, i) => ({ url, msg: m, key: `${m.message_id}-${i}` }))) : [];
  const currentTab = TABS.find((t) => t.key === tab);
  const q = query.trim();

  return (
    <aside className="chat-info" aria-label="Thông tin cuộc trò chuyện">
      <div className="chat-info-header">
        <h3>Thông tin</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Đóng thông tin">{Icon.close}</button>
      </div>

      <div className="chat-info-scroll">
        <div className="chat-info-hero">
          <UserAvatar user={avatarSubject} size={72} />
          <h4>{title}</h4>
          <span>{subtitle}</span>
        </div>

        <div className="chat-info-search">
          <span className="chat-info-search-icon">{Icon.search}</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tin nhắn cũ..."
            aria-label="Tìm tin nhắn trong cuộc trò chuyện"
          />
        </div>

        {q ? (
          <div className="chat-info-results">
            {searching && results.length === 0 ? (
              <p className="sheet-hint">Đang tìm...</p>
            ) : results.length === 0 ? (
              <p className="sheet-hint">Không có tin nhắn nào chứa "{q}".</p>
            ) : (
              <>
                <p className="chat-info-count">{results.length >= 50 ? "50+ kết quả gần nhất" : `${results.length} kết quả`}</p>
                {results.map((r) => (
                  <button
                    key={r.message_id}
                    className={`message-search-item ${sameId(highlightId, r.message_id) ? "active" : ""}`}
                    onClick={() => onJumpToMessage(r.message_id)}
                  >
                    <UserAvatar user={{ username: r.sender_name, avatar_url: r.sender_avatar }} size={28} />
                    <span className="message-search-info">
                      <span className="message-search-meta">
                        <span>{sameId(r.sender_id, currentUserId) ? "Bạn" : r.sender_name}</span>
                        <span>{formatDateTime(r.created_at)}</span>
                      </span>
                      <span className="message-search-content">{highlightText(r.content, q)}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        ) : (
          <>
            {isGroup && members.length > 0 && (
              <details className="chat-info-section" open={members.length <= 6}>
                <summary>Thành viên · {members.length}</summary>
                <ul className="chat-info-members">
                  {members.map((m) => (
                    <li key={m.user_id}>
                      <UserAvatar user={m} size={32} showStatus isOnline={onlineUsers.includes(m.user_id)} />
                      <span className="person-name">{sameId(m.user_id, currentUserId) ? `${m.username} (bạn)` : m.username}</span>
                      {m.role === "admin" && <span className="relation-badge">Quản trị</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="chat-info-section">
              <div className="chat-info-tabs" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    className={`chat-info-tab ${tab === t.key ? "active" : ""}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {!items && loadingShared ? (
                <div className="app-loading inline"><div className="spinner" aria-label="Đang tải" /></div>
              ) : tab === "media" ? (
                items?.length ? (
                  <div className="media-grid">
                    {items.map((m) => (
                      <a key={m.message_id} href={m.file_url} target="_blank" rel="noopener noreferrer" className="media-thumb" title={`${m.file_name || m.content} · ${formatDate(m.created_at)}`}>
                        <img src={thumbUrl(m)} alt={m.file_name || "Ảnh đã gửi"} loading="lazy" />
                        {isVideo(m) && <span className="media-play">{Icon.play}</span>}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="sheet-hint">{currentTab.empty}</p>
                )
              ) : tab === "file" ? (
                items?.length ? (
                  <ul className="shared-list">
                    {items.map((m) => (
                      <li key={m.message_id}>
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="shared-item">
                          <span className="file-ext">{fileExt(m.file_name || m.content)}</span>
                          <span className="shared-text">
                            <span className="shared-title">{m.file_name || m.content}</span>
                            <span className="shared-sub">
                              {[formatFileSize(m.file_size), formatDate(m.created_at), sameId(m.sender_id, currentUserId) ? "Bạn" : m.sender_name].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </a>
                        <button className="icon-btn" onClick={() => onJumpToMessage(m.message_id)} title="Xem trong cuộc trò chuyện" aria-label="Xem trong cuộc trò chuyện">{Icon.jump}</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sheet-hint">{currentTab.empty}</p>
                )
              ) : links.length ? (
                <ul className="shared-list">
                  {links.map(({ url, msg, key }) => (
                    <li key={key}>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="shared-item">
                        <span className="link-icon">{linkHost(url).charAt(0).toUpperCase()}</span>
                        <span className="shared-text">
                          <span className="shared-title">{linkHost(url)}</span>
                          <span className="shared-sub">{url}</span>
                        </span>
                      </a>
                      <button className="icon-btn" onClick={() => onJumpToMessage(msg.message_id)} title="Xem trong cuộc trò chuyện" aria-label="Xem trong cuộc trò chuyện">{Icon.jump}</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sheet-hint">{currentTab.empty}</p>
              )}
            </div>

            <div className="chat-info-actions">
              <button className="chat-info-action danger" onClick={onClearHistory}>
                {Icon.trash}
                <span>Xóa lịch sử trò chuyện</span>
              </button>
              {isGroup && (
                <button className="chat-info-action danger" onClick={onLeaveGroup}>
                  {Icon.leave}
                  <span>Rời khỏi nhóm</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
