const mysql = require("mysql2");
const config = require("../config");

const pool = mysql.createPool(config.database);

pool.on("connection", (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

pool.on("error", (err) => {
  console.log("DB Pool error: " + err);
});

module.exports = pool;
