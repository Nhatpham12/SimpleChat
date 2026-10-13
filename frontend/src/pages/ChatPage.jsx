import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { conversationsAPI } from "../api/conversations";
import { usersAPI } from "../api/users";
import { messagesAPI } from "../api/messages";
import { contactsAPI } from "../api/contacts";
import UserAvatar from "../components/UserAvatar";
import TypingIndicator from "../components/TypingIndicator";
import Logo from "../components/Logo";

const sameId = (a, b) => a != null && b != null && Number(a) === Number(b);

// Giờ nếu là hôm nay, ngày/tháng nếu cũ hơn
const formatListTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

// Nhãn ngày chia nhóm tin nhắn
const formatDayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hôm nay";
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" });
};

const formatTime = (value) =>
  new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

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

const Icon = {
  addUser: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  group: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  contacts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M8.5 14c.6-1.4 2-2 3.5-2s2.9.6 3.5 2" />
    </svg>
  ),
  logout: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7.5" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  ),
  back: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  send: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  ),
};

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { socket, onlineUsers, joinConversation, sendMessage, startTyping, stopTyping, markRead } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [conversationFilter, setConversationFilter] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  // Bảng phụ trong sidebar: null | "people" (tìm & kết bạn) | "group" (tạo nhóm)
  const [panel, setPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [friendsForGroup, setFriendsForGroup] = useState([]);

  // Tìm tin nhắn trong cuộc trò chuyện đang mở
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [messageResults, setMessageResults] = useState([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  // true khi đang xem tin nhắn cũ (nhảy tới kết quả tìm kiếm) thay vì tin mới nhất
  const [viewingOld, setViewingOld] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const conversationsRef = useRef([]);
  const userSearchSeqRef = useRef(0);
  const composerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await conversationsAPI.getAll();
      const list = res.data.data || [];
      setConversations(list);
      return list;
    } catch (err) {
      console.error("Error fetching conversations:", err);
      return [];
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await contactsAPI.getPending();
      setPendingCount(res.data.data?.incoming?.length || 0);
    } catch (err) {
      console.error("Error fetching pending:", err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchPendingCount();
  }, [fetchConversations, fetchPendingCount]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Số tin chưa đọc hiện trên tiêu đề tab trình duyệt
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) SimpleChat` : "SimpleChat";
    return () => {
      document.title = "SimpleChat";
    };
  }, [totalUnread]);

  // aroundId: nhảy tới 1 tin nhắn cũ (kết quả tìm kiếm); không có thì tải tin mới nhất
  const fetchMessages = useCallback(async (conversationId, aroundId) => {
    setLoadingMessages(true);
    try {
      const res = aroundId
        ? await messagesAPI.getAround(conversationId, aroundId)
        : await messagesAPI.getByConversation(conversationId);
      const data = res.data.data || [];
      setMessages(data.reverse());
      setViewingOld(!!aroundId);
      setHighlightId(aroundId || null);
      setTimeout(() => {
        const target = aroundId && document.getElementById(`msg-${aroundId}`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
        else messagesEndRef.current?.scrollIntoView();
      }, 60);
    } catch (err) {
      console.error("Error fetching messages:", err);
      toast.error("Chưa tải được tin nhắn. Thử mở lại cuộc trò chuyện.");
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

  const activeConversationId = activeConversation?.conversation_id;

  // Server đã tự join socket vào mọi conversation của user; join ở đây chỉ để chắc chắn.
  // Không leave khi chuyển cuộc trò chuyện, nếu không sẽ mất tin nhắn realtime của cuộc đó.
  useEffect(() => {
    if (!activeConversationId) return;
    joinConversation(activeConversationId);
    fetchMessages(activeConversationId);
    markRead(activeConversationId);
    setConversations((prev) =>
      prev.map((c) => (sameId(c.conversation_id, activeConversationId) ? { ...c, unread_count: 0 } : c))
    );
    setShowMessageSearch(false);
    setMessageQuery("");
    setMessageResults([]);
    setTypingUsers({});
    setTimeout(() => composerRef.current?.focus(), 0);
  }, [activeConversationId, joinConversation, fetchMessages, markRead]);

  // Tìm tin nhắn (debounce 300ms)
  useEffect(() => {
    const q = messageQuery.trim();
    if (!showMessageSearch || !activeConversationId || q.length === 0) {
      setMessageResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchingMessages(true);
      try {
        const res = await messagesAPI.search(activeConversationId, q);
        if (!cancelled) setMessageResults(res.data.data || []);
      } catch (err) {
        console.error("Error searching messages:", err);
      } finally {
        if (!cancelled) setSearchingMessages(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [messageQuery, showMessageSearch, activeConversationId]);

  const getConversationName = (conv) => {
    if (conv.type === "group") return conv.conversation_name || "Nhóm chưa đặt tên";
    if (conv.other_user) return conv.other_user.username;
    return `Cuộc trò chuyện #${conv.conversation_id}`;
  };

  const getOtherUser = (conv) => conv.other_user || null;

  // Đối tượng truyền cho UserAvatar: người còn lại (direct) hoặc tên/ảnh nhóm (group)
  const getAvatarSubject = (conv) =>
    getOtherUser(conv) || { username: getConversationName(conv), avatar_url: conv.avatar_url };

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      const isActive = sameId(message.conversation_id, activeConversation?.conversation_id);
      const isOwn = sameId(message.sender_id, user.user_id);

      if (isActive) {
        // Đang xem tin cũ thì không chèn vào cuối (sẽ bị đứt đoạn); bấm "Về tin nhắn mới nhất" để xem
        if (!viewingOld) {
          setMessages((prev) => [...prev, message]);
          setTimeout(scrollToBottom, 60);
        }
        markRead(activeConversation.conversation_id);
      }

      const conv = conversationsRef.current.find((c) => sameId(c.conversation_id, message.conversation_id));

      // Pop-up khi tin đến ở cuộc trò chuyện khác, hoặc khi đang ở tab khác
      if (!isOwn && (!isActive || document.hidden)) {
        const isGroup = conv?.type === "group";
        toast.show({
          type: "message",
          key: `conv-${message.conversation_id}`,
          user: isGroup ? getAvatarSubject(conv) : { username: message.sender_name, avatar_url: message.sender_avatar },
          title: isGroup ? getConversationName(conv) : message.sender_name,
          message: isGroup ? `${message.sender_name}: ${message.content}` : message.content,
          onClick: () => {
            if (conv) setActiveConversation(conv);
          },
        });
      }

      // Đưa cuộc trò chuyện có tin mới lên đầu sidebar + tăng số chưa đọc
      if (!conv) {
        fetchConversations();
        return;
      }
      setConversations((prev) => {
        const idx = prev.findIndex((c) => sameId(c.conversation_id, message.conversation_id));
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          unread_count: isActive || isOwn ? 0 : (prev[idx].unread_count || 0) + 1,
          last_message: {
            message_id: message.message_id,
            content: message.content,
            sender_id: message.sender_id,
            sender_name: message.sender_name,
            created_at: message.created_at,
            is_deleted: false,
          },
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
    };

    const handleSocketError = (err) => {
      if (err?.message) toast.error(err.message);
    };

    const handleUserTyping = ({ user_id, username, conversation_id }) => {
      if (sameId(conversation_id, activeConversation?.conversation_id) && user_id !== user.user_id) {
        setTypingUsers((prev) => ({ ...prev, [user_id]: username || "Ai đó" }));
      }
    };

    const handleUserStopTyping = ({ user_id, conversation_id }) => {
      if (sameId(conversation_id, activeConversation?.conversation_id)) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[user_id];
          return next;
        });
      }
    };

    // Được thêm vào nhóm / cuộc trò chuyện mới → tải lại sidebar
    const handleConversationCreated = () => {
      fetchConversations();
    };

    socket.on("new_message", handleNewMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);
    socket.on("conversation_created", handleConversationCreated);
    socket.on("error", handleSocketError);

    return () => {
      socket.off("conversation_created", handleConversationCreated);
      socket.off("new_message", handleNewMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);
      socket.off("error", handleSocketError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, activeConversation, viewingOld, user, markRead, fetchConversations, toast]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    const content = newMessage.trim();
    setNewMessage("");

    // Đang xem tin cũ → quay về tin mới nhất trước khi gửi
    if (viewingOld) {
      await fetchMessages(activeConversation.conversation_id);
    }

    sendMessage({
      conversation_id: activeConversation.conversation_id,
      content,
      type: "text",
    });

    if (isTypingRef.current) {
      stopTyping(activeConversation.conversation_id);
      isTypingRef.current = false;
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!activeConversation) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      startTyping(activeConversation.conversation_id);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConversation.conversation_id);
      isTypingRef.current = false;
    }, 2000);
  };

  const handleSearchUsers = useCallback(async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    // Bỏ kết quả của request cũ về sau request mới
    const seq = ++userSearchSeqRef.current;
    try {
      const res = await usersAPI.search(query.trim());
      if (seq === userSearchSeqRef.current) {
        setSearchResults((res.data.data || []).filter((u) => u.user_id !== user.user_id));
      }
    } catch (err) {
      console.error("Error searching users:", err);
    }
  }, [user]);

  // Lời mời được gửi / chấp nhận / hủy ở phía bên kia → cập nhật nút trong kết quả tìm kiếm và badge danh bạ
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      fetchPendingCount();
      if (panel === "people" && searchQuery.trim().length >= 2) handleSearchUsers(searchQuery);
    };
    socket.on("contact_request", refresh);
    socket.on("contact_updated", refresh);
    return () => {
      socket.off("contact_request", refresh);
      socket.off("contact_updated", refresh);
    };
  }, [socket, panel, searchQuery, handleSearchUsers, fetchPendingCount]);

  const updateSearchResult = (userId, changes) => {
    setSearchResults((prev) => prev.map((u) => (u.user_id === userId ? { ...u, ...changes } : u)));
  };

  const handleSendFriendRequest = async (target) => {
    try {
      const res = await contactsAPI.sendRequest(target.user_id);
      updateSearchResult(target.user_id, { relation: "outgoing", contact_id: res.data.data?.contact_id });
      toast.success(`Đã gửi lời mời tới ${target.username}. Hai bạn nhắn tin được khi lời mời được chấp nhận.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa gửi được lời mời kết bạn");
      handleSearchUsers(searchQuery);
    }
  };

  const handleAcceptFromSearch = async (target) => {
    try {
      await contactsAPI.accept(target.contact_id);
      updateSearchResult(target.user_id, { relation: "friends" });
      fetchPendingCount();
      toast.success(`Bạn và ${target.username} đã là bạn bè`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không chấp nhận được lời mời");
      handleSearchUsers(searchQuery);
    }
  };

  const openConversationById = async (convId) => {
    const list = await fetchConversations();
    const conv = list.find((c) => sameId(c.conversation_id, convId));
    if (conv) setActiveConversation(conv);
  };

  const closePanel = () => {
    setPanel(null);
    setSearchQuery("");
    setSearchResults([]);
    setGroupName("");
    setSelectedMembers([]);
  };

  const handleStartConversation = async (otherUser) => {
    try {
      const res = await conversationsAPI.create({
        type: "direct",
        member_ids: [otherUser.user_id],
      });
      await openConversationById(res.data.data.conversation_id);
    } catch (err) {
      const existingId = err.response?.data?.data?.conversation_id;
      if (err.response?.status === 409 && existingId) {
        await openConversationById(existingId);
      } else {
        toast.error(err.response?.data?.message || "Không mở được cuộc trò chuyện");
        return;
      }
    }
    closePanel();
  };

  // Đến từ trang khác (Danh bạ, pop-up): mở sẵn cuộc trò chuyện / bảng tìm người dùng
  useEffect(() => {
    const state = location.state;
    if (!state) return;
    if (state.openUserSearch) setPanel("people");
    if (state.conversationId) openConversationById(state.conversationId);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleJumpToMessage = (result) => {
    fetchMessages(activeConversation.conversation_id, result.message_id);
  };

  const handleBackToLatest = () => {
    fetchMessages(activeConversation.conversation_id);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) return;

    try {
      const res = await conversationsAPI.create({
        type: "group",
        conversation_name: groupName.trim(),
        member_ids: selectedMembers.map((m) => m.user_id),
      });
      toast.success(`Đã tạo nhóm "${groupName.trim()}"`);
      closePanel();
      await openConversationById(res.data.data.conversation_id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa tạo được nhóm");
    }
  };

  // Chỉ bạn bè (đã chấp nhận lời mời) mới được thêm vào nhóm
  const openGroupPanel = async () => {
    setPanel(panel === "group" ? null : "group");
    try {
      const res = await contactsAPI.getAll();
      setFriendsForGroup(res.data.data || []);
    } catch (err) {
      console.error("Error loading friends:", err);
    }
  };

  const getPreview = (conv) => {
    const last = conv.last_message;
    if (!last) return conv.type === "group" ? "Nhóm mới tạo, gửi lời chào nhé" : "Chưa có tin nhắn";
    const text = last.is_deleted ? "Tin nhắn đã bị xóa" : last.content;
    if (sameId(last.sender_id, user.user_id)) return `Bạn: ${text}`;
    if (conv.type === "group" && last.sender_name) return `${last.sender_name}: ${text}`;
    return text;
  };

  const handleLogout = async () => {
    const ok = await toast.confirm({
      title: "Đăng xuất khỏi SimpleChat?",
      confirmLabel: "Đăng xuất",
      cancelLabel: "Ở lại",
    });
    if (!ok) return;
    await logout();
    navigate("/login");
  };

  const visibleConversations = useMemo(() => {
    const q = conversationFilter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => getConversationName(c).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, conversationFilter]);

  const typingNames = Object.values(typingUsers);
  const activeOther = activeConversation ? getOtherUser(activeConversation) : null;
  const activeOnline = activeOther ? onlineUsers.includes(activeOther.user_id) : false;

  return (
    <div className={`chat-page ${activeConversation ? "chat-open" : ""}`}>
      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <button className="sidebar-user" onClick={() => navigate("/profile")} title="Hồ sơ của bạn">
            <UserAvatar user={user} size={38} />
            <span className="sidebar-username">{user?.username}</span>
          </button>
          <div className="sidebar-actions">
            <button
              onClick={() => (panel === "people" ? closePanel() : setPanel("people"))}
              className={`icon-btn ${panel === "people" ? "active" : ""}`}
              title="Tìm và kết bạn"
              aria-label="Tìm và kết bạn"
            >
              {Icon.addUser}
            </button>
            <button
              onClick={openGroupPanel}
              className={`icon-btn ${panel === "group" ? "active" : ""}`}
              title="Tạo nhóm"
              aria-label="Tạo nhóm"
            >
              {Icon.group}
            </button>
            <button onClick={() => navigate("/contacts", { state: pendingCount ? { tab: "incoming" } : null })} className="icon-btn" title="Danh bạ" aria-label={`Danh bạ${pendingCount ? `, ${pendingCount} lời mời mới` : ""}`}>
              {Icon.contacts}
              {pendingCount > 0 && <span className="icon-badge">{pendingCount}</span>}
            </button>
            <button onClick={handleLogout} className="icon-btn" title="Đăng xuất" aria-label="Đăng xuất">
              {Icon.logout}
            </button>
          </div>
        </div>

        {panel === "people" && (
          <div className="sheet">
            <div className="sheet-header">
              <h3>Tìm và kết bạn</h3>
              <button onClick={closePanel} className="icon-btn" aria-label="Đóng">{Icon.close}</button>
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearchUsers(e.target.value)}
              placeholder="Username hoặc email..."
              className="input"
              autoFocus
            />
            <div className="sheet-list">
              {searchQuery.trim().length < 2 && (
                <p className="sheet-hint">Gõ ít nhất 2 ký tự. Bạn chỉ nhắn tin được với người đã chấp nhận lời mời kết bạn.</p>
              )}
              {searchResults.map((u) => (
                <div key={u.user_id} className="person-row">
                  <UserAvatar user={u} size={36} showStatus isOnline={onlineUsers.includes(u.user_id)} />
                  <div className="person-info">
                    <span className="person-name">{u.username}</span>
                    <span className="person-sub">{u.email}</span>
                  </div>
                  <div className="person-action">
                    {u.relation === "friends" && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleStartConversation(u)}>Nhắn tin</button>
                    )}
                    {u.relation === "none" && (
                      <button className="btn btn-outline btn-sm" onClick={() => handleSendFriendRequest(u)}>Kết bạn</button>
                    )}
                    {u.relation === "outgoing" && <span className="relation-badge">Chờ chấp nhận</span>}
                    {u.relation === "incoming" && (
                      <button className="btn btn-attention btn-sm" onClick={() => handleAcceptFromSearch(u)}>Chấp nhận</button>
                    )}
                  </div>
                </div>
              ))}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <p className="sheet-hint">Không tìm thấy ai khớp với "{searchQuery.trim()}".</p>
              )}
            </div>
          </div>
        )}

        {panel === "group" && (
          <form className="sheet" onSubmit={handleCreateGroup}>
            <div className="sheet-header">
              <h3>Tạo nhóm</h3>
              <button type="button" onClick={closePanel} className="icon-btn" aria-label="Đóng">{Icon.close}</button>
            </div>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Tên nhóm"
              className="input"
              maxLength={100}
              required
              autoFocus
            />
            <div className="sheet-list">
              {friendsForGroup.length === 0 && (
                <p className="sheet-hint">Bạn cần có bạn bè trước khi tạo nhóm.</p>
              )}
              {friendsForGroup.map((u) => {
                const checked = selectedMembers.some((m) => m.user_id === u.user_id);
                return (
                  <label key={u.user_id} className={`person-row selectable ${checked ? "selected" : ""}`}>
                    <UserAvatar user={u} size={32} />
                    <span className="person-name">{u.username}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedMembers(
                          e.target.checked
                            ? [...selectedMembers, u]
                            : selectedMembers.filter((m) => m.user_id !== u.user_id)
                        )
                      }
                    />
                  </label>
                );
              })}
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={!groupName.trim() || selectedMembers.length === 0}>
              {selectedMembers.length > 0 ? `Tạo nhóm với ${selectedMembers.length} người` : "Chọn thành viên"}
            </button>
          </form>
        )}

        <div className="sidebar-filter">
          <span className="sidebar-filter-icon">{Icon.search}</span>
          <input
            type="search"
            value={conversationFilter}
            onChange={(e) => setConversationFilter(e.target.value)}
            placeholder="Tìm cuộc trò chuyện"
            aria-label="Tìm cuộc trò chuyện"
          />
        </div>

        <nav className="conversation-list" aria-label="Cuộc trò chuyện">
          {loadingConversations ? (
            <div className="app-loading inline"><div className="spinner light" aria-label="Đang tải" /></div>
          ) : conversations.length === 0 ? (
            <div className="sidebar-empty">
              <p>Chưa có cuộc trò chuyện nào.</p>
              <button onClick={() => setPanel("people")} className="btn btn-attention btn-sm">Tìm bạn để bắt đầu</button>
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="sidebar-empty"><p>Không có cuộc trò chuyện nào tên "{conversationFilter.trim()}".</p></div>
          ) : (
            visibleConversations.map((conv) => {
              const otherUser = getOtherUser(conv);
              const unread = conv.unread_count || 0;
              const isActive = sameId(activeConversation?.conversation_id, conv.conversation_id);
              return (
                <button
                  key={conv.conversation_id}
                  className={`conversation-item ${isActive ? "active" : ""} ${unread > 0 ? "unread" : ""}`}
                  onClick={() => setActiveConversation(conv)}
                  aria-current={isActive ? "true" : undefined}
                >
                  <UserAvatar
                    user={getAvatarSubject(conv)}
                    size={46}
                    showStatus={conv.type === "direct"}
                    isOnline={otherUser ? onlineUsers.includes(otherUser.user_id) : false}
                  />
                  <span className="conversation-info">
                    <span className="conversation-top">
                      <span className="conversation-name">{getConversationName(conv)}</span>
                      <span className="conversation-time">{formatListTime(conv.last_message?.created_at)}</span>
                    </span>
                    <span className="conversation-bottom">
                      <span className="conversation-preview">{getPreview(conv)}</span>
                      {unread > 0 && <span className="unread-badge">{unread > 99 ? "99+" : unread}</span>}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </nav>
      </aside>

      {/* Chat area */}
      <main className="chat-main">
        {activeConversation ? (
          <>
            <header className="chat-header">
              <button className="icon-btn mobile-back" onClick={() => setActiveConversation(null)} aria-label="Quay lại danh sách">
                {Icon.back}
              </button>
              <UserAvatar
                user={getAvatarSubject(activeConversation)}
                size={42}
                showStatus={activeConversation.type === "direct"}
                isOnline={activeOnline}
              />
              <div className="chat-header-info">
                <h2>{getConversationName(activeConversation)}</h2>
                {activeConversation.type === "direct" ? (
                  <span className={`header-status ${activeOnline ? "online" : ""}`}>
                    {activeOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                  </span>
                ) : (
                  <span className="header-status">Nhóm</span>
                )}
              </div>
              <button
                onClick={() => { setShowMessageSearch(!showMessageSearch); setMessageQuery(""); }}
                className={`icon-btn header-search-btn ${showMessageSearch ? "active" : ""}`}
                title="Tìm tin nhắn"
                aria-label="Tìm tin nhắn"
                aria-expanded={showMessageSearch}
              >
                {Icon.search}
              </button>
            </header>

            {showMessageSearch && (
              <div className="message-search">
                <input
                  type="search"
                  value={messageQuery}
                  onChange={(e) => setMessageQuery(e.target.value)}
                  placeholder="Tìm trong cuộc trò chuyện này..."
                  className="input"
                  autoFocus
                />
                {messageQuery.trim() && (
                  <div className="message-search-results">
                    {searchingMessages && messageResults.length === 0 ? (
                      <p className="sheet-hint">Đang tìm...</p>
                    ) : messageResults.length === 0 ? (
                      <p className="sheet-hint">Không có tin nhắn nào chứa "{messageQuery.trim()}".</p>
                    ) : (
                      messageResults.map((r) => (
                        <button
                          key={r.message_id}
                          className={`message-search-item ${sameId(highlightId, r.message_id) ? "active" : ""}`}
                          onClick={() => handleJumpToMessage(r)}
                        >
                          <UserAvatar user={{ username: r.sender_name, avatar_url: r.sender_avatar }} size={28} />
                          <span className="message-search-info">
                            <span className="message-search-meta">
                              <span>{sameId(r.sender_id, user.user_id) ? "Bạn" : r.sender_name}</span>
                              <span>{new Date(r.created_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                            </span>
                            <span className="message-search-content">{highlightText(r.content, messageQuery.trim())}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {viewingOld && !loadingMessages && (
              <div className="viewing-old-banner">
                <span>Bạn đang xem tin nhắn cũ</span>
                <button className="btn btn-primary btn-sm" onClick={handleBackToLatest}>Về tin mới nhất</button>
              </div>
            )}

            <div className="chat-messages">
              {loadingMessages ? (
                <div className="app-loading inline"><div className="spinner" aria-label="Đang tải tin nhắn" /></div>
              ) : messages.length === 0 ? (
                <div className="chat-hello">
                  <UserAvatar user={getAvatarSubject(activeConversation)} size={72} />
                  <p>
                    {activeConversation.type === "group"
                      ? `Chưa ai nói gì trong ${getConversationName(activeConversation)}.`
                      : `Bắt đầu trò chuyện với ${getConversationName(activeConversation)}.`}
                  </p>
                  <span>Gửi một lời chào ở ô bên dưới.</span>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const prev = messages[idx - 1];
                  const next = messages[idx + 1];
                  const isOwn = msg.sender_id === user.user_id;
                  const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                  const firstOfRun = newDay || prev?.sender_id !== msg.sender_id;
                  const lastOfRun =
                    !next ||
                    next.sender_id !== msg.sender_id ||
                    new Date(next.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                  return (
                    <div key={msg.message_id || idx} className="message-block">
                      {newDay && (
                        <div className="day-divider"><span>{formatDayLabel(msg.created_at)}</span></div>
                      )}
                      <div
                        id={msg.message_id ? `msg-${msg.message_id}` : undefined}
                        className={`message ${isOwn ? "own" : "other"} ${firstOfRun ? "first" : ""} ${lastOfRun ? "last" : ""} ${sameId(highlightId, msg.message_id) ? "highlight" : ""}`}
                      >
                        {!isOwn && (
                          <div className="message-avatar">
                            {lastOfRun && <UserAvatar user={{ username: msg.sender_name, avatar_url: msg.sender_avatar }} size={30} />}
                          </div>
                        )}
                        <div className="message-stack">
                          {!isOwn && firstOfRun && activeConversation.type === "group" && (
                            <span className="message-sender">{msg.sender_name}</span>
                          )}
                          <div className="message-bubble" title={new Date(msg.created_at).toLocaleString("vi-VN")}>
                            <p className={`message-content ${msg.is_deleted ? "deleted" : ""}`}>
                              {msg.is_deleted ? "Tin nhắn đã bị xóa" : msg.content}
                            </p>
                          </div>
                          {lastOfRun && <span className="message-time">{formatTime(msg.created_at)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {typingNames.length > 0 && (
                <TypingIndicator username={typingNames.length > 1 ? `${typingNames.length} người` : typingNames[0]} />
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input" onSubmit={handleSendMessage}>
              <input
                ref={composerRef}
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder={`Nhắn cho ${getConversationName(activeConversation)}...`}
                autoComplete="off"
                aria-label="Nội dung tin nhắn"
              />
              <button type="submit" disabled={!newMessage.trim()} aria-label="Gửi">
                {Icon.send}
              </button>
            </form>
          </>
        ) : (
          <div className="chat-empty">
            <Logo size={56} />
            <h2>Chọn một cuộc trò chuyện</h2>
            <p>Tin nhắn mới sẽ hiện ở danh sách bên trái và bật thông báo ở góc màn hình.</p>
            <button className="btn btn-outline" onClick={() => setPanel("people")}>Tìm và kết bạn</button>
          </div>
        )}
      </main>
    </div>
  );
}
