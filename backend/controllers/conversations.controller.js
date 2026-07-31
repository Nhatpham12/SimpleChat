const conversations = require("../models/conversation.model");
const participants = require("../models/participants.model");
const db = require("../common/connect");

const conversationsController = {
  // GET /api/conversations — lấy danh sách conversations của user
  getByUserId: (req, res) => {
    const userId = req.user.user_id;
    const sqlString = `
      SELECT c.conversation_id, c.type, c.conversation_name, c.avatar_url, c.created_by, c.created_at
      FROM Conversations c
      INNER JOIN Participants p ON c.conversation_id = p.conversation_id
      WHERE p.user_id = ?
      ORDER BY c.created_at DESC
    `;
    db.query(sqlString, [userId], (err, result) => {
      if (err) {
        return res.status(500).json({ status: "error", message: "Lỗi khi lấy danh sách cuộc trò chuyện" });
      }
      res.json({ status: "ok", data: result });
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

    // Conversation direct: chỉ 1 người对方
    if (type === "direct") {
      if (member_ids.length !== 1) {
        return res.status(400).json({ status: "error", message: "Conversation direct chỉ có 1 thành viên khác" });
      }

      const otherUserId = member_ids[0];

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
          return res.status(409).json({ status: "error", message: "Đã tồn tại cuộc trò chuyện trực tiếp với người này" });
        }

        // Tạo conversation direct
        conversations.insert({ type: "direct", conversation_name: null, created_by: userId }, (err, conversationId) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi tạo cuộc trò chuyện" });
          }

          // Thêm 2 thành viên
          participants.insert({ conversation_id: conversationId, user_id: userId, role: "admin" }, (err) => {
            if (err) {
              return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
            }
            participants.insert({ conversation_id: conversationId, user_id: otherUserId, role: "member" }, (err) => {
              if (err) {
                return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
              }
              res.status(201).json({ status: "ok", message: "Tạo cuộc trò chuyện thành công", data: { conversation_id: conversationId } });
            });
          });
        });
      });
    } else {
      // Group conversation
      if (conversation_name && conversation_name.trim().length > 100) {
        return res.status(400).json({ status: "error", message: "Tên nhóm không được quá 100 ký tự" });
      }

      conversations.insert({ type: "group", conversation_name: conversation_name || null, created_by: userId }, (err, conversationId) => {
        if (err) {
          return res.status(500).json({ status: "error", message: "Lỗi khi tạo nhóm" });
        }

        // Thêm creator là admin
        participants.insert({ conversation_id: conversationId, user_id: userId, role: "admin" }, (err) => {
          if (err) {
            return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
          }

          // Thêm các thành viên còn lại
          const uniqueMembers = [...new Set(member_ids.filter((id) => id !== userId))];
          if (uniqueMembers.length === 0) {
            return res.status(201).json({ status: "ok", message: "Tạo nhóm thành công", data: { conversation_id: conversationId } });
          }

          let added = 0;
          let hasError = false;
          uniqueMembers.forEach((memberId) => {
            participants.insert({ conversation_id: conversationId, user_id: memberId, role: "member" }, (err) => {
              if (hasError) return;
              if (err) {
                hasError = true;
                return res.status(500).json({ status: "error", message: "Lỗi khi thêm thành viên" });
              }
              added++;
              if (added === uniqueMembers.length) {
                res.status(201).json({ status: "ok", message: "Tạo nhóm thành công", data: { conversation_id: conversationId } });
              }
            });
          });
        });
      });
    }
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

        let added = 0;
        let skipped = 0;
        let hasError = false;
        const uniqueMembers = [...new Set(member_ids)];

        if (uniqueMembers.length === 0) {
          return res.json({ status: "ok", message: "Không có thành viên mới nào được thêm" });
        }

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
              if (added + skipped === uniqueMembers.length) {
                res.json({ status: "ok", message: `Đã thêm ${added} thành viên, bỏ qua ${skipped} đã tồn tại` });
              }
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
          res.json({ status: "ok", message: "Đã xóa thành viên khỏi nhóm" });
        });
      });
    });
  },
};

module.exports = conversationsController;
