import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

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

    const token = sessionStorage.getItem("token");
    if (!token) return;

    const socketUrl = import.meta.env.PROD ? "http://localhost:5001" : "http://localhost:5001";
    const newSocket = io(socketUrl, {
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

  const joinConversation = (conversationId) => {
    socket?.emit("join_conversation", conversationId);
  };

  const leaveConversation = (conversationId) => {
    socket?.emit("leave_conversation", conversationId);
  };

  const sendMessage = (data) => {
    socket?.emit("send_message", data);
  };

  const startTyping = (conversationId) => {
    socket?.emit("typing_start", conversationId);
  };

  const stopTyping = (conversationId) => {
    socket?.emit("typing_stop", conversationId);
  };

  const markRead = (conversationId, messageId) => {
    socket?.emit("mark_read", { conversation_id: conversationId, message_id: messageId });
  };

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
