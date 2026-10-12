require("dotenv").config();

// Gmail: SMTP_USER là địa chỉ Gmail, SMTP_PASS là App Password 16 ký tự
// (Google Account → Security → 2-Step Verification → App passwords)
const mailConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.MAIL_FROM || `SimpleChat <${process.env.SMTP_USER}>`,
};

module.exports = mailConfig;
