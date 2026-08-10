const express = require("express");
const router = express.Router();
const contactsController = require("../controllers/contacts.controller");

router.get("/", contactsController.getAll);
router.get("/pending", contactsController.getPending);
router.get("/check/:friendId", contactsController.checkStatus);
router.post("/request", contactsController.sendRequest);
router.put("/accept/:contactId", contactsController.accept);
router.delete("/reject/:contactId", contactsController.reject);
router.delete("/:friendId", contactsController.remove);

module.exports = router;
