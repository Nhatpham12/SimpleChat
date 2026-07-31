const express = require("express");
const router = express.Router();
const conversationsController = require("../controllers/conversations.controller");

router.get("/", conversationsController.getByUserId);
router.get("/:id", conversationsController.getById);
router.post("/", conversationsController.create);
router.put("/:id", conversationsController.update);
router.delete("/:id", conversationsController.delete);
router.post("/:id/members", conversationsController.addMembers);
router.delete("/:id/members/:memberId", conversationsController.removeMember);

module.exports = router;
