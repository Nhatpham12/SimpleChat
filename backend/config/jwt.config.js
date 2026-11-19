require("dotenv").config();

const DEFAULT_SECRET = "my_jwt_secret_key";

// Secret mặc định ai cũng biết → kẻ xấu tự ký được token admin. Prod phải đặt JWT_SECRET riêng
// (chỉ cảnh báo, không dừng server: OTP và MFA cũng dẫn xuất từ secret này).
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET)) {
  console.error("CẢNH BÁO BẢO MẬT: JWT_SECRET chưa được đặt hoặc đang dùng giá trị mặc định");
}

const jwtConfig = {
  secret: process.env.JWT_SECRET || DEFAULT_SECRET,
  // Chỉ chấp nhận HS256 khi verify (chặn đổi thuật toán trong header token)
  algorithms: ["HS256"],
  expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  // "Ghi nhớ đăng nhập": token sống lâu hơn, client lưu trong localStorage
  rememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || "30d",
};

module.exports = jwtConfig;
