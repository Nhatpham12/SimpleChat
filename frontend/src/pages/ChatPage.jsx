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
import ChatInfoPanel from "../components/ChatInfoPanel";
import {
  linkify,
  formatFileSize,
  fileExt,
  imageUrl,
  isImage,
  isVideo,
  messagePreview,
} from "../utils/messageContent";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const FILE_ACCEPT = "image/*,video/mp4,video/quicktime,video/webm,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

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
  admin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
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
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
    </svg>
  ),
  attach: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
    </svg>
  ),
  recall: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
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

  // Sidebar thông tin bên phải (tìm tin nhắn, ảnh/tài liệu/link, rời nhóm, xóa lịch sử)
  const [showInfo, setShowInfo] = useState(() => window.innerWidth >= 1200);
  const [focusSearchSignal, setFocusSearchSignal] = useState(0);
  const [infoRefreshKey, setInfoRefreshKey] = useState(0);
  const [highlightId, setHighlightId] = useState(null);
  // true khi đang xem tin nhắn cũ (nhảy tới kết quả tìm kiếm) thay vì tin mới nhất
  const [viewingOld, setViewingOld] = useState(false);
  // Tin mới nhất từng thành viên khác đã xem: { [user_id]: { username, avatar_url, last_seen_id } }
  const [seenBy, setSeenBy] = useState({});
  const [uploading, setUploading] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const conversationsRef = useRef([]);
  const userSearchSeqRef = useRef(0);
  const composerRef = useRef(null);
  const seenByRef = useRef({});
  // Nhóm mình đang tự rời (để không hiện thêm pop-up "không còn trong nhóm")
  const leavingRef = useRef(null);

  useEffect(() => {
    seenByRef.current = seenBy;
  }, [seenBy]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Ảnh tải xong làm khung cao lên: nếu người dùng đang ở cuối thì giữ ở cuối
  const messagesBoxRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const handleMessagesScroll = () => {
    const el = messagesBoxRef.current;
    if (el) stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  };
  const scrollToBottomIfNear = () => {
    const el = messagesBoxRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
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

  // Lấy trạng thái "đã xem" của các thành viên khác
  const fetchSeen = useCallback(async (conversationId) => {
    try {
      const res = await messagesAPI.getSeen(conversationId);
      const map = {};
      (res.data.data || []).forEach((s) => {
        map[s.user_id] = s;
      });
      setSeenBy(map);
    } catch (err) {
      console.error("Error fetching seen:", err);
    }
  }, []);

  // Cập nhật mốc "đã xem" của 1 người (chỉ tiến lên, không lùi)
  const bumpSeen = (userId, messageId, profile) => {
    setSeenBy((prev) => {
      const cur = prev[userId];
      if (cur && cur.last_seen_id >= messageId) return prev;
      return { ...prev, [userId]: { ...(cur || { user_id: userId, ...profile }), last_seen_id: messageId } };
    });
  };

  // Server đã tự join socket vào mọi conversation của user; join ở đây chỉ để chắc chắn.
  // Không leave khi chuyển cuộc trò chuyện, nếu không sẽ mất tin nhắn realtime của cuộc đó.
  useEffect(() => {
    if (!activeConversationId) return;
    joinConversation(activeConversationId);
    setSeenBy({});
    fetchMessages(activeConversationId);
    fetchSeen(activeConversationId);
    markRead(activeConversationId);
    setConversations((prev) =>
      prev.map((c) => (sameId(c.conversation_id, activeConversationId) ? { ...c, unread_count: 0 } : c))
    );
    setTypingUsers({});
    setUploading(null);
    setTimeout(() => composerRef.current?.focus(), 0);
  }, [activeConversationId, joinConversation, fetchMessages, fetchSeen, markRead]);

  // Tin đến khi tab đang ẩn chưa tính là "đã xem"; quay lại tab mới đánh dấu đã đọc
  useEffect(() => {
    if (!activeConversationId) return;
    const handleVisible = () => {
      if (document.hidden) return;
      markRead(activeConversationId);
      setConversations((prev) =>
        prev.map((c) => (sameId(c.conversation_id, activeConversationId) ? { ...c, unread_count: 0 } : c))
      );
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [activeConversationId, markRead]);

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
      const isSystem = message.type === "system";
      const isVisible = !document.hidden;

      if (isActive) {
        // Đang xem tin cũ thì không chèn vào cuối (sẽ bị đứt đoạn); bấm "Về tin nhắn mới nhất" để xem
        if (!viewingOld) {
          setMessages((prev) => (prev.some((m) => sameId(m.message_id, message.message_id)) ? prev : [...prev, message]));
          setTimeout(scrollToBottom, 60);
        }
        // Người vừa gửi tin chắc chắn đã xem tới tin đó
        if (!isOwn && !isSystem) {
          bumpSeen(message.sender_id, message.message_id, { username: message.sender_name, avatar_url: message.sender_avatar });
        }
        if (isVisible) markRead(activeConversation.conversation_id);
        // Có file / link mới, hoặc thành viên nhóm thay đổi → tải lại sidebar thông tin
        if (message.file_url || isSystem || /https?:\/\/|www\./i.test(message.content || "")) {
          setInfoRefreshKey((k) => k + 1);
        }
      }

      const conv = conversationsRef.current.find((c) => sameId(c.conversation_id, message.conversation_id));

      // Pop-up khi tin đến ở cuộc trò chuyện khác, hoặc khi đang ở tab khác
      if (!isOwn && !isSystem && (!isActive || !isVisible)) {
        const isGroup = conv?.type === "group";
        const text = messagePreview(message);
        toast.show({
          type: "message",
          key: `conv-${message.conversation_id}`,
          user: isGroup ? getAvatarSubject(conv) : { username: message.sender_name, avatar_url: message.sender_avatar },
          title: isGroup ? getConversationName(conv) : message.sender_name,
          message: isGroup ? `${message.sender_name}: ${text}` : text,
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
      const countsUnread = !isOwn && !isSystem && (!isActive || !isVisible);
      setConversations((prev) => {
        const idx = prev.findIndex((c) => sameId(c.conversation_id, message.conversation_id));
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          unread_count: countsUnread ? (prev[idx].unread_count || 0) + 1 : isActive ? 0 : prev[idx].unread_count,
          last_message: {
            message_id: message.message_id,
            content: message.content,
            type: message.type,
            sender_id: message.sender_id,
            sender_name: message.sender_name,
            created_at: message.created_at,
            is_deleted: false,
          },
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
    };

    // Thành viên khác vừa đọc tới message_id
    const handleMessagesSeen = ({ conversation_id, user_id, message_id }) => {
      if (!sameId(conversation_id, activeConversation?.conversation_id) || sameId(user_id, user.user_id)) return;
      if (!seenByRef.current[user_id]) {
        fetchSeen(conversation_id);
        return;
      }
      bumpSeen(user_id, message_id);
    };

    // Tin bị thu hồi (bởi người gửi, có thể ở tab/thiết bị khác)
    const handleMessageDeleted = ({ conversation_id, message_id }) => {
      setMessages((prev) =>
        prev.map((m) =>
          sameId(m.message_id, message_id) ? { ...m, is_deleted: true, content: "", file_url: null, file_name: null, file_type: null } : m
        )
      );
      setConversations((prev) =>
        prev.map((c) =>
          sameId(c.conversation_id, conversation_id) && sameId(c.last_message?.message_id, message_id)
            ? { ...c, last_message: { ...c.last_message, is_deleted: true, content: "" } }
            : c
        )
      );
      if (sameId(conversation_id, activeConversation?.conversation_id)) setInfoRefreshKey((k) => k + 1);
    };

    // Mình rời nhóm (từ tab khác) hoặc bị quản trị viên mời ra
    const handleConversationRemoved = ({ conversation_id }) => {
      const conv = conversationsRef.current.find((c) => sameId(c.conversation_id, conversation_id));
      setConversations((prev) => prev.filter((c) => !sameId(c.conversation_id, conversation_id)));
      if (sameId(conversation_id, activeConversation?.conversation_id)) {
        setActiveConversation(null);
        setMessages([]);
      }
      if (conv && !sameId(leavingRef.current, conversation_id)) {
        toast.info(`Bạn không còn ở trong nhóm "${getConversationName(conv)}"`);
      }
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
    socket.on("messages_seen", handleMessagesSeen);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("conversation_removed", handleConversationRemoved);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);
    socket.on("conversation_created", handleConversationCreated);
    socket.on("error", handleSocketError);

    return () => {
      socket.off("conversation_created", handleConversationCreated);
      socket.off("new_message", handleNewMessage);
      socket.off("messages_seen", handleMessagesSeen);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("conversation_removed", handleConversationRemoved);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);
      socket.off("error", handleSocketError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, activeConversation, viewingOld, user, markRead, fetchConversations, fetchSeen, toast]);

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

  const handleJumpToMessage = (messageId) => {
    fetchMessages(activeConversation.conversation_id, messageId);
    // Màn hình hẹp: sidebar thông tin che khung chat → đóng lại để thấy tin nhắn
    if (window.innerWidth < 1200) setShowInfo(false);
  };

  const handleBackToLatest = () => {
    fetchMessages(activeConversation.conversation_id);
  };

  const openSearch = () => {
    setShowInfo(true);
    setFocusSearchSignal((n) => n + 1);
  };

  // Gửi ảnh / tệp: upload qua REST, tin nhắn về lại qua socket "new_message" như tin thường
  const handleSendFile = async (file) => {
    if (!file || !activeConversation) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`"${file.name}" lớn hơn 25 MB, chưa gửi được`);
      return;
    }
    const conversationId = activeConversation.conversation_id;
    if (viewingOld) await fetchMessages(conversationId);
    setUploading({ name: file.name, progress: 0 });
    try {
      await messagesAPI.sendFile(conversationId, file, (progress) =>
        setUploading((u) => (u ? { ...u, progress } : u))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || `Chưa gửi được "${file.name}"`);
    } finally {
      setUploading(null);
    }
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    handleSendFile(file);
  };

  // Dán ảnh từ clipboard vào ô soạn tin
  const handlePaste = (e) => {
    const file = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      handleSendFile(file);
    }
  };

  const handleRecall = async (msg) => {
    const ok = await toast.confirm({
      title: "Thu hồi tin nhắn này?",
      message: "Mọi người trong cuộc trò chuyện sẽ thấy tin nhắn đã được thu hồi.",
      confirmLabel: "Thu hồi",
      danger: true,
    });
    if (!ok) return;
    try {
      await messagesAPI.delete(msg.message_id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa thu hồi được tin nhắn");
    }
  };

  const handleClearHistory = async () => {
    const conv = activeConversation;
    const ok = await toast.confirm({
      title: "Xóa lịch sử trò chuyện?",
      message: `Toàn bộ tin nhắn hiện có với ${getConversationName(conv)} sẽ bị xóa ở phía bạn. Người khác vẫn xem được.`,
      confirmLabel: "Xóa lịch sử",
      danger: true,
    });
    if (!ok) return;
    try {
      await messagesAPI.clearHistory(conv.conversation_id);
      setMessages([]);
      setViewingOld(false);
      setHighlightId(null);
      setConversations((prev) =>
        prev.map((c) => (sameId(c.conversation_id, conv.conversation_id) ? { ...c, last_message: null, unread_count: 0 } : c))
      );
      setInfoRefreshKey((k) => k + 1);
      toast.success("Đã xóa lịch sử trò chuyện");
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa xóa được lịch sử trò chuyện");
    }
  };

  const handleLeaveGroup = async () => {
    const conv = activeConversation;
    const ok = await toast.confirm({
      title: `Rời khỏi nhóm "${getConversationName(conv)}"?`,
      message: "Bạn sẽ không nhận được tin nhắn của nhóm nữa. Muốn quay lại cần được thêm vào lần nữa.",
      confirmLabel: "Rời nhóm",
      danger: true,
    });
    if (!ok) return;
    leavingRef.current = conv.conversation_id;
    try {
      await conversationsAPI.leave(conv.conversation_id, user.user_id);
      setConversations((prev) => prev.filter((c) => !sameId(c.conversation_id, conv.conversation_id)));
      setActiveConversation(null);
      setMessages([]);
      toast.success(`Bạn đã rời khỏi nhóm "${getConversationName(conv)}"`);
    } catch (err) {
      leavingRef.current = null;
      toast.error(err.response?.data?.message || "Chưa rời được nhóm");
    }
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
    const text = messagePreview(last);
    if (last.type === "system") return text;
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
  const activeSubtitle = !activeConversation
    ? ""
    : activeConversation.type === "direct"
      ? activeOnline ? "Đang hoạt động" : "Ngoại tuyến"
      : "Nhóm";

  // "Đã gửi" / "Đã xem" dưới tin của mình khi nó là tin mới nhất của cuộc trò chuyện
  const lastRealMessage = viewingOld ? null : [...messages].reverse().find((m) => m.type !== "system");
  const receipt =
    lastRealMessage?.message_id && sameId(lastRealMessage.sender_id, user.user_id)
      ? {
          messageId: lastRealMessage.message_id,
          viewers: Object.values(seenBy).filter((s) => s.last_seen_id >= lastRealMessage.message_id),
        }
      : null;

  const renderReceipt = () => {
    const { viewers } = receipt;
    if (viewers.length === 0) return <span className="message-receipt">Đã gửi</span>;
    const names = viewers.map((v) => v.username).join(", ");
    if (activeConversation.type === "direct") {
      return (
        <span className="message-receipt seen" title={`${names} đã xem`}>
          <UserAvatar user={viewers[0]} size={14} />
          Đã xem
        </span>
      );
    }
    return (
      <span className="message-receipt seen" title={`Đã xem: ${names}`}>
        <span className="receipt-avatars">
          {viewers.slice(0, 5).map((v) => <UserAvatar key={v.user_id} user={v} size={16} />)}
        </span>
        {viewers.length > 5 ? `+${viewers.length - 5}` : ""} Đã xem
      </span>
    );
  };

  // Nội dung trong bong bóng theo loại tin: ảnh, video, tệp, văn bản (link bấm được)
  const renderMessageBody = (msg) => {
    if (msg.is_deleted) return <p className="message-content deleted">Tin nhắn đã được thu hồi</p>;
    if (msg.file_url && isImage(msg)) {
      return (
        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="message-image">
          <img src={imageUrl(msg.file_url)} alt={msg.file_name || "Ảnh"} loading="lazy" onLoad={() => !viewingOld && scrollToBottomIfNear()} />
        </a>
      );
    }
    if (msg.file_url && isVideo(msg)) {
      return <video className="message-video" src={msg.file_url} controls preload="metadata" />;
    }
    if (msg.file_url) {
      return (
        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="message-file">
          <span className="file-ext">{fileExt(msg.file_name || msg.content)}</span>
          <span className="message-file-text">
            <span className="message-file-name">{msg.file_name || msg.content}</span>
            <span className="message-file-size">{formatFileSize(msg.file_size) || "Tệp đính kèm"}</span>
          </span>
          <span className="message-file-dl">{Icon.download}</span>
        </a>
      );
    }
    return <p className="message-content">{linkify(msg.content)}</p>;
  };

  return (
    <div className={`chat-page ${activeConversation ? "chat-open" : ""} ${activeConversation && showInfo ? "info-open" : ""}`}>
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
            {user?.role === "admin" && (
              <button onClick={() => navigate("/admin")} className="icon-btn" title="Quản trị" aria-label="Quản trị">
                {Icon.admin}
              </button>
            )}
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
              <div className="chat-header-actions">
                <button
                  onClick={openSearch}
                  className="icon-btn"
                  title="Tìm tin nhắn"
                  aria-label="Tìm tin nhắn"
                >
                  {Icon.search}
                </button>
                <button
                  onClick={() => setShowInfo((v) => !v)}
                  className={`icon-btn ${showInfo ? "active" : ""}`}
                  title="Thông tin cuộc trò chuyện"
                  aria-label="Thông tin cuộc trò chuyện"
                  aria-expanded={showInfo}
                >
                  {Icon.info}
                </button>
              </div>
            </header>

            {viewingOld && !loadingMessages && (
              <div className="viewing-old-banner">
                <span>Bạn đang xem tin nhắn cũ</span>
                <button className="btn btn-primary btn-sm" onClick={handleBackToLatest}>Về tin mới nhất</button>
              </div>
            )}

            <div className="chat-messages" ref={messagesBoxRef} onScroll={handleMessagesScroll}>
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
                  const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                  const dayDivider = newDay && (
                    <div className="day-divider"><span>{formatDayLabel(msg.created_at)}</span></div>
                  );

                  if (msg.type === "system") {
                    return (
                      <div key={msg.message_id || idx} className="message-block">
                        {dayDivider}
                        <p className="message-system">{msg.content}</p>
                      </div>
                    );
                  }

                  const isOwn = sameId(msg.sender_id, user.user_id);
                  // Tin hệ thống chen giữa cũng ngắt chuỗi tin liên tiếp
                  const prevSender = prev && prev.type !== "system" ? prev.sender_id : null;
                  const nextSender = next && next.type !== "system" ? next.sender_id : null;
                  const firstOfRun = newDay || !sameId(prevSender, msg.sender_id);
                  const lastOfRun =
                    !sameId(nextSender, msg.sender_id) ||
                    new Date(next.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                  const isMedia = !msg.is_deleted && msg.file_url && (isImage(msg) || isVideo(msg));
                  const isFile = !msg.is_deleted && msg.file_url && !isMedia;
                  const showReceipt = receipt && sameId(receipt.messageId, msg.message_id);
                  return (
                    <div key={msg.message_id || idx} className="message-block">
                      {dayDivider}
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
                          <div className="message-row">
                            {isOwn && !msg.is_deleted && msg.message_id && (
                              <button
                                className="message-action"
                                onClick={() => handleRecall(msg)}
                                title="Thu hồi tin nhắn"
                                aria-label="Thu hồi tin nhắn"
                              >
                                {Icon.recall}
                              </button>
                            )}
                            <div
                              className={`message-bubble ${isMedia ? "media" : ""} ${isFile ? "file" : ""}`}
                              title={new Date(msg.created_at).toLocaleString("vi-VN")}
                            >
                              {renderMessageBody(msg)}
                            </div>
                          </div>
                          {(lastOfRun || showReceipt) && (
                            <span className="message-meta">
                              {lastOfRun && <span className="message-time">{formatTime(msg.created_at)}</span>}
                              {showReceipt && renderReceipt()}
                            </span>
                          )}
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

            {uploading && (
              <div className="upload-progress" role="status">
                <span className="upload-name">Đang gửi “{uploading.name}”</span>
                <span className="upload-bar"><span style={{ width: `${uploading.progress}%` }} /></span>
                <span className="upload-pct">{uploading.progress}%</span>
              </div>
            )}

            <form className="chat-input" onSubmit={handleSendMessage}>
              <input ref={fileInputRef} type="file" accept={FILE_ACCEPT} onChange={handleFilePicked} hidden />
              <button
                type="button"
                className="composer-attach"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!uploading}
                title="Gửi ảnh, video hoặc tài liệu"
                aria-label="Gửi ảnh, video hoặc tài liệu"
              >
                {Icon.attach}
              </button>
              <input
                ref={composerRef}
                type="text"
                value={newMessage}
                onChange={handleTyping}
                onPaste={handlePaste}
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

      {activeConversation && showInfo && (
        <>
          <div className="chat-info-backdrop" onClick={() => setShowInfo(false)} aria-hidden="true" />
          <ChatInfoPanel
            conversation={activeConversation}
            title={getConversationName(activeConversation)}
            subtitle={activeSubtitle}
            avatarSubject={getAvatarSubject(activeConversation)}
            currentUserId={user.user_id}
            onlineUsers={onlineUsers}
            highlightId={highlightId}
            focusSearchSignal={focusSearchSignal}
            refreshKey={infoRefreshKey}
            onJumpToMessage={handleJumpToMessage}
            onClearHistory={handleClearHistory}
            onLeaveGroup={handleLeaveGroup}
            onClose={() => setShowInfo(false)}
          />
        </>
      )}
    </div>
  );
}
