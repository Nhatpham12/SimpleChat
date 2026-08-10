const express = require("express");
const router = express.Router();
const groupSettingsController = require("../controllers/groupSettings.controller");

router.get("/:conversationId", groupSettingsController.getByConversationId);
router.get("/:conversationId/:settingName", groupSettingsController.getOne);
router.put("/:conversationId", groupSettingsController.upsert);
router.delete("/:conversationId/:settingName", groupSettingsController.delete);

module.exports = router;
