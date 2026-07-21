const db = require("../common/connect");
const participants = (participants) => {};

participants.getByConversationId = (conversation_id, callback) => {
  const sqlString = `SELECT participant_id, user_id, role, joined_at 
    FROM Participants 
    WHERE conversation_id = ?`;
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
  const sqlString = `SELECT participant_id, role, joined_at 
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

module.exports = participants;
