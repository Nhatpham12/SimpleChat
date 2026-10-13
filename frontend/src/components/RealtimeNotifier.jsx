import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { contactsAPI } from "../api/contacts";

// Pop-up cho các sự kiện realtime ở mọi trang đã đăng nhập:
// lời mời kết bạn, lời mời được chấp nhận, và tin nhắn mới khi không ở trang chat
// (trang chat tự hiển thị thông báo tin nhắn vì nó biết cuộc trò chuyện đang mở).
export default function RealtimeNotifier() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const onChatPage = location.pathname === "/chat";

  useEffect(() => {
    if (!socket) return;

    const handleRequest = ({ contact_id, from_user }) => {
      toast.show({
        type: "friend",
        key: `contact-${contact_id}`,
        user: from_user,
        title: from_user?.username || "Lời mời kết bạn",
        message: "muốn kết bạn với bạn",
        onClick: () => navigate("/contacts", { state: { tab: "incoming" } }),
        actions: [
          {
            label: "Chấp nhận",
            primary: true,
            onClick: async () => {
              try {
                await contactsAPI.accept(contact_id);
                toast.success(`Bạn và ${from_user?.username} đã là bạn bè`);
              } catch (err) {
                toast.error(err.response?.data?.message || "Không chấp nhận được lời mời");
              }
            },
          },
          { label: "Để sau", onClick: () => {} },
        ],
      });
    };

    const handleUpdated = ({ status, by_user }) => {
      // Chỉ báo cho người gửi lời mời khi phía bên kia chấp nhận
      if (status !== "accepted" || !by_user || by_user.user_id === user.user_id) return;
      toast.show({
        type: "friend",
        user: by_user,
        title: by_user.username,
        message: "đã chấp nhận lời mời kết bạn. Giờ hai bạn có thể nhắn tin.",
        onClick: () => navigate("/contacts"),
      });
    };

    const handleMessage = (message) => {
      if (onChatPage || message.sender_id === user.user_id) return;
      toast.show({
        type: "message",
        key: `conv-${message.conversation_id}`,
        user: { username: message.sender_name, avatar_url: message.sender_avatar },
        title: message.sender_name,
        message: message.content,
        onClick: () => navigate("/chat", { state: { conversationId: message.conversation_id } }),
      });
    };

    // Admin khóa / xóa tài khoản đang đăng nhập → đăng xuất ngay
    const handleLocked = async ({ message }) => {
      sessionStorage.setItem("flash", message || "Tài khoản của bạn đã bị khóa");
      await logout();
      navigate("/login", { replace: true });
    };

    socket.on("contact_request", handleRequest);
    socket.on("contact_updated", handleUpdated);
    socket.on("new_message", handleMessage);
    socket.on("account_locked", handleLocked);
    return () => {
      socket.off("contact_request", handleRequest);
      socket.off("contact_updated", handleUpdated);
      socket.off("new_message", handleMessage);
      socket.off("account_locked", handleLocked);
    };
  }, [socket, toast, navigate, user, onChatPage, logout]);

  return null;
}
