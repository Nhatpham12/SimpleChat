const db = require("../common/connect");
const participants = (participants) => {};

participants.getByConversationId = (conversation_id, callback) => {
  const sqlString = `SELECT p.participant_id, p.user_id, p.role, p.joined_at, u.username, u.avatar_url
    FROM Participants p
    INNER JOIN Users u ON u.user_id = p.user_id
    WHERE p.conversation_id = ?
    ORDER BY p.role = 'admin' DESC, p.joined_at ASC`;
  db.query(sqlString, [conversation_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

participants.getByUserId = (user_id, callback) => {
  const sqlString = `SELECT participant_id, conversation_id, role, joined_at
    FROM Participants
    WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

participants.getOne = (conversation_id, user_id, callback) => {
  const sqlString = `SELECT participant_id, role, joined_at, cleared_before_id
    FROM Participants
    WHERE conversation_id = ? AND user_id = ?`;
  db.query(sqlString, [conversation_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

participants.insert = (data, callback) => {
  const sqlString = `INSERT INTO Participants (conversation_id, user_id, role)
    VALUES (?, ?, ?)`;
  const values = [
    data.conversation_id,
    data.user_id,
    data.role || "member",
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

participants.updateRole = (conversation_id, user_id, role, callback) => {
  const sqlString = `UPDATE Participants
    SET role = ?
    WHERE conversation_id = ? AND user_id = ?`;
  db.query(sqlString, [role, conversation_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

participants.delete = (conversation_id, user_id, callback) => {
  const sqlString = `DELETE FROM Participants
    WHERE conversation_id = ? AND user_id = ?`;
  db.query(sqlString, [conversation_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

// Ẩn toàn bộ tin hiện có với user này (xóa lịch sử phía mình)
participants.clearHistory = (conversation_id, user_id, callback) => {
  const sqlString = `UPDATE Participants
    SET cleared_before_id = COALESCE((SELECT MAX(message_id) FROM Messages WHERE conversation_id = ?), 0)
    WHERE conversation_id = ? AND user_id = ?`;
  db.query(sqlString, [conversation_id, conversation_id, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = participants;
