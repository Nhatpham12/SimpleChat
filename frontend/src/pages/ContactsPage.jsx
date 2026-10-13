import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { contactsAPI } from "../api/contacts";
import { conversationsAPI } from "../api/conversations";
import UserAvatar from "../components/UserAvatar";
import PageHeader from "../components/PageHeader";

export default function ContactsPage() {
  const { socket, onlineUsers } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState({ incoming: [], outgoing: [] });
  const [activeTab, setActiveTab] = useState(location.state?.tab || "friends");
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

  // Có lời mời mới / được chấp nhận / bị hủy → tải lại realtime
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      fetchFriends();
      fetchPending();
    };
    socket.on("contact_request", refresh);
    socket.on("contact_updated", refresh);
    return () => {
      socket.off("contact_request", refresh);
      socket.off("contact_updated", refresh);
    };
  }, [socket, fetchFriends, fetchPending]);

  const handleAccept = async (req) => {
    try {
      await contactsAPI.accept(req.contact_id);
      toast.success(`Bạn và ${req.user?.username} đã là bạn bè`);
      fetchFriends();
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không chấp nhận được lời mời");
    }
  };

  // Người nhận: từ chối. Người gửi: hủy lời mời (cùng endpoint)
  const handleReject = async (req, isCancel) => {
    if (isCancel) {
      const ok = await toast.confirm({
        title: "Hủy lời mời kết bạn?",
        message: `${req.user?.username} sẽ không còn thấy lời mời của bạn.`,
        confirmLabel: "Hủy lời mời",
        cancelLabel: "Giữ lại",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await contactsAPI.reject(req.contact_id);
      toast.info(isCancel ? "Đã hủy lời mời kết bạn" : `Đã từ chối lời mời của ${req.user?.username}`);
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không xử lý được lời mời");
    }
  };

  const handleRemoveFriend = async (friend) => {
    const ok = await toast.confirm({
      title: `Hủy kết bạn với ${friend.username}?`,
      message: "Hai bạn sẽ không nhắn tin riêng được nữa cho tới khi kết bạn lại.",
      confirmLabel: "Hủy kết bạn",
      cancelLabel: "Giữ lại",
      danger: true,
    });
    if (!ok) return;
    try {
      await contactsAPI.remove(friend.user_id);
      toast.info(`Đã hủy kết bạn với ${friend.username}`);
      fetchFriends();
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa hủy kết bạn được");
    }
  };

  // Mở (hoặc tạo) cuộc trò chuyện 1-1 rồi chuyển sang trang chat và mở luôn cuộc đó
  const handleChat = async (friend) => {
    try {
      const res = await conversationsAPI.create({
        type: "direct",
        member_ids: [friend.user_id],
      });
      navigate("/chat", { state: { conversationId: res.data.data.conversation_id } });
    } catch (err) {
      const existingId = err.response?.data?.data?.conversation_id;
      if (err.response?.status === 409 && existingId) {
        navigate("/chat", { state: { conversationId: existingId } });
      } else {
        toast.error(err.response?.data?.message || "Không mở được cuộc trò chuyện");
      }
    }
  };

  const tabs = [
    { id: "friends", label: "Bạn bè", count: friends.length },
    { id: "incoming", label: "Lời mời", count: pending.incoming.length, attention: pending.incoming.length > 0 },
    { id: "outgoing", label: "Đã gửi", count: pending.outgoing.length },
  ];

  const renderEmpty = (text, withAction) => (
    <div className="empty-state">
      <p>{text}</p>
      {withAction && (
        <button onClick={() => navigate("/chat", { state: { openUserSearch: true } })} className="btn btn-primary">
          Tìm bạn để kết bạn
        </button>
      )}
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="Danh bạ" onBack={() => navigate("/chat")}>
        <button
          className="btn btn-ghost btn-sm page-header-action"
          onClick={() => navigate("/chat", { state: { openUserSearch: true } })}
        >
          Thêm bạn
        </button>
      </PageHeader>

      <div className="page-body">
        <div className="tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className={`tab-count ${tab.attention ? "attention" : ""}`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="app-loading inline">
            <div className="spinner" aria-label="Đang tải" />
          </div>
        ) : (
          <div className="panel list-panel">
            {activeTab === "friends" &&
              (friends.length === 0
                ? renderEmpty("Bạn chưa có bạn bè nào. Tìm theo username hoặc email để gửi lời mời.", true)
                : friends.map((friend) => {
                    const online = onlineUsers.includes(friend.user_id);
                    return (
                      <div key={friend.user_id} className="contact-item">
                        <UserAvatar user={friend} size={44} showStatus isOnline={online} />
                        <div className="contact-info">
                          <span className="contact-name">{friend.username}</span>
                          <span className={`contact-status ${online ? "online" : ""}`}>{online ? "Đang hoạt động" : "Ngoại tuyến"}</span>
                        </div>
                        <div className="contact-actions">
                          <button onClick={() => handleChat(friend)} className="btn btn-primary btn-sm">
                            Nhắn tin
                          </button>
                          <button
                            onClick={() => handleRemoveFriend(friend)}
                            className="icon-btn danger"
                            title="Hủy kết bạn"
                            aria-label={`Hủy kết bạn với ${friend.username}`}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <line x1="17" y1="11" x2="23" y2="11" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  }))}

            {activeTab === "incoming" &&
              (pending.incoming.length === 0
                ? renderEmpty("Không có lời mời nào đang chờ bạn.")
                : pending.incoming.map((req) => (
                    <div key={req.contact_id} className="contact-item">
                      <UserAvatar user={req.user} size={44} />
                      <div className="contact-info">
                        <span className="contact-name">{req.user?.username}</span>
                        <span className="contact-status">Muốn kết bạn với bạn</span>
                      </div>
                      <div className="contact-actions">
                        <button onClick={() => handleReject(req, false)} className="btn btn-ghost btn-sm">
                          Từ chối
                        </button>
                        <button onClick={() => handleAccept(req)} className="btn btn-primary btn-sm">
                          Chấp nhận
                        </button>
                      </div>
                    </div>
                  )))}

            {activeTab === "outgoing" &&
              (pending.outgoing.length === 0
                ? renderEmpty("Bạn chưa gửi lời mời nào.", true)
                : pending.outgoing.map((req) => (
                    <div key={req.contact_id} className="contact-item">
                      <UserAvatar user={req.user} size={44} />
                      <div className="contact-info">
                        <span className="contact-name">{req.user?.username}</span>
                        <span className="contact-status">Đang chờ chấp nhận</span>
                      </div>
                      <div className="contact-actions">
                        <button onClick={() => handleReject(req, true)} className="btn btn-ghost btn-sm">
                          Hủy lời mời
                        </button>
                      </div>
                    </div>
                  )))}
          </div>
        )}
      </div>
    </div>
  );
}
