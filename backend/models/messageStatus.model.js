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

messageStatus.getLastMessageId = (conversation_id, callback) => {
  const sqlString = `SELECT MAX(message_id) AS last_id FROM Messages WHERE conversation_id = ?`;
  db.query(sqlString, [conversation_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0].last_id || null);
  });
};

// Tin mới nhất mỗi thành viên khác đã xem: tin đã đánh dấu "read" hoặc tin chính họ gửi sau đó
messageStatus.getSeenByConversation = (conversation_id, user_id, callback) => {
  const sqlString = `SELECT p.user_id, u.username, u.avatar_url,
      GREATEST(
        COALESCE((SELECT MAX(ms.message_id) FROM MessageStatus ms
                    INNER JOIN Messages m ON m.message_id = ms.message_id
                   WHERE m.conversation_id = p.conversation_id AND ms.receiver_id = p.user_id AND ms.status = 'read'), 0),
        COALESCE((SELECT MAX(m2.message_id) FROM Messages m2
                   WHERE m2.conversation_id = p.conversation_id AND m2.sender_id = p.user_id), 0)
      ) AS last_seen_id
    FROM Participants p
    INNER JOIN Users u ON u.user_id = p.user_id
    WHERE p.conversation_id = ? AND p.user_id <> ?`;
  db.query(sqlString, [conversation_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.map((r) => ({ ...r, last_seen_id: Number(r.last_seen_id) || 0 })));
  });
};

module.exports = messageStatus;
