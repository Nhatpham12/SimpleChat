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

const migrate = async () => {
  const conn = db.promise();
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
