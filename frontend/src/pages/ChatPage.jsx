import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { conversationsAPI } from "../api/conversations";
import { usersAPI } from "../api/users";
import { messagesAPI } from "../api/messages";
import UserAvatar from "../components/UserAvatar";
import TypingIndicator from "../components/TypingIndicator";

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { socket, onlineUsers, joinConversation, leaveConversation, sendMessage, startTyping, stopTyping, markRead } = useSocket();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await conversationsAPI.getAll();
      setConversations(res.data.data || []);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(async (conversationId) => {
    setLoadingMessages(true);
    try {
      const res = await messagesAPI.getByConversation(conversationId);
      const data = res.data.data || [];
      setMessages(data.reverse());
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeConversation) {
      joinConversation(activeConversation.conversation_id);
      fetchMessages(activeConversation.conversation_id);

      return () => {
        leaveConversation(activeConversation.conversation_id);
      };
    }
  }, [activeConversation, joinConversation, leaveConversation, fetchMessages]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (message.conversation_id === activeConversation?.conversation_id) {
        setMessages((prev) => [...prev, message]);
        setTimeout(scrollToBottom, 100);
        markRead(activeConversation.conversation_id);
      }
      fetchConversations();
    };

    const handleUserTyping = ({ user_id, conversation_id }) => {
      if (conversation_id === activeConversation?.conversation_id && user_id !== user.user_id) {
        setTypingUsers((prev) => ({ ...prev, [user_id]: true }));
      }
    };

    const handleUserStopTyping = ({ user_id, conversation_id }) => {
      if (conversation_id === activeConversation?.conversation_id) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[user_id];
          return next;
        });
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);
    };
  }, [socket, activeConversation, user, markRead, fetchConversations]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    sendMessage({
      conversation_id: activeConversation.conversation_id,
      content: newMessage.trim(),
      type: "text",
    });

    setNewMessage("");

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

  const handleSearchUsers = async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await usersAPI.search(query);
      setSearchResults((res.data.data || []).filter((u) => u.user_id !== user.user_id));
    } catch (err) {
      console.error("Error searching users:", err);
    }
  };

  const handleStartConversation = async (otherUser) => {
    try {
      const res = await conversationsAPI.create({
        type: "direct",
        member_ids: [otherUser.user_id],
      });
      await fetchConversations();
      const convId = res.data.data.conversation_id;
      const newConv = {
        conversation_id: convId,
        type: "direct",
        conversation_name: otherUser.username,
        other_user: otherUser,
      };
      setActiveConversation(newConv);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      if (err.response?.status === 409) {
        alert("Đã tồn tại cuộc trò chuyện với người này");
      } else {
        console.error("Error creating conversation:", err);
      }
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) return;

    try {
      await conversationsAPI.create({
        type: "group",
        conversation_name: groupName.trim(),
        member_ids: selectedMembers.map((m) => m.user_id),
      });
      await fetchConversations();
      setShowNewGroup(false);
      setGroupName("");
      setSelectedMembers([]);
    } catch (err) {
      console.error("Error creating group:", err);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await usersAPI.getAll();
      setAllUsers((res.data.data || []).filter((u) => u.user_id !== user.user_id));
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const getConversationName = (conv) => {
    if (conv.type === "group") return conv.conversation_name || "Nhóm";
    if (conv.other_user) return conv.other_user.username;
    return `Conversation #${conv.conversation_id}`;
  };

  const getOtherUser = (conv) => {
    if (conv.other_user) return conv.other_user;
    return null;
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="chat-page">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-user">
            <UserAvatar user={user} size={36} showStatus isOnline />
            <span className="sidebar-username">{user?.username}</span>
          </div>
          <div className="sidebar-actions">
            <button onClick={() => { setShowSearch(!showSearch); setShowNewGroup(false); }} className="icon-btn" title="Tìm người dùng">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </button>
            <button onClick={() => { setShowNewGroup(!showNewGroup); setShowSearch(false); loadAllUsers(); }} className="icon-btn" title="Tạo nhóm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </button>
            <button onClick={() => navigate("/contacts")} className="icon-btn" title="Danh bạ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </button>
            <button onClick={() => navigate("/profile")} className="icon-btn" title="Hồ sơ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button onClick={handleLogout} className="icon-btn logout-btn" title="Đăng xuất">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search users panel */}
        {showSearch && (
          <div className="search-panel">
            <div className="search-panel-header">
              <h3>Tìm người dùng</h3>
              <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }} className="close-btn">&times;</button>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchUsers(e.target.value)}
              placeholder="Nhập username hoặc email..."
              className="search-panel-input"
              autoFocus
            />
            <div className="search-results">
              {searchResults.map((u) => (
                <div key={u.user_id} className="search-result-item" onClick={() => handleStartConversation(u)}>
                  <UserAvatar user={u} size={36} showStatus isOnline={onlineUsers.includes(u.user_id)} />
                  <div className="search-result-info">
                    <span className="search-result-name">{u.username}</span>
                    <span className="search-result-email">{u.email}</span>
                  </div>
                </div>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="no-results">Không tìm thấy người dùng</p>
              )}
            </div>
          </div>
        )}

        {/* Create group panel */}
        {showNewGroup && (
          <div className="search-panel">
            <div className="search-panel-header">
              <h3>Tạo nhóm mới</h3>
              <button onClick={() => { setShowNewGroup(false); setGroupName(""); setSelectedMembers([]); }} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Tên nhóm..."
                className="search-panel-input"
                required
              />
              <div className="member-select">
                {allUsers.map((u) => (
                  <label key={u.user_id} className="member-option">
                    <input
                      type="checkbox"
                      checked={selectedMembers.some((m) => m.user_id === u.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembers([...selectedMembers, u]);
                        } else {
                          setSelectedMembers(selectedMembers.filter((m) => m.user_id !== u.user_id));
                        }
                      }}
                    />
                    <UserAvatar user={u} size={28} />
                    <span>{u.username}</span>
                  </label>
                ))}
              </div>
              <button type="submit" className="auth-btn" disabled={!groupName.trim() || selectedMembers.length === 0}>
                Tạo nhóm ({selectedMembers.length} thành viên)
              </button>
            </form>
          </div>
        )}

        {/* Conversation list */}
        <div className="conversation-list">
          {loadingConversations ? (
            <div className="loading">Đang tải...</div>
          ) : conversations.length === 0 ? (
            <div className="empty-state">
              <p>Chưa có cuộc trò chuyện nào</p>
              <button onClick={() => setShowSearch(true)} className="link-btn">Bắt đầu chat</button>
            </div>
          ) : (
            conversations.map((conv) => {
              const otherUser = getOtherUser(conv);
              return (
                <div
                  key={conv.conversation_id}
                  className={`conversation-item ${activeConversation?.conversation_id === conv.conversation_id ? "active" : ""}`}
                  onClick={() => setActiveConversation(conv)}
                >
                  <UserAvatar
                    user={otherUser || conv}
                    size={44}
                    showStatus={conv.type === "direct"}
                    isOnline={otherUser ? onlineUsers.includes(otherUser.user_id) : false}
                  />
                  <div className="conversation-info">
                    <span className="conversation-name">{getConversationName(conv)}</span>
                    <span className="conversation-preview">Nhấn để xem tin nhắn</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-main">
        {activeConversation ? (
          <>
            <div className="chat-header">
              <UserAvatar
                user={getOtherUser(activeConversation) || activeConversation}
                size={40}
                showStatus={activeConversation.type === "direct"}
                isOnline={getOtherUser(activeConversation) ? onlineUsers.includes(getOtherUser(activeConversation).user_id) : false}
              />
              <div className="chat-header-info">
                <h3>{getConversationName(activeConversation)}</h3>
                {activeConversation.type === "direct" && (
                  <span className={`header-status ${onlineUsers.includes(getOtherUser(activeConversation)?.user_id) ? "online" : ""}`}>
                    {onlineUsers.includes(getOtherUser(activeConversation)?.user_id) ? "Đang online" : "Offline"}
                  </span>
                )}
              </div>
            </div>

            <div className="chat-messages">
              {loadingMessages ? (
                <div className="loading">Đang tải tin nhắn...</div>
              ) : messages.length === 0 ? (
                <div className="empty-state">
                  <p>Chưa có tin nhắn nào</p>
                  <p className="hint">Gửi tin nhắn đầu tiên!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user.user_id;
                  const showAvatar = idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id;
                  return (
                    <div key={msg.message_id || idx} className={`message ${isOwn ? "own" : "other"}`}>
                      {!isOwn && showAvatar && (
                        <UserAvatar user={{ username: msg.sender_name }} size={32} />
                      )}
                      {!isOwn && !showAvatar && <div style={{ width: 32 }} />}
                      <div className="message-bubble">
                        {!isOwn && showAvatar && <span className="message-sender">{msg.sender_name}</span>}
                        <p className="message-content">{msg.is_deleted ? "Tin nhắn đã bị xóa" : msg.content}</p>
                        <span className="message-time">
                          {new Date(msg.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              {Object.keys(typingUsers).length > 0 && (
                <TypingIndicator username="Ai đó" />
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="Nhập tin nhắn..."
                autoComplete="off"
              />
              <button type="submit" disabled={!newMessage.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="chat-empty">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h2>Chào mừng đến SimpleChat</h2>
            <p>Chọn một cuộc trò chuyện hoặc bắt đầu chat mới</p>
          </div>
        )}
      </div>
    </div>
  );
}
