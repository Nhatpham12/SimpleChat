const userContacts = require("../models/userContacts.model");
const users = require("../models/users.model");
const blockedUsers = require("../models/blockedUsers.model");

// Báo realtime cho các user liên quan để client tải lại danh bạ / hiện pop-up.
// Kèm thông tin người thực hiện (actorKey: from_user | by_user) để pop-up hiện tên + avatar.
const notifyContactChange = (req, userIds, event, payload, actorKey = "by_user") => {
  const io = req.app.get("io");
  if (!io) return;
  users.getById(req.user.user_id, (err, actor) => {
    const actorInfo = actor
      ? { user_id: actor.user_id, username: actor.username, avatar_url: actor.avatar_url }
      : { user_id: req.user.user_id, username: req.user.username };
    userIds.forEach((id) => io.to(`user:${id}`).emit(event, { ...payload, [actorKey]: actorInfo }));
  });
};

const contactsController = {
  // GET /api/contacts — lấy danh sách bạn bè (đã chấp nhận)
  getAll: (req, res) => {
    const userId = req.user.user_id;
    userContacts.getFriends(userId, (err, friends) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy danh sách liên hệ" });
      }
      res.json({ status: "ok", data: friends });
    });
  },

  // GET /api/contacts/pending — lấy danh sách yêu cầu kết bạn chờ xử lý
  getPending: (req, res) => {
    const userId = req.user.user_id;
    userContacts.getPending(userId, (err, contacts) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy yêu cầu kết bạn" });
      }

      // user = người phía bên kia (người gửi với incoming, người nhận với outgoing)
      const withUser = contacts.map(({ other_id, other_username, other_email, other_avatar_url, ...c }) => ({
        ...c,
        user: { user_id: other_id, username: other_username, email: other_email, avatar_url: other_avatar_url },
      }));

      res.json({
        status: "ok",
        data: {
          incoming: withUser.filter((c) => c.friend_id === userId),
          outgoing: withUser.filter((c) => c.user_id === userId),
        },
      });
    });
  },

  // POST /api/contacts/request — gửi yêu cầu kết bạn
  sendRequest: (req, res) => {
    const userId = req.user.user_id;
    const friendId = parseInt(req.body.friend_id);

    if (!friendId) {
      return res.status(400).json({ status: "error", message: "friend_id là bắt buộc" });
    }

    if (friendId === userId) {
      return res.status(400).json({ status: "error", message: "Không thể kết bạn với chính mình" });
    }

    users.getById(friendId, (err, friend) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm kiếm người dùng" });
      }
      if (!friend) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy người dùng" });
      }

      // Kiểm tra chặn theo cả 2 chiều
      blockedUsers.isBlocked(userId, friendId, (err, blocked) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra chặn" });
        }
        blockedUsers.isBlocked(friendId, userId, (err, reverseBlocked) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra chặn" });
          }
          if (blocked || reverseBlocked) {
            return res.status(403).json({ status: "error", message: "Không thể gửi yêu cầu kết bạn đến người dùng này" });
          }

          userContacts.getBetween(userId, friendId, (err, existing) => {
            if (err) {
              return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra liên hệ" });
            }

            if (existing) {
              if (existing.status === "accepted") {
                return res.status(409).json({ status: "error", message: "Đã là bạn bè rồi" });
              }
              if (existing.status === "pending" && existing.user_id === userId) {
                return res.status(409).json({ status: "error", message: "Đã gửi yêu cầu kết bạn rồi, đang chờ chấp nhận" });
              }
              if (existing.status === "pending") {
                // Người kia đã gửi lời mời cho mình → không tự kết bạn, bắt người dùng bấm "Chấp nhận"
                return res.status(409).json({
                  status: "error",
                  message: "Người này đã gửi lời mời cho bạn, hãy chấp nhận trong mục Yêu cầu",
                  data: { contact_id: existing.contact_id },
                });
              }
              return res.status(403).json({ status: "error", message: "Không thể gửi yêu cầu kết bạn đến người dùng này" });
            }

            userContacts.insert({ user_id: userId, friend_id: friendId, status: "pending" }, (err, contactId) => {
              if (err) {
                return res.status(500).json({ status: "error", message: "Lỗi khi gửi yêu cầu kết bạn" });
              }
              notifyContactChange(req, [friendId], "contact_request", { contact_id: contactId }, "from_user");
              res.status(201).json({ status: "ok", message: "Đã gửi yêu cầu kết bạn, đang chờ chấp nhận", data: { contact_id: contactId } });
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

    userContacts.getById(contactId, (err, contact) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm yêu cầu kết bạn" });
      }
      if (!contact) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy yêu cầu kết bạn" });
      }

      // Chỉ người nhận mới được chấp nhận
      if (contact.friend_id !== userId) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền chấp nhận yêu cầu này" });
      }

      if (contact.status !== "pending") {
        return res.status(400).json({ status: "error", message: "Yêu cầu kết bạn đã được xử lý" });
      }

      userContacts.updateStatusById(contact.contact_id, "accepted", (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi chấp nhận yêu cầu kết bạn" });
        }
        if (!success) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy yêu cầu kết bạn" });
        }
        notifyContactChange(req, [contact.user_id, contact.friend_id], "contact_updated", { contact_id: contact.contact_id, status: "accepted" });
        res.json({ status: "ok", message: "Đã chấp nhận yêu cầu kết bạn" });
      });
    });
  },

  // DELETE /api/contacts/reject/:contactId — từ chối (người nhận) hoặc hủy (người gửi) yêu cầu kết bạn
  reject: (req, res) => {
    const { contactId } = req.params;
    const userId = req.user.user_id;

    userContacts.getById(contactId, (err, contact) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tìm yêu cầu kết bạn" });
      }
      if (!contact) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy yêu cầu kết bạn" });
      }

      if (contact.friend_id !== userId && contact.user_id !== userId) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền xử lý yêu cầu này" });
      }

      if (contact.status !== "pending") {
        return res.status(400).json({ status: "error", message: "Yêu cầu kết bạn đã được xử lý" });
      }

      userContacts.deleteById(contact.contact_id, (err, success) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi từ chối yêu cầu kết bạn" });
        }
        if (!success) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy yêu cầu kết bạn" });
        }
        notifyContactChange(req, [contact.user_id, contact.friend_id], "contact_updated", { contact_id: contact.contact_id, status: "none" });
        const message = contact.user_id === userId ? "Đã hủy lời mời kết bạn" : "Đã từ chối yêu cầu kết bạn";
        res.json({ status: "ok", message });
      });
    });
  },

  // DELETE /api/contacts/:friendId — hủy bạn bè
  remove: (req, res) => {
    const friendId = parseInt(req.params.friendId);
    const userId = req.user.user_id;

    userContacts.getBetween(userId, friendId, (err, contact) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi hủy kết bạn" });
      }
      if (!contact || contact.status !== "accepted") {
        return res.status(404).json({ status: "error", message: "Không tìm thấy mối quan hệ bạn bè" });
      }
      userContacts.deleteById(contact.contact_id, (err) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi hủy kết bạn" });
        }
        notifyContactChange(req, [userId, friendId], "contact_updated", { contact_id: contact.contact_id, status: "none" });
        res.json({ status: "ok", message: "Đã hủy kết bạn" });
      });
    });
  },

  // GET /api/contacts/check/:friendId — kiểm tra trạng thái kết bạn (cả 2 chiều)
  checkStatus: (req, res) => {
    const friendId = parseInt(req.params.friendId);
    const userId = req.user.user_id;

    userContacts.getBetween(userId, friendId, (err, contact) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra trạng thái" });
      }
      if (!contact) {
        return res.json({ status: "ok", data: { status: "none" } });
      }
      res.json({
        status: "ok",
        data: {
          status: contact.status,
          contact_id: contact.contact_id,
          direction: contact.user_id === userId ? "outgoing" : "incoming",
        },
      });
    });
  },
};

module.exports = contactsController;
