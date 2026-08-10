const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users.controller");
const { requireRole } = require("../middlewares/auth.middleware");

router.get("/profile", usersController.getProfile);
router.get("/search", usersController.search);
router.get("/", usersController.getAll);
router.get("/:id", usersController.getById);
router.put("/:id", usersController.updateProfile);
router.patch("/:id/avatar", usersController.updateAvatar);
router.patch("/:id/status", usersController.updateStatus);
router.patch("/:id/role", requireRole("admin"), usersController.updateRole);
router.delete("/:id", requireRole("admin"), usersController.delete);

module.exports = router;
