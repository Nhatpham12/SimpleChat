const userContacts = require("../models/userContacts.model");
const users = require("../models/users.model");
const blockedUsers = require("../models/blockedUsers.model");

const contactsController = {
  // GET /api/contacts — lấy danh sách bạn bè (đã chấp nhận)
  getAll: (req, res) => {
    const userId = req.user.user_id;
    userContacts.getByUserId(userId, (err, contacts) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy danh sách liên hệ" });
      }

      const acceptedContacts = contacts.filter((c) => c.status === "accepted");
      if (acceptedContacts.length === 0) {
        return res.json({ status: "ok", data: [] });
      }

      const friendIds = acceptedContacts.map((c) => (c.user_id === userId ? c.friend_id : c.user_id));
      let friends = [];
      let loaded = 0;

      friendIds.forEach((friendId) => {
        users.getById(friendId, (err, user) => {
          if (!err && user) {
            friends.push(user);
          }
          loaded++;
          if (loaded === friendIds.length) {
            res.json({ status: "ok", data: friends });
          }
        });
      });
    });
  },

  // GET /api/contacts/pending — lấy danh sách yêu cầu kết bạn chờ xử lý
  getPending: (req, res) => {
    const userId = req.user.user_id;
    userContacts.getPending(userId, (err, contacts) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy yêu cầu kết bạn" });
      }

      // Phân biệt request gửi đến mình và mình gửi đi
      const incoming = contacts.filter((c) => c.friend_id === userId && c.status === "pending");
      const outgoing = contacts.filter((c) => c.user_id === userId && c.status === "pending");

      // Lấy thông tin user cho incoming requests
      if (incoming.length === 0) {
        return res.json({ status: "ok", data: { incoming: [], outgoing } });
      }

      let enrichedIncoming = [];
      let loaded = 0;

      incoming.forEach((contact) => {
        users.getById(contact.user_id, (err, user) => {
          enrichedIncoming.push({ ...contact, user: user || null });
          loaded++;
          if (loaded === incoming.length) {
            res.json({ status: "ok", data: { incoming: enrichedIncoming, outgoing } });
          }
        });
      });
    });
  },

  // POST /api/contacts/request — gửi yêu cầu kết bạn
  sendRequest: (req, res) => {
    const userId = req.user.user_id;
    const { friend_id } = req.body;

    if (!friend_id) {
      return res.status(400).json({ status: "error", message: "friend_id là bắt buộc" });
    }

    if (parseInt(friend_id) === userId) {
      return res.status(400).json({ status: "error", message: "Không thể kết bạn với chính mình" });
    }

    // Kiểm tra friend có tồn tại không
    users.getById(friend_id, (err, friend) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm kiếm người dùng" });
      }
      if (!friend) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy người dùng" });
      }

      // Kiểm tra có bị chặn không
      blockedUsers.isBlocked(userId, friend_id, (err, blocked) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra chặn" });
        }
        if (blocked) {
          return res.status(403).json({ status: "error", message: "Không thể gửi yêu cầu kết bạn đến người dùng này" });
        }

        // Kiểm tra对方 đã chặn mình chưa
        blockedUsers.isBlocked(friend_id, userId, (err, reverseBlocked) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra chặn" });
          }
          if (reverseBlocked) {
            return res.status(403).json({ status: "error", message: "Không thể gửi yêu cầu kết bạn đến người dùng này" });
          }

          // Kiểm tra đã tồn tại liên hệ chưa
          userContacts.getOne(userId, friend_id, (err, existing) => {
            if (err) {
              return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra liên hệ" });
            }
            if (existing) {
              if (existing.status === "pending") {
                return res.status(409).json({ status: "error", message: "Đã gửi yêu cầu kết bạn rồi" });
              }
              if (existing.status === "accepted") {
                return res.status(409).json({ status: "error", message: "Đã là bạn bè rồi" });
              }
            }

            // Kiểm tra对方 đã gửi cho mình chưa
            userContacts.getOne(friend_id, userId, (err, reverseExisting) => {
              if (err) {
                return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra liên hệ" });
              }
              if (reverseExisting && reverseExisting.status === "pending") {
                // Nếu对方 đã gửi cho mình, tự động chấp nhận
                userContacts.updateStatus(friend_id, userId, "accepted", (err) => {
                  if (err) {
                    return res.status(500).json({ status: "error", message: "Lỗi khi chấp nhận kết bạn" });
                  }
                  return res.json({ status: "ok", message: "Đã trở thành bạn bè" });
                });
                return;
              }
              if (reverseExisting && reverseExisting.status === "accepted") {
                return res.status(409).json({ status: "error", message: "Đã là bạn bè rồi" });
              }

              // Tạo yêu cầu kết bạn mới
              userContacts.insert({ user_id: userId, friend_id, status: "pending" }, (err, contactId) => {
                if (err) {
                  return res.status(500).json({ status: "error", message: "Lỗi khi gửi yêu cầu kết bạn" });
                }
                res.status(201).json({ status: "ok", message: "Đã gửi yêu cầu kết bạn", data: { contact_id: contactId } });
              });
            });
          });
        });
      });
    });
  },

  // PUT /api/contacts/accept/:contactId — chấp nhận yêu cầu kết bạn
  accept: (req, res) => {
    const { contactId } = req.params;
    const userId = req.user.user_id;

    // Tìm contact theo ID — cần query trực tiếp vì model không có getById
    const db = require("../common/connect");
    const sqlString = `SELECT * FROM UserContacts WHERE contact_id = ?`;
    db.query(sqlString, [contactId], (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm yêu cầu kết bạn" });
      }
      if (!result || result.length === 0) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy yêu cầu kết bạn" });
      }

      const contact = result[0];

      // Chỉ người nhận mới được chấp nhận
      if (contact.friend_id !== userId) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền chấp nhận yêu cầu này" });
      }

      if (contact.status !== "pending") {
        return res.status(400).json({ status: "error", message: "Yêu cầu kết bạn đã được xử lý" });
      }

      userContacts.updateStatus(contact.user_id, contact.friend_id, "accepted", (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi chấp nhận yêu cầu kết bạn" });
        }
        if (!success) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy yêu cầu kết bạn" });
        }
        res.json({ status: "ok", message: "Đã chấp nhận yêu cầu kết bạn" });
      });
    });
  },

  // DELETE /api/contacts/reject/:contactId — từ chối yêu cầu kết bạn
  reject: (req, res) => {
    const { contactId } = req.params;
    const userId = req.user.user_id;

    const db = require("../common/connect");
    const sqlString = `SELECT * FROM UserContacts WHERE contact_id = ?`;
    db.query(sqlString, [contactId], (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm yêu cầu kết bạn" });
      }
      if (!result || result.length === 0) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy yêu cầu kết bạn" });
      }

      const contact = result[0];

      if (contact.friend_id !== userId) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền từ chối yêu cầu này" });
      }

      if (contact.status !== "pending") {
        return res.status(400).json({ status: "error", message: "Yêu cầu kết bạn đã được xử lý" });
      }

      userContacts.delete(contact.user_id, contact.friend_id, (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi từ chối yêu cầu kết bạn" });
        }
        if (!success) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy yêu cầu kết bạn" });
        }
        res.json({ status: "ok", message: "Đã từ chối yêu cầu kết bạn" });
      });
    });
  },

  // DELETE /api/contacts/:friendId — hủy bạn bè
  remove: (req, res) => {
    const { friendId } = req.params;
    const userId = req.user.user_id;

    userContacts.delete(userId, friendId, (err, success) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi hủy kết bạn" });
      }
      if (!success) {
        // Thử theo chiều ngược lại
        userContacts.delete(friendId, userId, (err2, success2) => {
          if (err2) {
            return res.status(500).json({ status: "error", message: "Lỗi khi hủy kết bạn" });
          }
          if (!success2) {
            return res.status(404).json({ status: "error", message: "Không tìm thấy mối quan hệ bạn bè" });
          }
          res.json({ status: "ok", message: "Đã hủy kết bạn" });
        });
        return;
      }
      res.json({ status: "ok", message: "Đã hủy kết bạn" });
    });
  },

  // GET /api/contacts/check/:friendId — kiểm tra trạng thái kết bạn
  checkStatus: (req, res) => {
    const { friendId } = req.params;
    const userId = req.user.user_id;

    userContacts.getOne(userId, friendId, (err, contact) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra trạng thái" });
      }
      if (!contact) {
        return res.json({ status: "ok", data: { status: "none" } });
      }
      res.json({ status: "ok", data: { status: contact.status, contact_id: contact.contact_id } });
    });
  },
};

module.exports = contactsController;
