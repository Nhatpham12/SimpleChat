const db = require("../common/connect");
const conversations = (conversations) => {};

conversations.getById = (conversation_id, callback) => {
  const sqlString = `SELECT * FROM conversations where conversation_id = ?`;
  db.query(sqlString, [conversation_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

conversations.getByUserId = (user_id, callback) => {
  const sqlString = `SELECT * FROM conversations where user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

conversations.getDirect = (user_id1, user_id2, callback) => {
  const sqlString = `SELECT c.conversation_id, c.type, c.created_at
    FROM conversation c
    INNER JOIN participants p1 ON c.conversation_id = p1.conversation_id
    INNER JOIN participants p2 ON c.conversation_id = p1.conversation_id
    WHERE c.type = 'direct'
        AND p1.user_id = ?
        AND p2.user_id = ?
    LIMIT 1`;

  db.query(sqlString, [user_id1, user_id2], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

conversations.insert = (data, callback) => {
  const sqlString = `INSERT INTO conversations (type, conversation_name, avatar_url, created_by)
    VALUES (?,?,?,?)`;
  const values = [
    data.type,
    data.conversation_name,
    data.avatar_url || null,
    data.created_by,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

conversations.update = (conversation_id, data, callback) => {
  const sqlString = `UPDATE conversations 
    SET conversaton_name = ?, type = ?, created_by = ?, created_at = ?, avatar_url = ?
    WHERE conversation_id = ?`;
  const values = [
    data.conversation_name,
    data.type,
    data.created_by,
    data.created_at,
    data.avatar_url || null,
    conversation_id,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

conversations.delete = (conversation_id, callback) => {
  const sqlString = `DELETE FROM conversations WHERE conversation_id = ?`;
  db.query(sqlString, [conversation_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};
module.exports = conversations;
