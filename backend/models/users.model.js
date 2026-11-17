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

// Hai bộ đếm khóa tạm độc lập (đếm theo tài khoản, không theo IP → chặn dò phân tán):
//   login: sai mật khẩu        mfa: sai mã 2 bước
// Tên cột lấy từ danh sách cố định này, không bao giờ từ input.
const LOCK_COLUMNS = {
  login: { count: "failed_logins", until: "lockout_until" },
  mfa: { count: "mfa_failed", until: "mfa_locked_until" },
};

// Số giây còn bị khóa tạm (0 = không bị khóa). So sánh bằng NOW() của MySQL để không lệch múi giờ.
users.getLockoutSeconds = (user_id, kind, callback) => {
  const { until } = LOCK_COLUMNS[kind];
  const sqlString = `SELECT GREATEST(COALESCE(TIMESTAMPDIFF(SECOND, NOW(), ${until}), 0), 0) AS seconds
    FROM Users WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, Number(result[0]?.seconds || 0));
  });
};

// Ghi nhận 1 lần sai; đủ maxFailures lần liên tiếp thì khóa tạm lockMinutes phút và đếm lại từ 0.
// Trong SET của MySQL, vế phải đọc giá trị cũ của cột chưa được gán trước đó → cột "until" đặt trước.
// callback(null, justLocked): justLocked = true nếu LẦN NÀY vừa kích hoạt khóa (để gửi cảnh báo 1 lần).
users.recordFailure = (user_id, kind, maxFailures, lockMinutes, callback) => {
  const { count, until } = LOCK_COLUMNS[kind];
  const sqlString = `UPDATE Users
    SET ${until} = IF(${count} + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ${until}),
        ${count} = IF(${count} + 1 >= ?, 0, ${count} + 1)
    WHERE user_id = ?`;
  db.query(sqlString, [maxFailures, lockMinutes, maxFailures, user_id], (err) => {
    if (err) return callback(err, null);
    // Vừa khóa khi: bộ đếm vừa reset về 0 VÀ thời điểm mở khóa nằm ở tương lai.
    db.query(
      `SELECT (${count} = 0 AND ${until} > NOW()) AS justLocked FROM Users WHERE user_id = ?`,
      [user_id],
      (err2, rows) => {
        if (err2) return callback(err2, null);
        callback(null, Boolean(rows[0]?.justLocked));
      },
    );
  });
};

users.resetFailures = (user_id, kind, callback) => {
  const { count, until } = LOCK_COLUMNS[kind];
  const sqlString = `UPDATE Users SET ${count} = 0, ${until} = NULL WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

// Secret TOTP (đã mã hóa) + bước thời gian của mã dùng gần nhất. Không bao giờ trả về client.
users.getMfaState = (user_id, callback) => {
  const sqlString = `SELECT mfa_enabled, mfa_secret, mfa_last_step FROM Users WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result[0] || null);
  });
};

// Lưu secret mới khi bắt đầu cài đặt (chỉ khi MFA đang tắt)
users.setMfaSecret = (user_id, encryptedSecret, callback) => {
  const sqlString = `UPDATE Users SET mfa_secret = ?, mfa_last_step = NULL WHERE user_id = ? AND mfa_enabled = FALSE`;
  db.query(sqlString, [encryptedSecret, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.enableMfa = (user_id, step, callback) => {
  const sqlString = `UPDATE Users SET mfa_enabled = TRUE, mfa_last_step = ? WHERE user_id = ? AND mfa_enabled = FALSE`;
  db.query(sqlString, [step, user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

users.disableMfa = (user_id, callback) => {
  const sqlString = `UPDATE Users
    SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_last_step = NULL, mfa_failed = 0, mfa_locked_until = NULL
    WHERE user_id = ?`;
  db.query(sqlString, [user_id], (err, result) => {
    if (err) return callback(err, null);
    callback(null, result.affectedRows > 0);
  });
};

// Ghi nhận mã TOTP đã dùng. Điều kiện "< step" làm việc này nguyên tử:
// 2 request song song cùng một mã thì chỉ 1 request được (chống replay).
users.claimMfaStep = (user_id, step, callback) => {
  const sqlString = `UPDATE Users SET mfa_last_step = ?
    WHERE user_id = ? AND (mfa_last_step IS NULL OR mfa_last_step < ?)`;
  db.query(sqlString, [step, user_id, step], (err, result) => {
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
