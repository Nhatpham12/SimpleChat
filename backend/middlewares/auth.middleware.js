const jwt = require("jsonwebtoken");
const config = require("../config");
const db = require("../common/connect");

const LOCKED_MESSAGE = "Tài khoản của bạn đã bị khóa. Liên hệ quản trị viên để được hỗ trợ.";

// Đọc lại role / trạng thái khóa từ DB mỗi request: JWT sống 24h nên không
// thể tin role trong token (admin đổi quyền hoặc khóa phải có hiệu lực ngay).
const loadAccount = (userId, callback) => {
  db.query(
    "SELECT user_id, username, role, is_locked FROM Users WHERE user_id = ?",
    [userId],
    (err, rows) => callback(err, rows?.[0] || null),
  );
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    return res.status(401).json({ status: "error", message: "Invalid or expired token" });
  }

  loadAccount(decoded.user_id, (err, account) => {
    if (err) {
      return res.status(500).json({ status: "error", message: "Lỗi khi xác thực" });
    }
    if (!account) {
      return res.status(401).json({ status: "error", message: "Tài khoản không còn tồn tại" });
    }
    if (account.is_locked) {
      return res.status(401).json({ status: "error", code: "ACCOUNT_LOCKED", message: LOCKED_MESSAGE });
    }
    req.user = { ...decoded, username: account.username, role: account.role };
    next();
  });
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: "error", message: "Bạn không có quyền thực hiện thao tác này" });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole, loadAccount, LOCKED_MESSAGE };
