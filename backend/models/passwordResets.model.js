const db = require("../common/connect");
const passwordResets = (passwordResets) => {};

passwordResets.getByToken = (token, callback) => {
  const sqlString = `SELECT id, user_id, token, expires_at, is_used, created_at
    FROM PasswordResets 
    WHERE token = ? AND is_used = FALSE`;
  db.query(sqlString, [token], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

passwordResets.getByUserId = (user_id, callback) => {
  const sqlString = `SELECT id, user_id, token, expires_at, is_used, created_at
    FROM PasswordResets 
    WHERE user_id = ? AND is_used = FALSE
    ORDER BY created_at DESC`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

passwordResets.insert = (data, callback) => {
  const sqlString = `INSERT INTO PasswordResets (user_id, token, expires_at)
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

passwordResets.markAsUsed = (id, callback) => {
  const sqlString = `UPDATE PasswordResets
    SET is_used = TRUE
    WHERE id = ?`;
  db.query(sqlString, [id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

passwordResets.deleteExpired = (callback) => {
  const sqlString = `DELETE FROM PasswordResets 
    WHERE expires_at < NOW() OR is_used = TRUE`;
  db.query(sqlString, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = passwordResets;
