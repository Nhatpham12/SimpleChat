const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const pool = require("./common/connect");
const adminSeeder = require("./seeders/adminSeeder");
const users = require("./models/users.model");
const { verifyToken } = require("./middlewares/auth.middleware");
const { globalErrorHandler } = require("./middlewares/errorHandler.middleware");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// Public routes
app.get("/api/test-db", (req, res) => {
  const sqlString = `SELECT * FROM users`;
  pool.query(sqlString, (err, results) => {
    if (err) {
      console.error("DB connection failed:", err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    res.json({
      status: "ok",
      message: "Database connected successfully",
      result: results[0],
    });
  });
});

// Routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const conversationRoutes = require("./routes/conversations.routes");
const messageRoutes = require("./routes/messages.routes");
const contactRoutes = require("./routes/contacts.routes");
const notificationRoutes = require("./routes/notifications.routes");
const groupSettingsRoutes = require("./routes/groupSettings.routes");
const blockedUsersRoutes = require("./routes/blockedUsers.routes");
const attachmentRoutes = require("./routes/attachments.routes");

app.use("/api/auth", authRoutes);
app.use("/api/users", verifyToken, userRoutes);
app.use("/api/conversations", verifyToken, conversationRoutes);
app.use("/api/messages", verifyToken, messageRoutes);
app.use("/api/contacts", verifyToken, contactRoutes);
app.use("/api/notifications", verifyToken, notificationRoutes);
app.use("/api/group-settings", verifyToken, groupSettingsRoutes);
app.use("/api/blocked", verifyToken, blockedUsersRoutes);
app.use("/api/attachments", verifyToken, attachmentRoutes);

// Global error handler
app.use(globalErrorHandler);

// ==================== SOCKET.IO ====================

// Store online users: { userId: Set<socketId> }
const onlineUsers = new Map();

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user.user_id;
  console.log(`User connected: ${userId} (socket: ${socket.id})`);

  // Add user to online list
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // Update user status to online
  users.updateStatus(userId, "online", () => {});

  // Broadcast online status to all contacts
  socket.broadcast.emit("user_online", { user_id: userId });

  // Send online users list to the connected user
  const onlineUserIds = [...onlineUsers.keys()];
  socket.emit("online_users", onlineUserIds);

  // Join a conversation room
  socket.on("join_conversation", (conversationId) => {
    socket.join(`conversation:${conversationId}`);
    console.log(`User ${userId} joined conversation ${conversationId}`);
  });

  // Leave a conversation room
  socket.on("leave_conversation", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(`User ${userId} left conversation ${conversationId}`);
  });

  // Handle new message
  socket.on("send_message", (data) => {
    const { conversation_id, content, type } = data;

    if (!conversation_id || !content) {
      return socket.emit("error", { message: "conversation_id và content là bắt buộc" });
    }

    const messages = require("./models/messages.model");
    const participants = require("./models/participants.model");
    const messageStatus = require("./models/messageStatus.model");
    const db = require("./common/connect");

    // Verify user is a member
    participants.getOne(conversation_id, userId, (err, participant) => {
      if (err || !participant) {
        return socket.emit("error", { message: "Bạn không phải thành viên cuộc trò chuyện này" });
      }

      messages.insert({ conversation_id, sender_id: userId, content, type: type || "text" }, (err, messageId) => {
        if (err) {
          return socket.emit("error", { message: "Lỗi khi gửi tin nhắn" });
        }

        // Get sender info
        users.getById(userId, (err, sender) => {
          const messageData = {
            message_id: messageId,
            conversation_id,
            sender_id: userId,
            sender_name: sender ? sender.username : "Unknown",
            content,
            type: type || "text",
            created_at: new Date().toISOString(),
          };

          // Broadcast to all members in the conversation room
          io.to(`conversation:${conversation_id}`).emit("new_message", messageData);

          // Create message status for other members
          const getMembersSql = `SELECT user_id FROM Participants WHERE conversation_id = ? AND user_id != ?`;
          db.query(getMembersSql, [conversation_id, userId], (err, members) => {
            if (!err && members) {
              members.forEach((member) => {
                messageStatus.insert({ message_id: messageId, receiver_id: member.user_id, status: "sent" }, () => {});

                // Send notification to offline users
                if (!onlineUsers.has(member.user_id)) {
                  const notifications = require("./models/notifications.model");
                  notifications.insert({
                    user_id: member.user_id,
                    type: "message",
                    content: `${sender ? sender.username : "Unknown"}: ${content.substring(0, 100)}`,
                    reference_id: conversation_id,
                  }, () => {});
                }
              });
            }
          });
        });
      });
    });
  });

  // Handle typing indicator
  socket.on("typing_start", (conversationId) => {
    socket.to(`conversation:${conversationId}`).emit("user_typing", {
      user_id: userId,
      conversation_id: conversationId,
    });
  });

  socket.on("typing_stop", (conversationId) => {
    socket.to(`conversation:${conversationId}`).emit("user_stop_typing", {
      user_id: userId,
      conversation_id: conversationId,
    });
  });

  // Handle mark message as read
  socket.on("mark_read", (data) => {
    const { conversation_id, message_id } = data;
    const messageStatus = require("./models/messageStatus.model");

    if (message_id) {
      messageStatus.markAsRead(message_id, userId, () => {});
    } else if (conversation_id) {
      messageStatus.markAllAsRead(conversation_id, userId, () => {});
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId} (socket: ${socket.id})`);

    // Remove socket from online users
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        // Update status to offline only when all sockets are disconnected
        users.updateStatus(userId, "offline", () => {});
        socket.broadcast.emit("user_offline", { user_id: userId });
      }
    }
  });
});

// ==================== START SERVER ====================

adminSeeder()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO ready`);
    });
  })
  .catch((err) => {
    console.error("Failed to seed admin:", err.message);
    process.exit(1);
  });
