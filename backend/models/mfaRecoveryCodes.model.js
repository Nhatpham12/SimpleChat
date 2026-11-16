const db = require("../common/connect");

// Mã khôi phục MFA: chỉ lưu bcrypt hash, mỗi mã dùng được một lần
const mfaRecoveryCodes = {};

mfaRecoveryCodes.getUnused = (user_id, callback) => {
  db.query(
    `SELECT id, code_hash FROM MfaRecoveryCodes WHERE user_id = ? AND used_at IS NULL`,
    [user_id],
    (err, result) => callback(err, err ? null : result),
  );
};

// Đánh dấu đã dùng; trả false nếu mã vừa bị request khác dùng trước (chống dùng 2 lần song song)
mfaRecoveryCodes.markUsed = (id, callback) => {
  db.query(
    `UPDATE MfaRecoveryCodes SET used_at = NOW() WHERE id = ? AND used_at IS NULL`,
    [id],
    (err, result) => callback(err, err ? null : result.affectedRows > 0),
  );
};

// Xóa bộ mã cũ rồi lưu bộ mới (hashes rỗng = chỉ xóa)
mfaRecoveryCodes.replaceForUser = (user_id, hashes, callback) => {
  db.query(`DELETE FROM MfaRecoveryCodes WHERE user_id = ?`, [user_id], (err) => {
    if (err || hashes.length === 0) return callback(err || null, !err);
    const rows = hashes.map((hash) => [user_id, hash]);
    db.query(`INSERT INTO MfaRecoveryCodes (user_id, code_hash) VALUES ?`, [rows], (err) =>
      callback(err || null, !err),
    );
  });
};

module.exports = mfaRecoveryCodes;
