const db = require("../common/connect");
const messageStatus = (messageStatus) => {};

messageStatus.getByMessageId = (message_id, callback) => {
  const sqlString = `SELECT status_id, message_id, receiver_id, status, updated_at
    FROM MessageStatus 
    WHERE message_id = ?`;
  db.query(sqlString, [message_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

messageStatus.getUnreadCount = (user_id, conversation_id, callback) => {
  const sqlString = `SELECT COUNT(*) AS unread_count
    FROM MessageStatus ms
    INNER JOIN Messages m ON ms.message_id = m.message_id
    WHERE ms.receiver_id = ?
      AND m.conversation_id = ?
      AND ms.status != 'read'`;
  db.query(sqlString, [user_id, conversation_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0].unread_count);
  });
};

messageStatus.insert = (data, callback) => {
  const sqlString = `INSERT INTO MessageStatus (message_id, receiver_id, status) 
    VALUES (?, ?, ?)`;
  const values = [
    data.message_id,
    data.receiver_id,
    data.status || "sent",
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

messageStatus.markAsRead = (message_id, receiver_id, callback) => {
  const sqlString = `UPDATE MessageStatus
    SET status = 'read'
    WHERE message_id = ? AND receiver_id = ?`;
  db.query(sqlString, [message_id, receiver_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

messageStatus.markAllAsRead = (conversation_id, receiver_id, callback) => {
  const sqlString = `UPDATE MessageStatus ms
    INNER JOIN Messages m ON ms.message_id = m.message_id
    SET ms.status = 'read'
    WHERE m.conversation_id = ? AND ms.receiver_id = ? AND ms.status != 'read'`;
  db.query(sqlString, [conversation_id, receiver_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = messageStatus;
