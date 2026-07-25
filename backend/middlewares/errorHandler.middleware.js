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

  // Lỗi không xác định (default)
  res.status(err.statusCode || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
};

module.exports = { globalErrorHandler };
