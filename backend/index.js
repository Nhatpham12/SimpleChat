const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./common/connect");
const adminSeeder = require("./seeders/adminSeeder");
const { verifyToken } = require("./middlewares/auth.middleware");
const { globalErrorHandler } = require("./middlewares/errorHandler.middleware");
const {
  validateLogin,
  validateRegister,
  validateMessage,
} = require("./middlewares/validation.middlewares");

const app = express();
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

// Protected routes
// const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
// const conversationRoutes = require("./routes/conversations.routes");
// const messageRoutes = require("./routes/messages.routes");
// const contactRoutes = require("./routes/contacts.routes");
// const notificationRoutes = require("./routes/notifications.routes");

// app.use("/api/auth", authRoutes);
app.use("/api/users", verifyToken, userRoutes);
// app.use("/api/conversations", verifyToken, conversationRoutes);
// app.use("/api/messages", verifyToken, messageRoutes);
// app.use("/api/contacts", verifyToken, contactRoutes);
// app.use("/api/notifications", verifyToken, notificationRoutes);

adminSeeder()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to seed admin:", err.message);
    process.exit(1);
  });
