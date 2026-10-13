const db = require("../common/connect");
const userContacts = (userContacts) => {};

userContacts.getByUserId = (user_id, callback) => {
  const sqlString = `SELECT contact_id, user_id, friend_id, status, created_at 
    FROM UserContacts 
    WHERE user_id = ? OR friend_id = ?`;
  db.query(sqlString, [user_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

userContacts.getOne = (user_id, friend_id, callback) => {
  const sqlString = `SELECT contact_id, user_id, friend_id, status, created_at 
    FROM UserContacts 
    WHERE user_id = ? AND friend_id = ?`;
  db.query(sqlString, [user_id, friend_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

// Quan hệ giữa 2 user theo cả 2 chiều (A gửi B hoặc B gửi A)
userContacts.getBetween = (user_a, user_b, callback) => {
  const sqlString = `SELECT contact_id, user_id, friend_id, status, created_at
    FROM UserContacts
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    LIMIT 1`;
  db.query(sqlString, [user_a, user_b, user_b, user_a], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

userContacts.getById = (contact_id, callback) => {
  const sqlString = `SELECT contact_id, user_id, friend_id, status, created_at
    FROM UserContacts
    WHERE contact_id = ?`;
  db.query(sqlString, [contact_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

// Danh sách bạn bè đã chấp nhận, kèm thông tin user (không lộ password_hash)
userContacts.getFriends = (user_id, callback) => {
  const sqlString = `SELECT u.user_id, u.username, u.email, u.avatar_url, u.status, uc.contact_id
    FROM UserContacts uc
    INNER JOIN Users u ON u.user_id = IF(uc.user_id = ?, uc.friend_id, uc.user_id)
    WHERE (uc.user_id = ? OR uc.friend_id = ?) AND uc.status = 'accepted'
    ORDER BY u.username`;
  db.query(sqlString, [user_id, user_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

// Trả về các id trong friend_ids mà user_id đã là bạn bè (accepted)
userContacts.filterFriends = (user_id, friend_ids, callback) => {
  if (!friend_ids.length) return callback(null, []);
  const sqlString = `SELECT IF(user_id = ?, friend_id, user_id) AS friend_id
    FROM UserContacts
    WHERE status = 'accepted'
      AND ((user_id = ? AND friend_id IN (?)) OR (friend_id = ? AND user_id IN (?)))`;
  db.query(sqlString, [user_id, user_id, friend_ids, user_id, friend_ids], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.map((r) => r.friend_id));
  });
};

// Yêu cầu đang chờ, kèm thông tin của người phía bên kia
userContacts.getPending = (user_id, callback) => {
  const sqlString = `SELECT uc.contact_id, uc.user_id, uc.friend_id, uc.status, uc.created_at,
      u.user_id AS other_id, u.username AS other_username, u.email AS other_email, u.avatar_url AS other_avatar_url
    FROM UserContacts uc
    INNER JOIN Users u ON u.user_id = IF(uc.user_id = ?, uc.friend_id, uc.user_id)
    WHERE (uc.user_id = ? OR uc.friend_id = ?) AND uc.status = 'pending'
    ORDER BY uc.created_at DESC`;
  db.query(sqlString, [user_id, user_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

userContacts.deleteById = (contact_id, callback) => {
  const sqlString = `DELETE FROM UserContacts WHERE contact_id = ?`;
  db.query(sqlString, [contact_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

userContacts.updateStatusById = (contact_id, status, callback) => {
  const sqlString = `UPDATE UserContacts SET status = ? WHERE contact_id = ?`;
  db.query(sqlString, [status, contact_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

userContacts.insert = (data, callback) => {
  const sqlString = `INSERT INTO UserContacts (user_id, friend_id, status)
    VALUES (?, ?, ?)`;
  const values = [
    data.user_id,
    data.friend_id,
    data.status || "pending",
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

userContacts.updateStatus = (user_id, friend_id, status, callback) => {
  const sqlString = `UPDATE UserContacts
    SET status = ?
    WHERE user_id = ? AND friend_id = ?`;
  db.query(sqlString, [status, user_id, friend_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

userContacts.delete = (user_id, friend_id, callback) => {
  const sqlString = `DELETE FROM UserContacts 
    WHERE user_id = ? AND friend_id = ?`;
  db.query(sqlString, [user_id, friend_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = userContacts;
