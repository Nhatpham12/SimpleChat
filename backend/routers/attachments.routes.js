const express = require("express");
const router = express.Router();
const attachmentsController = require("../controllers/attachments.controller");
const { upload } = require("../config/cloudinary.config");

router.get("/:messageId", attachmentsController.getByMessageId);
router.post("/", upload.single("file"), attachmentsController.create);
router.delete("/:attachmentId", attachmentsController.delete);

module.exports = router;
