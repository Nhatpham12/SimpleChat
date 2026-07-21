const db = require("../common/connect");
const messageStatus = (messageStatus) => {};

messageStatus.getByMessageId = (message_id, callback) => {
  const sqlString = `SELECT status_id, message_id, receiver_id, status   
    FROM messageStatus 
    WHERE message_id = ?`;
  db.query(sqlString, [message_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

module.exports = messageStatus;
