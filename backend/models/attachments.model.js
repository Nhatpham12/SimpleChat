const db = require("../common/connect");
const attachments = (attachments) => {};

attachments.getByMessageId = (message_id, callback) => {
  const sqlString = `SELECT message_id, file_url, file_type, file_size, uploaded_at  
    FROM attachments 
    WHERE message_id = ?`;
  db.query(sqlString, [message_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

attachments.insert = (data, callback) => {
  const sqlString = `INSERT INTO attachments (message_id, file_url, file_type, file_size) 
    VALUES (?, ?, ?, ?)`;
  const values = [
    data.message_id,
    data.file_url,
    data.file_type,
    data.file_size,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

attachments.delete = (attachment_id, callback) => {
  const sqlString = `DELETE FROM attachments WHERE attachment_id = ?`;
  db.query(sqlString, [attachment_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};
module.exports = attachments;
