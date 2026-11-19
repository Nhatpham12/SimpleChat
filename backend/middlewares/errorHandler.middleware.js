const globalErrorHandler = (err, req, res, next) => {
  console.error("Error: ", err.message);

  //lỗi validate từ DB
  if (err.code === "ER_BAD_FIELD_ERROR") {
    return res
      .status(500)
      .json({ status: "error", message: "Lỗi cấu trúc database" });
  }

  // Lỗi MySQL duplicate entry
  if (err.code === "ER_DUP_ENTRY") {
    return res
      .status(409)
      .json({ status: "error", message: "Dữ liệu đã tồn tại" });
  }

  // Lỗi JWT
  if (err.name === "JsonWebTokenError") {
    return res
      .status(401)
      .json({ status: "error", message: "Token không hợp lệ" });
  }

  if (err.name === "TokenExpiredError") {
    return res
      .status(401)
      .json({ status: "error", message: "Token đã hết hạn" });
  }

  // Lỗi 4xx (multer, body-parser...) có thông báo dành cho người dùng; lỗi 5xx chỉ trả thông báo chung,
  // chi tiết đã log ở trên (không lộ thông tin nội bộ ra client).
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    status: "error",
    message: status < 500 || err.expose ? err.message : "Lỗi máy chủ, vui lòng thử lại sau",
  });
};

module.exports = { globalErrorHandler };
