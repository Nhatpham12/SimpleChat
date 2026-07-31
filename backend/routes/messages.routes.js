const express = require("express");
const router = express.Router();
const messagesController = require("../controllers/messages.controller");
const { validateMessage } = require("../middlewares/validation.middlewares");

router.get("/single/:messageId", messagesController.getById);
router.patch("/conversation/:conversationId/read", messagesController.markAllAsRead);
router.get("/:conversationId/unread", messagesController.getUnreadCount);
router.get("/:conversationId", messagesController.getByConversationId);
router.post("/", validateMessage, messagesController.create);
router.put("/:messageId", messagesController.update);
router.delete("/:messageId", messagesController.delete);
router.patch("/:messageId/read", messagesController.markAsRead);

module.exports = router;
