const db = require("../common/connect");
const notifications = (notifications) => {};

notifications.getByUserId = (user_id, callback) => {
  const sqlString = `SELECT notification_id, user_id, type, content, reference_id, created_at, is_seen
    FROM Notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

notifications.getUnreadCount = (user_id, callback) => {
  const sqlString = `SELECT COUNT(*) AS unread_count
    FROM Notifications
    WHERE user_id = ? AND is_seen = FALSE`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0].unread_count);
  });
};

notifications.insert = (data, callback) => {
  const sqlString = `INSERT INTO Notifications (user_id, type, content, reference_id) 
    VALUES (?, ?, ?, ?)`;
  const values = [
    data.user_id,
    data.type,
    data.content || null,
    data.reference_id || null,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

notifications.markAsSeen = (notification_id, callback) => {
  const sqlString = `UPDATE Notifications
    SET is_seen = TRUE
    WHERE notification_id = ?`;
  db.query(sqlString, [notification_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

notifications.markAllAsSeen = (user_id, callback) => {
  const sqlString = `UPDATE Notifications
    SET is_seen = TRUE
    WHERE user_id = ? AND is_seen = FALSE`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

notifications.delete = (notification_id, callback) => {
  const sqlString = `DELETE FROM Notifications WHERE notification_id = ?`;
  db.query(sqlString, [notification_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = notifications;
