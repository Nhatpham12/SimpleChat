const db = require("./connect");

// Kiểm tra user có được gửi tin vào conversation không.
// callback(err, reason) — reason = null nếu được phép, ngược lại là thông báo lỗi.
// - Phải là thành viên
// - Với chat 1-1: hai người phải đang là bạn bè (lời mời đã được chấp nhận)
const canSendMessage = (conversationId, userId, callback) => {
  const sqlString = `
    SELECT c.type,
      (SELECT COUNT(*) FROM Participants p WHERE p.conversation_id = c.conversation_id AND p.user_id = ?) AS is_member,
      (SELECT COUNT(*)
         FROM Participants op
         INNER JOIN UserContacts uc
           ON uc.status = 'accepted'
          AND ((uc.user_id = ? AND uc.friend_id = op.user_id) OR (uc.friend_id = ? AND uc.user_id = op.user_id))
        WHERE op.conversation_id = c.conversation_id AND op.user_id <> ?) AS friend_count
    FROM Conversations c
    WHERE c.conversation_id = ?`;
  db.query(sqlString, [userId, userId, userId, userId, conversationId], (err, rows) => {
    if (err) return callback(err, null);
    const row = rows[0];
    if (!row || !row.is_member) {
      return callback(null, "Bạn không phải thành viên cuộc trò chuyện này");
    }
    if (row.type === "direct" && !row.friend_count) {
      return callback(null, "Hai bạn chưa là bạn bè. Hãy gửi lời mời kết bạn và chờ được chấp nhận");
    }
    callback(null, null);
  });
};

module.exports = { canSendMessage };
