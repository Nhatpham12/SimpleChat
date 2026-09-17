const express = require("express");
const router = express.Router();

const userRoutes = require("./users.routes");
const conversationRoutes = require("./conversations.routes");
const messageRoutes = require("./messages.routes");
const contactRoutes = require("./contacts.routes");
const notificationRoutes = require("./notifications.routes");
const groupSettingsRoutes = require("./groupSettings.routes");
const blockedUsersRoutes = require("./blockedUsers.routes");
const attachmentRoutes = require("./attachments.routes");

router.use("/users", userRoutes);
router.use("/conversations", conversationRoutes);
router.use("/messages", messageRoutes);
router.use("/contacts", contactRoutes);
router.use("/notifications", notificationRoutes);
router.use("/group-settings", groupSettingsRoutes);
router.use("/blocked", blockedUsersRoutes);
router.use("/attachments", attachmentRoutes);

module.exports = router;
