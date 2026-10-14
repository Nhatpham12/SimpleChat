const db = require("../common/connect");
const attachments = (attachments) => {};

attachments.getById = (attachment_id, callback) => {
  const sqlString = `SELECT attachment_id, message_id, file_url, file_name, file_type, file_size, uploaded_at  
    FROM Attachments 
    WHERE attachment_id = ?`;
  db.query(sqlString, [attachment_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

attachments.getByMessageId = (message_id, callback) => {
  const sqlString = `SELECT message_id, file_url, file_name, file_type, file_size, uploaded_at  
    FROM Attachments 
    WHERE message_id = ?`;
  db.query(sqlString, [message_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

attachments.insert = (data, callback) => {
  const sqlString = `INSERT INTO Attachments (message_id, file_url, file_name, file_type, file_size)
    VALUES (?, ?, ?, ?, ?)`;
  const values = [
    data.message_id,
    data.file_url,
    data.file_name || null,
    data.file_type,
    data.file_size,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

attachments.delete = (attachment_id, callback) => {
  const sqlString = `DELETE FROM Attachments WHERE attachment_id = ?`;
  db.query(sqlString, [attachment_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};
module.exports = attachments;
