const db = require("../common/connect");
const blockedUsers = (blockedUsers) => {};

blockedUsers.getByUserId = (user_id, callback) => {
  const sqlString = `SELECT block_id, user_id, blocked_user_id, created_at 
    FROM BlockedUsers 
    WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

blockedUsers.isBlocked = (user_id, blocked_user_id, callback) => {
  const sqlString = `SELECT block_id, user_id, blocked_user_id, created_at
    FROM BlockedUsers 
    WHERE user_id = ? AND blocked_user_id = ?`;
  db.query(sqlString, [user_id, blocked_user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

blockedUsers.insert = (data, callback) => {
  const sqlString = `INSERT INTO BlockedUsers (user_id, blocked_user_id) 
    VALUES (?, ?)`;
  const values = [
    data.user_id,
    data.blocked_user_id,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

blockedUsers.delete = (user_id, blocked_user_id, callback) => {
  const sqlString = `DELETE FROM BlockedUsers 
    WHERE user_id = ? AND blocked_user_id = ?`;
  db.query(sqlString, [user_id, blocked_user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = blockedUsers;
