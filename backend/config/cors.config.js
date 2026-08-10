require("dotenv").config();

const corsConfig = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};

module.exports = corsConfig;
