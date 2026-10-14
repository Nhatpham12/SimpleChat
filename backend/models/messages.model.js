const db = require("../common/connect");
const messages = (messages) => {};

// Cột trả về cho client: tin nhắn + người gửi + file đính kèm (mỗi tin tối đa 1 file)
const COLS = `m.message_id, m.conversation_id, m.sender_id, m.content, m.type, m.created_at, m.updated_at, m.is_deleted,
      u.username AS sender_name, u.avatar_url AS sender_avatar,
      a.file_url, a.file_name, a.file_type, a.file_size`;
const FROM = `FROM Messages m
    LEFT JOIN Users u ON u.user_id = m.sender_id
    LEFT JOIN Attachments a ON a.message_id = m.message_id`;

// Tin đã thu hồi không trả nội dung / file về client
const hideDeleted = (rows) =>
  rows.map((r) => (r.is_deleted ? { ...r, content: "", file_url: null, file_name: null, file_type: null, file_size: null } : r));

// afterId: bỏ các tin <= afterId (người dùng đã "xóa lịch sử trò chuyện" phía mình)
messages.getByConversationId = (conversation_id, afterId, limit, offset, callback) => {
  const sqlString = `SELECT ${COLS} ${FROM}
    WHERE m.conversation_id = ? AND m.message_id > ?
    ORDER BY m.created_at DESC, m.message_id DESC
    LIMIT ? OFFSET ?`;
  db.query(sqlString, [conversation_id, afterId, limit, offset], (err, result) => {
    if (err) return callback(err, null);
    callback(null, hideDeleted(result));
  });
};

// Lấy các tin nhắn xung quanh 1 tin (dùng khi nhảy tới kết quả tìm kiếm), trả về DESC như getByConversationId
messages.getAround = (conversation_id, message_id, half, afterId, callback) => {
  const sqlString = `
    SELECT * FROM (
      (SELECT ${COLS} ${FROM}
        WHERE m.conversation_id = ? AND m.message_id > ? AND m.message_id <= ? ORDER BY m.message_id DESC LIMIT ?)
      UNION ALL
      (SELECT ${COLS} ${FROM}
        WHERE m.conversation_id = ? AND m.message_id > ? ORDER BY m.message_id ASC LIMIT ?)
    ) t
    ORDER BY t.message_id DESC`;
  const startAfter = Math.max(afterId, message_id);
  db.query(sqlString, [conversation_id, afterId, message_id, half, conversation_id, startAfter, half], (err, result) => {
    if (err) return callback(err, null);
    callback(null, hideDeleted(result));
  });
};

// Tìm tin nhắn theo nội dung (không phân biệt hoa thường / dấu nhờ collation utf8mb4_unicode_ci)
messages.search = (conversation_id, keyword, afterId, limit, callback) => {
  const escaped = keyword.replace(/[\\%_]/g, "\\$&");
  const sqlString = `SELECT m.message_id, m.conversation_id, m.sender_id, m.content, m.created_at,
      u.username AS sender_name, u.avatar_url AS sender_avatar
    FROM Messages m
    LEFT JOIN Users u ON u.user_id = m.sender_id
    WHERE m.conversation_id = ? AND m.message_id > ? AND m.is_deleted = FALSE AND m.type = 'text' AND m.content LIKE ?
    ORDER BY m.message_id DESC
    LIMIT ?`;
  db.query(sqlString, [conversation_id, afterId, `%${escaped}%`, limit], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result);
  });
};

// Kho lưu trữ của cuộc trò chuyện: media (ảnh/video) | file (tài liệu) | link (tin văn bản có URL)
messages.getShared = (conversation_id, kind, afterId, limit, callback) => {
  let where;
  if (kind === "media") where = `(a.file_type LIKE 'image/%' OR a.file_type LIKE 'video/%')`;
  else if (kind === "file") where = `a.file_url IS NOT NULL AND a.file_type NOT LIKE 'image/%' AND a.file_type NOT LIKE 'video/%'`;
  else where = `m.type = 'text' AND (m.content LIKE '%http://%' OR m.content LIKE '%https://%' OR m.content LIKE '%www.%')`;

  const sqlString = `SELECT ${COLS} ${FROM}
    WHERE m.conversation_id = ? AND m.message_id > ? AND m.is_deleted = FALSE AND ${where}
    ORDER BY m.message_id DESC
    LIMIT ?`;
  db.query(sqlString, [conversation_id, afterId, limit], (err, result) => {
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
