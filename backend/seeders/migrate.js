const db = require("../common/connect");

// Các cột thêm sau khi DB đã chạy (simplechat.sql chỉ chạy khi DB còn trống).
// afterAdd: chạy một lần ngay sau khi thêm cột.
const COLUMNS = [
  {
    table: "Users",
    column: "is_verified",
    definition: "BOOLEAN NOT NULL DEFAULT FALSE AFTER status",
    // User cũ đã dùng app trước khi có xác nhận email → coi như đã xác nhận
    afterAdd: "UPDATE Users SET is_verified = TRUE",
  },
  {
    // Admin khóa tài khoản: không đăng nhập được, phiên đang mở bị ngắt
    table: "Users",
    column: "is_locked",
    definition: "BOOLEAN NOT NULL DEFAULT FALSE AFTER is_verified",
  },
  {
    // Đăng nhập 2 bước (mã OTP qua email), người dùng tự bật trong trang Hồ sơ
    table: "Users",
    column: "mfa_enabled",
    definition: "BOOLEAN NOT NULL DEFAULT FALSE AFTER is_locked",
  },
  {
    // Chống dò mật khẩu: đếm số lần sai liên tiếp, quá ngưỡng thì khóa tạm đến lockout_until
    table: "Users",
    column: "failed_logins",
    definition: "INT NOT NULL DEFAULT 0 AFTER mfa_enabled",
  },
  {
    table: "Users",
    column: "lockout_until",
    definition: "DATETIME DEFAULT NULL AFTER failed_logins",
  },
  {
    table: "EmailVerifications",
    column: "attempts",
    definition: "INT NOT NULL DEFAULT 0 AFTER is_used",
  },
  {
    table: "PasswordResets",
    column: "attempts",
    definition: "INT NOT NULL DEFAULT 0 AFTER is_used",
  },
  {
    // "Xóa lịch sử trò chuyện" chỉ phía mình: ẩn các tin có message_id <= giá trị này
    table: "Participants",
    column: "cleared_before_id",
    definition: "INT NOT NULL DEFAULT 0 AFTER role",
  },
  {
    // Tên gốc của file đính kèm (để hiển thị và tải về)
    table: "Attachments",
    column: "file_name",
    definition: "VARCHAR(255) DEFAULT NULL AFTER file_url",
  },
];

// Cột VARCHAR cần nới rộng (MIME của .docx/.xlsx dài hơn 50 ký tự)
const WIDEN = [{ table: "Attachments", column: "file_type", length: 255 }];

// Bảng thêm sau khi DB đã chạy (cùng định nghĩa trong simplechat.sql)
const TABLES = [
  `CREATE TABLE IF NOT EXISTS LoginOtps (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    token      VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used    BOOLEAN DEFAULT FALSE,
    attempts   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_loginotps_user_id (user_id)
  ) ENGINE=InnoDB`,
];

const migrate = async () => {
  const conn = db.promise();
  for (const sql of TABLES) await conn.query(sql);

  for (const { table, column, definition, afterAdd } of COLUMNS) {
    const [rows] = await conn.query(
      `SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    if (rows.length > 0) continue;

    console.log(`Migration: thêm cột ${table}.${column}`);
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    if (afterAdd) await conn.query(afterAdd);
  }

  for (const { table, column, length } of WIDEN) {
    const [rows] = await conn.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    if (rows.length === 0 || rows[0].len >= length) continue;

    console.log(`Migration: nới ${table}.${column} lên VARCHAR(${length})`);
    await conn.query(`ALTER TABLE ${table} MODIFY ${column} VARCHAR(${length}) DEFAULT NULL`);
  }
};

module.exports = migrate;
