require("dotenv").config();

const jwtConfig = {
  secret: process.env.JWT_SECRET || "my_jwt_secret_key",
  expiresIn: process.env.JWT_EXPIRES_IN || "24h",
};

module.exports = jwtConfig;
