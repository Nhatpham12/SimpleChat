const mysql = require("mysql2");
require("dotenv");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8m4",
  waitForConnections: true,
});

pool.on("connection", (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

pool.on("error", (err) => {
  console.log("DB Pool error: " + err);
});

module.exports = pool;
