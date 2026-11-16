const db = require("../common/connect");

// Mã đăng nhập 2 bước — cùng cấu trúc với EmailVerifications / PasswordResets (dùng chung common/otp.js)
const loginOtps = {};

loginOtps.getByUserId = (user_id, callback) => {
  const sqlString = `SELECT id, user_id, token, expires_at, is_used, attempts, created_at
    FROM LoginOtps
    WHERE user_id = ? AND is_used = FALSE
    ORDER BY created_at DESC, id DESC`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

loginOtps.insert = (data, callback) => {
  const sqlString = `INSERT INTO LoginOtps (user_id, token, expires_at) VALUES (?, ?, ?)`;
  db.query(sqlString, [data.user_id, data.token, data.expires_at], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

loginOtps.markAsUsed = (id, callback) => {
  db.query(`UPDATE LoginOtps SET is_used = TRUE WHERE id = ?`, [id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

loginOtps.incrementAttempts = (id, callback) => {
  db.query(`UPDATE LoginOtps SET attempts = attempts + 1 WHERE id = ?`, [id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

loginOtps.invalidateByUserId = (user_id, callback) => {
  db.query(
    `UPDATE LoginOtps SET is_used = TRUE WHERE user_id = ? AND is_used = FALSE`,
    [user_id],
    (err, result) => {
      if (err) return callback(err, null);
      callback(null, result.affectedRows);
    },
  );
};

module.exports = loginOtps;
