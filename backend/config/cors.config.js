require("dotenv").config();

// Cho phép nhiều origin qua danh sách ngăn cách bởi dấu phẩy (dev + prod).
const corsConfig = {
  origin: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};

module.exports = corsConfig;
