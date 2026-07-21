const db = require("../common/connect");
const messages = (messages) => {};

messages.getByConversationId = (conversation_id, limit, offset, callback) => {
  const sqlString = `SELECT message_id, sender_id, content, type, created_at, updated_at, is_deleted 
    FROM Messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`;
  db.query(sqlString, [conversation_id, limit, offset], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

messages.getById = (message_id, callback) => {
  const sqlString = `SELECT message_id, conversation_id, sender_id, content, type, created_at, updated_at, is_deleted  
    FROM Messages 
    WHERE message_id = ?`;
  db.query(sqlString, [message_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

messages.insert = (data, callback) => {
  const sqlString = `INSERT INTO Messages (conversation_id, sender_id, content, type) 
    VALUES (?, ?, ?, ?)`;
  const values = [
    data.conversation_id,
    data.sender_id,
    data.content,
    data.type || "text",
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

messages.update = (message_id, content, callback) => {
  const sqlString = `UPDATE Messages 
    SET content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE message_id = ?`;
  db.query(sqlString, [content, message_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

messages.softDelete = (message_id, callback) => {
  const sqlString = `UPDATE Messages
    SET is_deleted = TRUE
    WHERE message_id = ?`;
  db.query(sqlString, [message_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = messages;
