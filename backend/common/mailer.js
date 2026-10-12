const nodemailer = require("nodemailer");
const config = require("../config");

const { host, port, user, pass, from } = config.mail;

const transporter =
  user && pass
    ? nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      })
    : null;

if (!transporter) {
  console.warn("SMTP chưa cấu hình (SMTP_USER/SMTP_PASS) — OTP sẽ chỉ in ra log");
}

const PURPOSES = {
  verify: {
    subject: "Mã xác nhận đăng ký SimpleChat",
    intro: "Cảm ơn bạn đã đăng ký SimpleChat. Mã xác nhận email của bạn là:",
  },
  reset: {
    subject: "Mã đặt lại mật khẩu SimpleChat",
    intro: "Bạn vừa yêu cầu đặt lại mật khẩu SimpleChat. Mã xác nhận của bạn là:",
  },
};

const sendOtpMail = async (to, otp, purpose, ttlMinutes) => {
  const { subject, intro } = PURPOSES[purpose];
  const outro = `Mã có hiệu lực trong ${ttlMinutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`;

  if (!transporter) {
    // Dev: in OTP ra log. Prod: báo lỗi thay vì giả vờ đã gửi
    if (config.app.nodeEnv !== "production") {
      console.log(`[mail:dev] ${subject} → ${to}: ${otp}`);
      return;
    }
    throw mailError("SMTP chưa cấu hình (SMTP_USER/SMTP_PASS)");
  }

  try {
    await sendWithTransporter(to, subject, intro, otp, outro);
  } catch (err) {
    throw mailError(err.message);
  }
};

const mailError = (reason) => {
  console.error("Gửi email thất bại:", reason);
  const err = new Error("Không gửi được email, vui lòng thử lại sau");
  err.statusCode = 503;
  return err;
};

const sendWithTransporter = (to, subject, intro, otp, outro) =>
  transporter.sendMail({
    from,
    to,
    subject,
    text: `${intro} ${otp}\n\n${outro}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#4f46e5">SimpleChat</h2>
        <p>${intro}</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0">${otp}</p>
        <p style="color:#6b7280;font-size:13px">${outro}</p>
      </div>`,
  });

module.exports = { sendOtpMail };
