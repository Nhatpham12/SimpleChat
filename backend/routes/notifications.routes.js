const express = require("express");
const router = express.Router();
const notificationsController = require("../controllers/notifications.controller");

router.get("/", notificationsController.getByUserId);
router.get("/unread-count", notificationsController.getUnreadCount);
router.post("/", notificationsController.create);
router.patch("/:id/seen", notificationsController.markAsSeen);
router.patch("/seen-all", notificationsController.markAllAsSeen);
router.delete("/:id", notificationsController.delete);

module.exports = router;
