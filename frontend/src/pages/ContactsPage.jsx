import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { contactsAPI } from "../api/contacts";
import { conversationsAPI } from "../api/conversations";
import UserAvatar from "../components/UserAvatar";

export default function ContactsPage() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();

  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState({ incoming: [], outgoing: [] });
  const [activeTab, setActiveTab] = useState("friends");
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await contactsAPI.getAll();
      setFriends(res.data.data || []);
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const res = await contactsAPI.getPending();
      setPending(res.data.data || { incoming: [], outgoing: [] });
    } catch (err) {
      console.error("Error fetching pending:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchFriends(), fetchPending()]).finally(() => setLoading(false));
  }, [fetchFriends, fetchPending]);

  const handleAccept = async (contactId) => {
    try {
      await contactsAPI.accept(contactId);
      fetchFriends();
      fetchPending();
    } catch (err) {
      console.error("Error accepting:", err);
    }
  };

  const handleReject = async (contactId) => {
    try {
      await contactsAPI.reject(contactId);
      fetchPending();
    } catch (err) {
      console.error("Error rejecting:", err);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm("Hủy kết bạn với người này?")) return;
    try {
      await contactsAPI.remove(friendId);
      fetchFriends();
    } catch (err) {
      console.error("Error removing friend:", err);
    }
  };

  const handleChat = async (friend) => {
    try {
      const res = await conversationsAPI.create({
        type: "direct",
        member_ids: [friend.user_id],
      });
      navigate("/chat");
    } catch (err) {
      if (err.response?.status === 409) {
        navigate("/chat");
      }
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button onClick={() => navigate("/chat")} className="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2>Danh bạ</h2>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          Bạn bè ({friends.length})
        </button>
        <button
          className={`tab ${activeTab === "incoming" ? "active" : ""}`}
          onClick={() => setActiveTab("incoming")}
        >
          Yêu cầu ({pending.incoming.length})
        </button>
        <button
          className={`tab ${activeTab === "outgoing" ? "active" : ""}`}
          onClick={() => setActiveTab("outgoing")}
        >
          Đã gửi ({pending.outgoing.length})
        </button>
      </div>

      <div className="contacts-content">
        {activeTab === "friends" && (
          <>
            {friends.length === 0 ? (
              <div className="empty-state">
                <p>Chưa có bạn bè nào</p>
                <button onClick={() => navigate("/chat")} className="link-btn">Tìm kiếm người dùng</button>
              </div>
            ) : (
              <div className="contact-list">
                {friends.map((friend) => (
                  <div key={friend.user_id} className="contact-item">
                    <UserAvatar user={friend} size={44} showStatus isOnline={onlineUsers.includes(friend.user_id)} />
                    <div className="contact-info">
                      <span className="contact-name">{friend.username}</span>
                      <span className="contact-status">{onlineUsers.includes(friend.user_id) ? "Đang online" : "Offline"}</span>
                    </div>
                    <div className="contact-actions">
                      <button onClick={() => handleChat(friend)} className="icon-btn" title="Nhắn tin">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                      <button onClick={() => handleRemoveFriend(friend.user_id)} className="icon-btn danger" title="Hủy kết bạn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="17" y1="11" x2="23" y2="11" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "incoming" && (
          <>
            {pending.incoming.length === 0 ? (
              <div className="empty-state">
                <p>Không có yêu cầu kết bạn nào</p>
              </div>
            ) : (
              <div className="contact-list">
                {pending.incoming.map((req) => (
                  <div key={req.contact_id} className="contact-item">
                    <UserAvatar user={req.user} size={44} />
                    <div className="contact-info">
                      <span className="contact-name">{req.user?.username}</span>
                      <span className="contact-status">Muốn kết bạn với bạn</span>
                    </div>
                    <div className="contact-actions">
                      <button onClick={() => handleAccept(req.contact_id)} className="btn-accept">Chấp nhận</button>
                      <button onClick={() => handleReject(req.contact_id)} className="btn-reject">Từ chối</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "outgoing" && (
          <>
            {pending.outgoing.length === 0 ? (
              <div className="empty-state">
                <p>Chưa gửi yêu cầu kết bạn nào</p>
              </div>
            ) : (
              <div className="contact-list">
                {pending.outgoing.map((req) => (
                  <div key={req.contact_id} className="contact-item">
                    <UserAvatar user={{ user_id: req.friend_id }} size={44} />
                    <div className="contact-info">
                      <span className="contact-name">User #{req.friend_id}</span>
                      <span className="contact-status">Đang chờ xác nhận</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
