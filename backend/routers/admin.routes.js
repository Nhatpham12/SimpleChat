const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { requireRole } = require("../middlewares/auth.middleware");

// verifyToken đã chạy ở /api; role được đọc lại từ DB nên hạ quyền có hiệu lực ngay
router.use(requireRole("admin"));

router.get("/stats", adminController.stats);
router.get("/users", adminController.listUsers);
router.patch("/users/:id/role", adminController.updateRole);
router.patch("/users/:id/lock", adminController.setLocked);
router.patch("/users/:id/verify", adminController.verifyEmail);
router.delete("/users/:id", adminController.deleteUser);

module.exports = router;
