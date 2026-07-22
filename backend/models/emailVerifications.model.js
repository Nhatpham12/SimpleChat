const db = require("../common/connect");
const emailVerifications = (emailVerifications) => {};

emailVerifications.getByToken = (token, callback) => {
  const sqlString = `SELECT id, user_id, token, expires_at, is_used, created_at
    FROM EmailVerifications 
    WHERE token = ? AND is_used = FALSE`;
  db.query(sqlString, [token], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

emailVerifications.getByUserId = (user_id, callback) => {
  const sqlString = `SELECT id, user_id, token, expires_at, is_used, created_at
    FROM EmailVerifications 
    WHERE user_id = ? AND is_used = FALSE
    ORDER BY created_at DESC`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

emailVerifications.insert = (data, callback) => {
  const sqlString = `INSERT INTO EmailVerifications (user_id, token, expires_at)
    VALUES (?, ?, ?)`;
  const values = [
    data.user_id,
    data.token,
    data.expires_at,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

emailVerifications.markAsUsed = (id, callback) => {
  const sqlString = `UPDATE EmailVerifications
    SET is_used = TRUE
    WHERE id = ?`;
  db.query(sqlString, [id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

emailVerifications.deleteExpired = (callback) => {
  const sqlString = `DELETE FROM EmailVerifications 
    WHERE expires_at < NOW() OR is_used = TRUE`;
  db.query(sqlString, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = emailVerifications;
