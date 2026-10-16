import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getToken } from "../utils/session";

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within SocketProvider");
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const token = getToken();
    if (!token) return;

    // undefined → same origin (Vite proxy in dev, nginx in prod)
    const newSocket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
    });

    newSocket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    newSocket.on("user_online", ({ user_id }) => {
      setOnlineUsers((prev) => {
        if (!prev.includes(user_id)) return [...prev, user_id];
        return prev;
      });
    });

    newSocket.on("user_offline", ({ user_id }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== user_id));
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user]);

  // useCallback để các effect phụ thuộc không chạy lại mỗi khi onlineUsers đổi
  const joinConversation = useCallback((conversationId) => {
    socket?.emit("join_conversation", conversationId);
  }, [socket]);

  const leaveConversation = useCallback((conversationId) => {
    socket?.emit("leave_conversation", conversationId);
  }, [socket]);

  const sendMessage = useCallback((data) => {
    socket?.emit("send_message", data);
  }, [socket]);

  const startTyping = useCallback((conversationId) => {
    socket?.emit("typing_start", conversationId);
  }, [socket]);

  const stopTyping = useCallback((conversationId) => {
    socket?.emit("typing_stop", conversationId);
  }, [socket]);

  const markRead = useCallback((conversationId, messageId) => {
    socket?.emit("mark_read", {
      conversation_id: conversationId,
      message_id: messageId,
    });
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        joinConversation,
        leaveConversation,
        sendMessage,
        startTyping,
        stopTyping,
        markRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
