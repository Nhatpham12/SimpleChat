const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Trả lỗi cùng định dạng với các API khác + số giây phải chờ (client hiện pop-up)
const handler = (message) => (req, res, next, options) => {
  const resetTime = req.rateLimit?.resetTime;
  const retryAfter = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : Math.ceil(options.windowMs / 1000);
  const wait = retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} phút` : `${retryAfter} giây`;
  res.status(429).json({
    status: "error",
    code: "RATE_LIMITED",
    message: `${message} Vui lòng thử lại sau ${wait}.`,
    data: { retryAfter },
  });
};

const make = (options, message) =>
  rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: handler(message),
    ...options,
  });

const MINUTE = 60 * 1000;

// Toàn bộ /api: chặn spam / quét dữ liệu
const apiLimiter = make({ windowMs: MINUTE, limit: 300 }, "Bạn thao tác quá nhanh.");

// Đăng nhập sai: tối đa 5 lần / 15 phút cho mỗi cặp IP + tài khoản (đăng nhập đúng không tính)
const loginAccountLimiter = make(
  {
    windowMs: 15 * MINUTE,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.username || "").trim().toLowerCase()}`,
  },
  "Bạn đã nhập sai mật khẩu quá nhiều lần.",
);

// Đăng nhập sai từ 1 IP (dò nhiều tài khoản khác nhau)
const loginIpLimiter = make(
  { windowMs: 15 * MINUTE, limit: 20, skipSuccessfulRequests: true },
  "Có quá nhiều lần đăng nhập thất bại từ mạng của bạn.",
);

const registerLimiter = make({ windowMs: 60 * MINUTE, limit: 5 }, "Bạn đã tạo quá nhiều tài khoản.");

// Gửi email OTP (quên mật khẩu, gửi lại mã xác nhận)
const otpSendLimiter = make({ windowMs: 15 * MINUTE, limit: 5 }, "Bạn đã yêu cầu gửi mã quá nhiều lần.");

// Nhập OTP: mã 6 số nên phải chặn dò mã
const otpVerifyLimiter = make(
  { windowMs: 15 * MINUTE, limit: 10, skipSuccessfulRequests: true },
  "Bạn đã nhập sai mã quá nhiều lần.",
);

// Đổi mật khẩu (đã đăng nhập): giới hạn theo user
const changePasswordLimiter = make(
  {
    windowMs: 15 * MINUTE,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `user:${req.user?.user_id ?? ipKeyGenerator(req.ip)}`,
  },
  "Bạn đã nhập sai mật khẩu hiện tại quá nhiều lần.",
);

// Gửi lời mời kết bạn
const friendRequestLimiter = make(
  { windowMs: 60 * MINUTE, limit: 30, keyGenerator: (req) => `user:${req.user?.user_id ?? ipKeyGenerator(req.ip)}` },
  "Bạn đã gửi quá nhiều lời mời kết bạn.",
);

// Giới hạn gửi tin nhắn qua socket: tối đa `limit` tin trong `windowMs` cho mỗi kết nối
const createSocketLimiter = (limit = 20, windowMs = 10 * 1000) => {
  const stamps = [];
  return () => {
    const now = Date.now();
    while (stamps.length && now - stamps[0] > windowMs) stamps.shift();
    if (stamps.length >= limit) return false;
    stamps.push(now);
    return true;
  };
};

module.exports = {
  apiLimiter,
  loginAccountLimiter,
  loginIpLimiter,
  registerLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  changePasswordLimiter,
  friendRequestLimiter,
  createSocketLimiter,
};
