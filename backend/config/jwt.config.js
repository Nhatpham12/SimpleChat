require("dotenv").config();

const jwtConfig = {
  secret: process.env.JWT_SECRET || "my_jwt_secret_key",
  expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  // "Ghi nhớ đăng nhập": token sống lâu hơn, client lưu trong localStorage
  rememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || "30d",
};

module.exports = jwtConfig;
