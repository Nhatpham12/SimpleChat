const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const pool = require("./common/connect");
const config = require("./config");
const adminSeeder = require("./seeders/adminSeeder");
const { verifyToken } = require("./middlewares/auth.middleware");
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

app.use(cors());
app.use(express.json());

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

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// Setup Socket.IO event handlers
setupSocket(io);

// Start server
adminSeeder()
  .then(() => {
    server.listen(config.app.port, () => {
      console.log(`Server running on port ${config.app.port}`);
      console.log(`Socket.IO ready`);
    });
  })
  .catch((err) => {
    console.error("Failed to seed admin:", err.message);
    process.exit(1);
  });
