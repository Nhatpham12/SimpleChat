require("dotenv").config();

const databaseConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "simplechat",
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  waitForConnections: true,
};

module.exports = databaseConfig;
