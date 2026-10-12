const crypto = require("crypto");
const { promisify } = require("util");
const config = require("../config");

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

// Chỉ lưu HMAC của OTP trong DB, không lưu mã gốc
const hashOtp = (otp) =>
  crypto.createHmac("sha256", config.jwt.secret).update(otp).digest("hex");

// model: emailVerifications hoặc passwordResets (cùng cấu trúc bảng)
const issueOtp = async (model, user_id) => {
  const latest = await promisify(model.getByUserId)(user_id);
  if (latest) {
    const elapsed = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return { retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) };
    }
  }

  const otp = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await promisify(model.invalidateByUserId)(user_id);
  await promisify(model.insert)({ user_id, token: hashOtp(otp), expires_at });
  return { otp };
};

// Trả về record nếu đúng, ngược lại trả về { error } kèm thông báo
const checkOtp = async (model, user_id, otp) => {
  const record = await promisify(model.getByUserId)(user_id);
  if (!record) return { error: "Mã xác nhận không hợp lệ, vui lòng gửi lại mã" };
  if (new Date(record.expires_at) < new Date()) {
    return { error: "Mã xác nhận đã hết hạn, vui lòng gửi lại mã" };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { error: "Nhập sai quá nhiều lần, vui lòng gửi lại mã" };
  }

  const expected = Buffer.from(record.token, "hex");
  const actual = Buffer.from(hashOtp(String(otp || "").trim()), "hex");
  if (!crypto.timingSafeEqual(expected, actual)) {
    await promisify(model.incrementAttempts)(record.id);
    const left = MAX_ATTEMPTS - record.attempts - 1;
    return {
      error:
        left > 0
          ? `Mã xác nhận không đúng (còn ${left} lần thử)`
          : "Nhập sai quá nhiều lần, vui lòng gửi lại mã",
    };
  }

  await promisify(model.markAsUsed)(record.id);
  return { record };
};

module.exports = { issueOtp, checkOtp, OTP_TTL_MINUTES };
