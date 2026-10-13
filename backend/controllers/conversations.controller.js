const conversations = require("../models/conversation.model");
const participants = require("../models/participants.model");
const userContacts = require("../models/userContacts.model");
const db = require("../common/connect");

// Cho socket của các thành viên join room mới và báo client tải lại danh sách conversation
const notifyMembersAdded = (req, conversationId, memberIds) => {
  const io = req.app.get("io");
  if (!io) return;
  memberIds.forEach((memberId) => {
    io.in(`user:${memberId}`).socketsJoin(`conversation:${conversationId}`);
    io.to(`user:${memberId}`).emit("conversation_created", { conversation_id: Number(conversationId) });
  });
};

// Thêm lần lượt các thành viên vào conversation
const insertMembers = (conversationId, memberIds, callback) => {
  if (memberIds.length === 0) return callback(null);
  let added = 0;
  let failed = false;
  memberIds.forEach((memberId) => {
    participants.insert({ conversation_id: conversationId, user_id: memberId, role: "member" }, (err) => {
      if (failed) return;
      if (err) {
        failed = true;
        return callback(err);
      }
      added++;
      if (added === memberIds.length) callback(null);
    });
  });
};

const createDirect = (req, res, otherUserId) => {
  const userId = req.user.user_id;

  // Kiểm tra đã có conversation direct chưa
  const checkSql = `
    SELECT c.conversation_id
    FROM Conversations c
    INNER JOIN Participants p1 ON c.conversation_id = p1.conversation_id AND p1.user_id = ?
    INNER JOIN Participants p2 ON c.conversation_id = p2.conversation_id AND p2.user_id = ?
    WHERE c.type = 'direct'
    LIMIT 1
  `;
  db.query(checkSql, [userId, otherUserId], (err, existing) => {
    if (err) {
      return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra conversation đã tồn tại" });
    }
    if (existing.length > 0) {
      // Trả kèm id để client mở luôn cuộc trò chuyện cũ
      return res.status(409).json({
        status: "error",
        message: "Đã tồn tại cuộc trò chuyện trực tiếp với người này",
        data: { conversation_id: existing[0].conversation_id },
      });
    }

    conversations.insert({ type: "direct", conversation_name: null, created_by: userId }, (err, conversationId) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi tạo cuộc trò chuyện" });
      }
      participants.insert({ conversation_id: conversationId, user_id: userId, role: "admin" }, (err) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
        }
        insertMembers(conversationId, [otherUserId], (err) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
          }
          notifyMembersAdded(req, conversationId, [userId, otherUserId]);
          res.status(201).json({ status: "ok", message: "Tạo cuộc trò chuyện thành công", data: { conversation_id: conversationId } });
        });
      });
    });
  });
};

const createGroup = (req, res, conversation_name, memberIds) => {
  const userId = req.user.user_id;

  if (conversation_name && conversation_name.trim().length > 100) {
    return res.status(400).json({ status: "error", message: "Tên nhóm không được quá 100 ký tự" });
  }

  conversations.insert({ type: "group", conversation_name: conversation_name || null, created_by: userId }, (err, conversationId) => {
    if (err) {
      return res.status(500).json({ status: "error", message: "Lỗi khi tạo nhóm" });
    }
    participants.insert({ conversation_id: conversationId, user_id: userId, role: "admin" }, (err) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
      }
      insertMembers(conversationId, memberIds, (err) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
        }
        notifyMembersAdded(req, conversationId, [userId, ...memberIds]);
        res.status(201).json({ status: "ok", message: "Tạo nhóm thành công", data: { conversation_id: conversationId } });
      });
    });
  });
};

// Chỉ được chat / thêm vào nhóm những người đã chấp nhận lời mời kết bạn
const requireFriends = (res, userId, memberIds, next) => {
  userContacts.filterFriends(userId, memberIds, (err, friendIds) => {
    if (err) {
      return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra bạn bè" });
    }
    if (friendIds.length !== memberIds.length) {
      return res.status(403).json({
        status: "error",
        message: "Chỉ có thể trò chuyện với người đã chấp nhận lời mời kết bạn",
      });
    }
    next();
  });
};

const conversationsController = {
  // GET /api/conversations — danh sách conversations của user, mới nhắn gần nhất lên đầu
  getByUserId: (req, res) => {
    const userId = req.user.user_id;
    // - Direct: JOIN người còn lại để client hiển thị tên + avatar
    // - lm: tin nhắn mới nhất (message_id lớn nhất) để hiển thị preview và sắp xếp
    const sqlString = `
      SELECT c.conversation_id, c.type, c.conversation_name, c.avatar_url, c.created_by, c.created_at,
             ou.user_id AS other_user_id, ou.username AS other_username, ou.avatar_url AS other_avatar_url,
             lm.message_id AS last_message_id, lm.content AS last_content, lm.sender_id AS last_sender_id,
             lm.created_at AS last_created_at, lm.is_deleted AS last_is_deleted, lu.username AS last_sender_name
      FROM Conversations c
      INNER JOIN Participants p ON c.conversation_id = p.conversation_id AND p.user_id = ?
      LEFT JOIN Participants op ON c.type = 'direct' AND op.conversation_id = c.conversation_id AND op.user_id <> ?
      LEFT JOIN Users ou ON ou.user_id = op.user_id
      LEFT JOIN Messages lm ON lm.message_id = (
        SELECT MAX(m2.message_id) FROM Messages m2 WHERE m2.conversation_id = c.conversation_id
      )
      LEFT JOIN Users lu ON lu.user_id = lm.sender_id
      ORDER BY COALESCE(lm.created_at, c.created_at) DESC, c.conversation_id DESC
    `;
    db.query(sqlString, [userId, userId], (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy danh sách cuộc trò chuyện" });
      }
      const data = result.map(
        ({
          other_user_id, other_username, other_avatar_url,
          last_message_id, last_content, last_sender_id, last_created_at, last_is_deleted, last_sender_name,
          ...conv
        }) => ({
          ...conv,
          other_user: other_user_id
            ? { user_id: other_user_id, username: other_username, avatar_url: other_avatar_url }
            : null,
          last_message: last_message_id
            ? {
                message_id: last_message_id,
                content: last_content,
                sender_id: last_sender_id,
                sender_name: last_sender_name,
                created_at: last_created_at,
                is_deleted: !!last_is_deleted,
              }
            : null,
        })
      );
      res.json({ status: "ok", data });
    });
  },

  // GET /api/conversations/:id — lấy thông tin 1 conversation
  getById: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;

    conversations.getById(id, (err, conversation) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy thông tin cuộc trò chuyện" });
      }
      if (!conversation) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy cuộc trò chuyện" });
      }

      // Kiểm tra user có phải thành viên không
      participants.getOne(id, userId, (err, participant) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra thành viên" });
        }
        if (!participant) {
          return res.status(403).json({ status: "error", message: "Bạn không phải thành viên cuộc trò chuyện này" });
        }

        // Lấy danh sách thành viên
        participants.getByConversationId(id, (err, memberList) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi lấy danh sách thành viên" });
          }
          res.json({ status: "ok", data: { ...conversation, members: memberList } });
        });
      });
    });
  },

  // POST /api/conversations — tạo conversation mới (direct hoặc group)
  create: (req, res) => {
    const userId = req.user.user_id;
    const { type, conversation_name, member_ids } = req.body;

    if (!type || !["direct", "group"].includes(type)) {
      return res.status(400).json({ status: "error", message: "Type phải là 'direct' hoặc 'group'" });
    }

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({ status: "error", message: "member_ids phải là mảng không rỗng" });
    }

    const otherIds = [...new Set(member_ids.map(Number).filter((id) => id && id !== userId))];

    if (type === "direct" && otherIds.length !== 1) {
      return res.status(400).json({ status: "error", message: "Conversation direct chỉ có 1 thành viên khác" });
    }

    requireFriends(res, userId, otherIds, () => {
      if (type === "direct") return createDirect(req, res, otherIds[0]);
      createGroup(req, res, conversation_name, otherIds);
    });
  },

  // PUT /api/conversations/:id — cập nhật thông tin conversation (group)
  update: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;
    const { conversation_name, avatar_url } = req.body;

    conversations.getById(id, (err, conversation) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy thông tin cuộc trò chuyện" });
      }
      if (!conversation) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy cuộc trò chuyện" });
      }

      // Chỉ creator hoặc admin mới được cập nhật
      participants.getOne(id, userId, (err, participant) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra quyền" });
        }
        if (!participant || participant.role !== "admin") {
          return res.status(403).json({ status: "error", message: "Bạn không có quyền cập nhật cuộc trò chuyện này" });
        }

        const updateData = {
          conversation_name: conversation_name || conversation.conversation_name,
          avatar_url: avatar_url !== undefined ? avatar_url : conversation.avatar_url,
          type: conversation.type,
        };

        conversations.update(id, updateData, (err, success) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi cập nhật cuộc trò chuyện" });
          }
          if (!success) {
            return res.status(404).json({ status: "error", message: "Không tìm thấy cuộc trò chuyện" });
          }
          res.json({ status: "ok", message: "Cập nhật thành công" });
        });
      });
    });
  },

  // DELETE /api/conversations/:id — xóa conversation
  delete: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;

    conversations.getById(id, (err, conversation) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy thông tin cuộc trò chuyện" });
      }
      if (!conversation) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy cuộc trò chuyện" });
      }

      participants.getOne(id, userId, (err, participant) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra quyền" });
        }
        if (!participant || participant.role !== "admin") {
          return res.status(403).json({ status: "error", message: "Bạn không có quyền xóa cuộc trò chuyện này" });
        }

        conversations.delete(id, (err, success) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi xóa cuộc trò chuyện" });
          }
          if (!success) {
            return res.status(404).json({ status: "error", message: "Không tìm thấy cuộc trò chuyện" });
          }
          res.json({ status: "ok", message: "Xóa cuộc trò chuyện thành công" });
        });
      });
    });
  },

  // POST /api/conversations/:id/members — thêm thành viên vào group
  addMembers: (req, res) => {
    const { id } = req.params;
    const userId = req.user.user_id;
    const { member_ids } = req.body;

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({ status: "error", message: "member_ids phải là mảng không rỗng" });
    }

    conversations.getById(id, (err, conversation) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy thông tin cuộc trò chuyện" });
      }
      if (!conversation) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy cuộc trò chuyện" });
      }
      if (conversation.type === "direct") {
        return res.status(400).json({ status: "error", message: "Không thể thêm thành viên vào conversation trực tiếp" });
      }

      participants.getOne(id, userId, (err, participant) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra quyền" });
        }
        if (!participant || participant.role !== "admin") {
          return res.status(403).json({ status: "error", message: "Chỉ admin mới được thêm thành viên" });
        }

        const uniqueMembers = [...new Set(member_ids.map(Number).filter((mid) => mid && mid !== userId))];
        if (uniqueMembers.length === 0) {
          return res.json({ status: "ok", message: "Không có thành viên mới nào được thêm" });
        }

        requireFriends(res, userId, uniqueMembers, () => {
          let added = 0;
          let skipped = 0;
          let hasError = false;

          uniqueMembers.forEach((memberId) => {
            participants.getOne(id, memberId, (err, existing) => {
              if (hasError) return;
              if (err) {
                hasError = true;
                return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra thành viên" });
              }
              if (existing) {
                skipped++;
                if (added + skipped === uniqueMembers.length) {
                  res.json({ status: "ok", message: `Đã thêm ${added} thành viên, bỏ qua ${skipped} đã tồn tại` });
                }
                return;
              }
              participants.insert({ conversation_id: id, user_id: memberId, role: "member" }, (err) => {
                if (hasError) return;
                if (err) {
                  hasError = true;
                  return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
                }
                added++;
                notifyMembersAdded(req, id, [memberId]);
                if (added + skipped === uniqueMembers.length) {
                  res.json({ status: "ok", message: `Đã thêm ${added} thành viên, bỏ qua ${skipped} đã tồn tại` });
                }
              });
            });
          });
        });
      });
    });
  },

  // DELETE /api/conversations/:id/members/:memberId — xóa thành viên khỏi group
  removeMember: (req, res) => {
    const { id, memberId } = req.params;
    const userId = req.user.user_id;

    conversations.getById(id, (err, conversation) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy thông tin cuộc trò chuyện" });
      }
      if (!conversation) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy cuộc trò chuyện" });
      }
      if (conversation.type === "direct") {
        return res.status(400).json({ status: "error", message: "Không thể xóa thành viên khỏi conversation trực tiếp" });
      }

      participants.getOne(id, userId, (err, adminParticipant) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi kiểm tra quyền" });
        }

        const isSelf = parseInt(memberId) === userId;
        const isAdmin = adminParticipant && adminParticipant.role === "admin";

        if (!isSelf && !isAdmin) {
          return res.status(403).json({ status: "error", message: "Bạn không có quyền xóa thành viên này" });
        }

        participants.delete(id, memberId, (err, success) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi xóa thành viên" });
          }
          if (!success) {
            return res.status(404).json({ status: "error", message: "Thành viên không tồn tại trong nhóm" });
          }
          req.app.get("io")?.in(`user:${memberId}`).socketsLeave(`conversation:${id}`);
          res.json({ status: "ok", message: "Đã xóa thành viên khỏi nhóm" });
        });
      });
    });
  },
};

module.exports = conversationsController;
