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

userContacts.getPending = (user_id, callback) => {
  const sqlString = `SELECT contact_id, user_id, friend_id, status, created_at 
    FROM UserContacts 
    WHERE (user_id = ? OR friend_id = ?) AND status = 'pending'`;
  db.query(sqlString, [user_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
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
