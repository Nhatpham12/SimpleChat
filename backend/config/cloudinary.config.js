const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
const DOC_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
];

// multer 1.x đọc tên file theo latin1 → đổi lại UTF-8 để giữ tiếng Việt
const fixFileName = (file) => {
  file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
};

// Ảnh/video giữ resource_type tương ứng (có thumbnail); tài liệu lưu dạng raw kèm đuôi file
// để link tải về đúng định dạng (Cloudinary chặn giao PDF dạng image ở tài khoản free)
const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    if (IMAGE_MIMES.includes(file.mimetype)) return { folder: "simplechat/chat", resource_type: "image" };
    if (VIDEO_MIMES.includes(file.mimetype)) return { folder: "simplechat/chat", resource_type: "video" };
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 60) || "file";
    return {
      folder: "simplechat/files",
      resource_type: "raw",
      public_id: `${Date.now()}_${base}${ext}`,
    };
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "simplechat/avatars",
    resource_type: "image",
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  },
});

const makeFilter = (allowed) => (req, file, cb) => {
  fixFileName(file);
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(Object.assign(new Error("Định dạng file không được hỗ trợ"), { status: 400 }), false);
};

const upload = multer({
  storage: chatStorage,
  fileFilter: makeFilter([...IMAGE_MIMES, ...VIDEO_MIMES, ...DOC_MIMES]),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: makeFilter(IMAGE_MIMES),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Bọc middleware multer để trả lỗi JSON dễ hiểu thay vì 500
const handleUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ status: "error", message: "File quá lớn" });
    }
    console.error("Upload error:", err.message);
    res.status(err.status || 500).json({ status: "error", message: err.status ? err.message : "Upload thất bại, thử lại sau" });
  });
};

module.exports = {
  cloudinary,
  IMAGE_MIMES,
  uploadChatFile: handleUpload(upload.single("file")),
  uploadAvatar: handleUpload(avatarUpload.single("avatar")),
};
