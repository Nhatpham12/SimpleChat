const express = require("express");
const router = express.Router();
const attachmentsController = require("../controllers/attachments.controller");
const { uploadChatFile } = require("../config/cloudinary.config");

router.get("/:messageId", attachmentsController.getByMessageId);
router.post("/", uploadChatFile, attachmentsController.create);
router.delete("/:attachmentId", attachmentsController.delete);

module.exports = router;
