const bcrypt = require("bcrypt");
const db = require("../common/connect");

const adminSeeder = async () => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;

  const checkSql = "SELECT * FROM Users WHERE role = 'admin'";
  return new Promise((resolve, reject) => {
    db.query(checkSql, async (err, result) => {
      if (err) return reject(err);

      if (result.length > 0) {
        console.log("Admin đã tồn tại.");
        return resolve();
      }

      // Không có mật khẩu mặc định: thiếu biến môi trường thì bỏ qua, server vẫn chạy
      if (!username || !password || !email) {
        console.warn("Chưa có admin và thiếu ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL → bỏ qua tạo admin.");
        return resolve();
      }

      console.log("Chưa có admin, đang tạo mới . . .");
      try {
        const hash = await bcrypt.hash(password, 10);
        const insertSql = `INSERT INTO Users (username, email, password_hash, role, is_verified) VALUES (?, ?, ?, 'admin', TRUE)`;
        db.query(insertSql, [username, email, hash], (err) => {
          if (err) return reject(err);
          console.log("Tạo admin thành công!");
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  });
};

module.exports = adminSeeder;
