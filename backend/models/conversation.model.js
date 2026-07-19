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

module.exports = conversations;
