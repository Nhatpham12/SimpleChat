const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ status: "error", message: "Yêu cầu điền đầy đủ thông tin" });
  }
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({
      status: "error",
      message: "Username và password phải là chuỗi",
    });
  }
  if (username.trim().length === 0 || password.trim().length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Username và password không được để trống",
    });
  }
  next();
};

const validateRegister = (req, res, next) => {
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({
      status: "error",
      message: "Username, email và password là bắt buộc",
    });
  }
  if (
    typeof username !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      status: "error",
      message: "Username, email và password phải là chuỗi",
    });
  }
  if (username.trim().length < 3 || username.trim().length > 50) {
    return res.status(400).json({
      status: "error",
      message: "Username phải từ 3 đến 50 ký tự",
    });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res
      .status(400)
      .json({ status: "error", message: "Email không hợp lệ" });
  }
  if (password.length < 8) {
    return res.status(400).json({
      status: "error",
      message: "Password phải có ít nhất 8 ký tự",
    });
  }
  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({
      status: "error",
      message: "Mật khẩu xác nhận không khớp",
    });
  }
  next();
};

const validateMessage = (req, res, next) => {
  const { conversation_id, content } = req.body;
  if (!conversation_id) {
    return res.status(400).json({
      status: "error",
      message: "conversation_id là bắt buộc",
    });
  }
  if (content === undefined || content === null) {
    return res.status(400).json({
      status: "error",
      message: "Content là bắt buộc",
    });
  }
  if (typeof content !== "string") {
    return res.status(400).json({
      status: "error",
      message: "Content phải là chuỗi",
    });
  }
  if (content.trim().length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Content không được để trống",
    });
  }
  if (content.length > 5000) {
    return res.status(400).json({
      status: "error",
      message: "Content không được quá 5000 ký tự",
    });
  }
  next();
};

const validateChangePassword = (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      status: "error",
      message: "Mật khẩu cũ và mới là bắt buộc",
    });
  }
  if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({
      status: "error",
      message: "Mật khẩu phải là chuỗi",
    });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({
      status: "error",
      message: "Mật khẩu mới phải có ít nhất 8 ký tự",
    });
  }
  if (oldPassword === newPassword) {
    return res.status(400).json({
      status: "error",
      message: "Mật khẩu mới phải khác mật khẩu cũ",
    });
  }
  next();
};

module.exports = {
  validateLogin,
  validateRegister,
  validateMessage,
  validateChangePassword,
};
