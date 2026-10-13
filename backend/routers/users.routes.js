const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users.controller");
const { requireRole } = require("../middlewares/auth.middleware");

router.get("/profile", usersController.getProfile);
router.get("/search", usersController.search);
// Danh sách toàn bộ user (kèm email) chỉ dành cho admin; quản trị khác nằm ở /api/admin
router.get("/", requireRole("admin"), usersController.getAll);
router.get("/:id", usersController.getById);
router.put("/:id", usersController.updateProfile);
router.patch("/:id/avatar", usersController.updateAvatar);
router.patch("/:id/status", usersController.updateStatus);

module.exports = router;
