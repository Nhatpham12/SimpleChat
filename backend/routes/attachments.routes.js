const express = require("express");
const router = express.Router();
const attachmentsController = require("../controllers/attachments.controller");

router.get("/:messageId", attachmentsController.getByMessageId);
router.post("/", attachmentsController.create);
router.delete("/:attachmentId", attachmentsController.delete);

module.exports = router;
