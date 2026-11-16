const crypto = require("crypto");
const { authenticator } = require("otplib");

// Chấp nhận lệch ±1 bước (±30 giây) giữa đồng hồ điện thoại và server
authenticator.options = { window: 1 };

const STEP_MS = 30 * 1000;
const RECOVERY_CODE_COUNT = 10;

// Khóa AES-256 mã hóa secret TOTP trong DB (lộ DB vẫn không tạo được mã).
// Thiếu / sai khóa: server vẫn chạy, chỉ không cho bật MFA mới.
const KEY = Buffer.from(process.env.MFA_ENC_KEY || "", "base64");
const isAvailable = KEY.length === 32;
if (!isAvailable) {
  console.warn("MFA_ENC_KEY chưa cấu hình (cần 32 byte base64) — chưa bật được đăng nhập 2 bước");
}

// AES-256-GCM, lưu dạng "iv.tag.ciphertext" (base64)
const encrypt = (text) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
};

const decrypt = (stored) => {
  const [iv, tag, data] = stored.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
};

// Trả về time-step của mã nếu đúng và mới hơn mã đã dùng lần trước (chống replay), ngược lại null.
// Việc "đánh dấu đã dùng" phải làm nguyên tử ở DB (users.claimMfaStep).
const checkTotp = (encryptedSecret, lastStep, code) => {
  const token = String(code || "").trim();
  if (!encryptedSecret || !/^\d{6}$/.test(token)) return null;
  const delta = authenticator.checkDelta(token, decrypt(encryptedSecret));
  if (delta === null) return null;
  const step = Math.floor(Date.now() / STEP_MS) + delta;
  if (lastStep != null && step <= Number(lastStep)) return null;
  return step;
};

// Mã khôi phục: 10 ký tự hex, hiển thị "abcde-12345"; người dùng nhập có/không dấu gạch đều được
const generateRecoveryCodes = () =>
  Array.from({ length: RECOVERY_CODE_COUNT }, () => crypto.randomBytes(5).toString("hex"));
const formatRecoveryCode = (code) => `${code.slice(0, 5)}-${code.slice(5)}`;
const normalizeRecoveryCode = (input) => {
  const code = String(input || "").toLowerCase().replace(/[^0-9a-f]/g, "");
  return code.length === 10 ? code : null;
};

module.exports = {
  authenticator,
  isAvailable,
  encrypt,
  checkTotp,
  generateRecoveryCodes,
  formatRecoveryCode,
  normalizeRecoveryCode,
};
