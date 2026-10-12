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
    table: "EmailVerifications",
    column: "attempts",
    definition: "INT NOT NULL DEFAULT 0 AFTER is_used",
  },
  {
    table: "PasswordResets",
    column: "attempts",
    definition: "INT NOT NULL DEFAULT 0 AFTER is_used",
  },
];

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
};

module.exports = migrate;
