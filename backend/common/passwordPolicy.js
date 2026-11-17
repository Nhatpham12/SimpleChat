// Chính sách mật khẩu dùng chung cho đăng ký, đổi và đặt lại mật khẩu.
// Trả về chuỗi lỗi (tiếng Việt) nếu không đạt, hoặc null nếu hợp lệ.
const MIN_LENGTH = 10;
const MAX_LENGTH = 128; // chặn DoS do bcrypt hash chuỗi quá dài

// Mật khẩu bị dò nhiều nhất — chặn thẳng (so khớp sau khi hạ chữ thường).
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "passw0rd",
  "qwerty123", "qwertyuiop", "11111111", "00000000", "abc12345", "iloveyou",
  "admin123", "matkhau", "matkhau123", "simplechat", "letmein123", "baseball1",
]);

// pw: mật khẩu cần kiểm tra. Trả về null nếu đạt, hoặc thông báo lỗi.
const validatePassword = (pw) => {
  if (typeof pw !== "string") return "Mật khẩu phải là chuỗi";
  if (pw.length < MIN_LENGTH) return `Mật khẩu phải có ít nhất ${MIN_LENGTH} ký tự`;
  if (pw.length > MAX_LENGTH) return `Mật khẩu tối đa ${MAX_LENGTH} ký tự`;
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Mật khẩu phải có cả chữ và số";
  if (COMMON.has(pw.toLowerCase())) return "Mật khẩu quá phổ biến, vui lòng chọn mật khẩu khác";
  return null;
};

module.exports = { validatePassword, MIN_LENGTH, MAX_LENGTH };
