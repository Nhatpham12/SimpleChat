const db = require("../common/connect");
const users = (users) => {};

users.getAll = (callBack) => {
  const sqlString = `SELECT user_id, username, email, role, avatar_url, status, created_at, updated_at
    FROM Users`;
  db.query(sqlString, (err, result) => {
    if (err) return callBack(err, null);
    callBack(null, result);
  });
};

users.getById = (user_id, callBack) => {
  const sqlString = `SELECT user_id, username, email, password_hash, role, avatar_url, status, is_verified, is_locked, mfa_enabled, created_at, updated_at
    FROM Users
    WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callBack(err, null);
    callBack(null, result[0] || null);
  });
};

users.getByUsername = (username, callBack) => {
  const sqlString = `SELECT user_id, username, email, password_hash, role, avatar_url, status, is_verified, is_locked, mfa_enabled, created_at, updated_at
    FROM Users
    WHERE username = ?`;
  db.query(sqlString, [username], (err, result) => {
    if (err) return callBack(err, null);
    callBack(null, result[0] || null);
  });
};

users.getByEmail = (email, callBack) => {
  const sqlString = `SELECT user_id, username, email, password_hash, role, avatar_url, status, is_verified, is_locked, mfa_enabled, created_at, updated_at
    FROM Users
    WHERE email = ?`;
  db.query(sqlString, [email], (err, result) => {
    if (err) return callBack(err, null);
    callBack(null, result[0] || null);
  });
};

users.getByAnyField = (field, value, callback) => {
  const allowedFields = ["user_id", "username", "email", "role", "status"];
  if (!allowedFields.includes(field)) {
    return callback(new Error("Invalid field"), null);
  }
  const sqlString = `SELECT user_id, username, email, role, avatar_url, status, created_at, updated_at 
    FROM Users 
    WHERE ${field} = ?`;
  db.query(sqlString, [value], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

users.insert = (data, callback) => {
  const sqlString = `INSERT INTO Users (username, email, password_hash, role, avatar_url)
    VALUES (?, ?, ?, ?, ?)`;
  const values = [
    data.username,
    data.email,
    data.password_hash,
    data.role || "user",
    data.avatar_url || null,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.insertId);
  });
};

users.update = (user_id, data, callback) => {
  const sqlString = `UPDATE Users 
    SET username = ?, email = ?, password_hash = ?, avatar_url = ?
    WHERE user_id = ?`;
  const values = [
    data.username,
    data.email,
    data.password_hash,
    data.avatar_url || null,
    user_id,
  ];
  db.query(sqlString, values, (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.updateAvatar = (user_id, avatar_url, callback) => {
  const sqlString = `UPDATE Users SET avatar_url = ? WHERE user_id = ?`;
  db.query(sqlString, [avatar_url, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.updateStatus = (user_id, status, callback) => {
  const sqlString = `UPDATE Users SET status = ? WHERE user_id = ?`;
  db.query(sqlString, [status, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.updateRole = (user_id, role, callback) => {
  const sqlString = `UPDATE Users SET role = ? WHERE user_id = ?`;
  db.query(sqlString, [role, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.setVerified = (user_id, callback) => {
  const sqlString = `UPDATE Users SET is_verified = TRUE WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

// Đặt lại mật khẩu (qua OTP email) cũng gỡ khóa tạm do nhập sai nhiều lần
users.updatePassword = (user_id, password_hash, callback) => {
  const sqlString = `UPDATE Users SET password_hash = ?, failed_logins = 0, lockout_until = NULL WHERE user_id = ?`;
  db.query(sqlString, [password_hash, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

// Số giây còn bị khóa tạm do nhập sai mật khẩu (0 = không bị khóa).
// So sánh bằng NOW() của MySQL để không lệch múi giờ giữa app và DB.
users.getLockoutSeconds = (user_id, callback) => {
  const sqlString = `SELECT GREATEST(COALESCE(TIMESTAMPDIFF(SECOND, NOW(), lockout_until), 0), 0) AS seconds
    FROM Users WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, Number(result[0]?.seconds || 0));
  });
};

// Ghi nhận 1 lần sai mật khẩu; đủ maxFailures lần liên tiếp thì khóa tạm lockMinutes phút và đếm lại từ 0.
// Trong SET của MySQL, vế phải đọc giá trị cũ của cột chưa được gán trước đó → lockout_until đặt trước.
users.recordFailedLogin = (user_id, maxFailures, lockMinutes, callback) => {
  const sqlString = `UPDATE Users
    SET lockout_until = IF(failed_logins + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), lockout_until),
        failed_logins = IF(failed_logins + 1 >= ?, 0, failed_logins + 1)
    WHERE user_id = ?`;
  db.query(sqlString, [maxFailures, lockMinutes, maxFailures, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.resetFailedLogins = (user_id, callback) => {
  const sqlString = `UPDATE Users SET failed_logins = 0, lockout_until = NULL WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.setMfaEnabled = (user_id, enabled, callback) => {
  const sqlString = `UPDATE Users SET mfa_enabled = ? WHERE user_id = ?`;
  db.query(sqlString, [Boolean(enabled), user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.delete = (user_id, callback) => {
  const sqlString = `DELETE FROM Users WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

module.exports = users;
