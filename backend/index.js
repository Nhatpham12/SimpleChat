const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const pool = require("./common/connect");
const config = require("./config");
const migrate = require("./seeders/migrate");
const adminSeeder = require("./seeders/adminSeeder");
const { verifyToken, loadAccount } = require("./middlewares/auth.middleware");
const { apiLimiter } = require("./middlewares/rateLimit.middleware");
const { globalErrorHandler } = require("./middlewares/errorHandler.middleware");
const apiRouter = require("./routers");
const { setupSocket } = require("./socket");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: config.cors.methods,
  },
});

// Cho controllers truy cập io qua req.app.get("io")
app.set("io", io);

// Prod: trình duyệt → Caddy → nginx (frontend) → backend. Tin 2 lớp proxy này để
// req.ip là IP thật của người dùng (rate limit theo IP). Caddy bỏ X-Forwarded-For
// do client tự gửi nên không giả mạo được. Đổi TRUST_PROXY nếu thay đổi số lớp proxy.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 2));

app.use(cors());
app.use(express.json());
app.use("/api", apiLimiter);

// Public: kiểm tra server + DB còn sống (không trả dữ liệu nào từ DB)
app.get("/api/health", (req, res) => {
  pool.query("SELECT 1", (err) => {
    if (err) {
      console.error("DB connection failed:", err.message);
      return res.status(503).json({ status: "error", db: "down" });
    }
    res.json({ status: "ok", db: "up" });
  });
});

// Auth routes — PUBLIC (mounted trước verifyToken)
const authRoutes = require("./routers/auth.routes");
app.use("/api/auth", authRoutes);

// Protected API routes
app.use("/api", verifyToken, apiRouter);

// Global error handler
app.use(globalErrorHandler);

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    return next(new Error("Authentication error: Invalid token"));
  }

  // Tài khoản bị khóa / đã xóa không được kết nối realtime
  loadAccount(decoded.user_id, (err, account) => {
    if (err) return next(new Error("Authentication error"));
    if (!account || account.is_locked) return next(new Error("Authentication error: Account locked"));
    socket.user = { ...decoded, username: account.username, role: account.role };
    next();
  });
});

// Setup Socket.IO event handlers
setupSocket(io);

// Start server
migrate()
  .then(adminSeeder)
  .then(() => {
    server.listen(config.app.port, () => {
      console.log(`Server running on port ${config.app.port}`);
      console.log(`Socket.IO ready`);
    });
  })
  .catch((err) => {
    console.error("Failed to init database:", err.message);
    process.exit(1);
  });
