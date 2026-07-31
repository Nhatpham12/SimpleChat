const express = require("express");
const router = express.Router();
const blockedUsersController = require("../controllers/blockedUsers.controller");

router.get("/", blockedUsersController.getByUserId);
router.get("/check/:blockedUserId", blockedUsersController.checkBlocked);
router.post("/", blockedUsersController.block);
router.delete("/:blockedUserId", blockedUsersController.unblock);

module.exports = router;
