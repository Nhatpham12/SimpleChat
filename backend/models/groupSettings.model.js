const db = require("../common/connect");
const groupSettings = (groupSettings) => {};

groupSettings.getByConversationId = (conversation_id, callback) => {
  const sqlString = `SELECT setting_id, conversation_id, setting_name, setting_value, updated_at 
    FROM GroupSettings 
    WHERE conversation_id = ?`;
  db.query(sqlString, [conversation_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

groupSettings.getOne = (conversation_id, setting_name, callback) => {
  const sqlString = `SELECT setting_id, conversation_id, setting_name, setting_value, updated_at 
    FROM GroupSettings 
    WHERE conversation_id = ? AND setting_name = ?`;
  db.query(sqlString, [conversation_id, setting_name], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

groupSettings.insertOrUpdate = (conversation_id, setting_name, setting_value, callback) => {
  const sqlString = `INSERT INTO GroupSettings (conversation_id, setting_name, setting_value)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`;
  db.query(sqlString, [conversation_id, setting_name, setting_value], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId || result.affectedRows > 0);
  });
};

groupSettings.delete = (conversation_id, setting_name, callback) => {
  const sqlString = `DELETE FROM GroupSettings 
    WHERE conversation_id = ? AND setting_name = ?`;
  db.query(sqlString, [conversation_id, setting_name], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = groupSettings;
