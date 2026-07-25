const bcrypt = require("bcrypt");
const db = require("../common/connect");

const adminSeeder = async () => {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "08012005";
  const email = process.env.ADMIN_EMAIL || "nhat88672@gmail.com";

  const checkSql = "SELECT * FROM users WHERE role = 'admin'";
  return new Promise((resolve, reject) => {
    db.query(checkSql, async (err, result) => {
      if (err) return reject(err);

      if (result.length === 0) {
        console.log("Chưa có admin, đang tạo mới . . .");
        const hash = await bcrypt.hash(password, 10);
        const insertSql = `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')`;
        db.query(insertSql, [username, email, hash], (err, result) => {
          if (err) return reject(err);
          console.log("Tạo admin thành công!");
          resolve();
        });
      } else {
        console.log("Admin đã tồn tại.");
        resolve();
      }
    });
  });
};

module.exports = adminSeeder;
