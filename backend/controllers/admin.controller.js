const db = require("../common/connect");
const { getOnlineUserIds } = require("../socket/onlineUsers");

const q = (sql, args = []) =>
  new Promise((resolve, reject) => db.query(sql, args, (err, rows) => (err ? reject(err) : resolve(rows))));

const FILTERS = {
  all: "1 = 1",
  verified: "u.is_verified = TRUE AND u.is_locked = FALSE",
  unverified: "u.is_verified = FALSE",
  locked: "u.is_locked = TRUE",
  admin: "u.role = 'admin'",
};

const SORTS = {
  newest: "u.created_at DESC, u.user_id DESC",
  oldest: "u.created_at ASC, u.user_id ASC",
  name: "u.username ASC",
  messages: "message_count DESC, u.user_id DESC",
};

const toPublic = (row, onlineSet) => ({
  user_id: row.user_id,
  username: row.username,
  email: row.email,
  role: row.role,
  avatar_url: row.avatar_url,
  is_verified: Boolean(row.is_verified),
  is_locked: Boolean(row.is_locked),
  created_at: row.created_at,
  message_count: Number(row.message_count) || 0,
  friend_count: Number(row.friend_count) || 0,
  online: onlineSet.has(row.user_id),
});

const fail = (res, err, message) => {
  console.error(message, err);
  res.status(500).json({ status: "error", message });
};

// Lấy user đích + chặn thao tác lên chính mình (tránh tự khóa / tự hạ quyền / tự xóa)
const loadTarget = async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!targetId) {
    res.status(400).json({ status: "error", message: "ID người dùng không hợp lệ" });
    return null;
  }
  if (targetId === req.user.user_id) {
    res.status(400).json({ status: "error", message: "Bạn không thể thực hiện thao tác này với chính tài khoản của mình" });
    return null;
  }
  const rows = await q("SELECT user_id, username, role, is_locked, is_verified FROM Users WHERE user_id = ?", [targetId]);
  if (!rows[0]) {
    res.status(404).json({ status: "error", message: "Không tìm thấy người dùng" });
    return null;
  }
  return rows[0];
};

// Ngắt mọi kết nối realtime của user (khi khóa / xóa tài khoản)
const kickUser = (req, userId, reason) => {
  const io = req.app.get("io");
  if (!io) return;
  io.to(`user:${userId}`).emit("account_locked", { message: reason });
  io.in(`user:${userId}`).disconnectSockets(true);
};

const adminController = {
  // GET /api/admin/stats
  stats: async (req, res) => {
    try {
      const [users] = await q(`
        SELECT COUNT(*) AS total,
          SUM(is_verified = TRUE) AS verified,
          SUM(is_verified = FALSE) AS unverified,
          SUM(is_locked = TRUE) AS locked,
          SUM(role = 'admin') AS admins,
          SUM(created_at >= NOW() - INTERVAL 7 DAY) AS new_7d
        FROM Users`);
      const [messages] = await q(`
        SELECT COUNT(*) AS total, SUM(created_at >= NOW() - INTERVAL 1 DAY) AS last_24h FROM Messages`);
      const [conversations] = await q("SELECT COUNT(*) AS total FROM Conversations");
      res.json({
        status: "ok",
        data: {
          users: {
            total: Number(users.total) || 0,
            verified: Number(users.verified) || 0,
            unverified: Number(users.unverified) || 0,
            locked: Number(users.locked) || 0,
            admins: Number(users.admins) || 0,
            new_7d: Number(users.new_7d) || 0,
            online: getOnlineUserIds().length,
          },
          messages: { total: Number(messages.total) || 0, last_24h: Number(messages.last_24h) || 0 },
          conversations: Number(conversations.total) || 0,
        },
      });
    } catch (err) {
      fail(res, err, "Lỗi khi lấy thống kê");
    }
  },

  // GET /api/admin/users?q=&filter=all|verified|unverified|locked|admin&sort=newest&page=1&limit=20
  listUsers: async (req, res) => {
    const keyword = String(req.query.q || "").trim().slice(0, 100);
    const filter = FILTERS[req.query.filter] ? req.query.filter : "all";
    const sort = SORTS[req.query.sort] ? req.query.sort : "newest";
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const where = [FILTERS[filter]];
    const args = [];
    if (keyword) {
      where.push("(u.username LIKE ? OR u.email LIKE ?)");
      const like = `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;
      args.push(like, like);
    }
    const whereSql = where.join(" AND ");

    try {
      const [{ total }] = await q(`SELECT COUNT(*) AS total FROM Users u WHERE ${whereSql}`, args);
      const rows = await q(
        `SELECT u.user_id, u.username, u.email, u.role, u.avatar_url, u.is_verified, u.is_locked, u.created_at,
            (SELECT COUNT(*) FROM Messages m WHERE m.sender_id = u.user_id) AS message_count,
            (SELECT COUNT(*) FROM UserContacts uc
              WHERE uc.status = 'accepted' AND (uc.user_id = u.user_id OR uc.friend_id = u.user_id)) AS friend_count
         FROM Users u
         WHERE ${whereSql}
         ORDER BY ${SORTS[sort]}
         LIMIT ? OFFSET ?`,
        [...args, limit, (page - 1) * limit],
      );
      const onlineSet = new Set(getOnlineUserIds());
      res.json({
        status: "ok",
        data: {
          users: rows.map((r) => toPublic(r, onlineSet)),
          pagination: { page, limit, total: Number(total), pages: Math.max(1, Math.ceil(total / limit)) },
        },
      });
    } catch (err) {
      fail(res, err, "Lỗi khi lấy danh sách người dùng");
    }
  },

  // PATCH /api/admin/users/:id/role  { role: "admin" | "user" }
  updateRole: async (req, res) => {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ status: "error", message: "Vai trò phải là 'admin' hoặc 'user'" });
    }
    try {
      const target = await loadTarget(req, res);
      if (!target) return;
      await q("UPDATE Users SET role = ? WHERE user_id = ?", [role, target.user_id]);
      res.json({
        status: "ok",
        message: role === "admin" ? `${target.username} đã trở thành quản trị viên` : `Đã bỏ quyền quản trị của ${target.username}`,
      });
    } catch (err) {
      fail(res, err, "Lỗi khi cập nhật vai trò");
    }
  },

  // PATCH /api/admin/users/:id/lock  { locked: true | false }
  setLocked: async (req, res) => {
    const locked = Boolean(req.body.locked);
    try {
      const target = await loadTarget(req, res);
      if (!target) return;
      await q("UPDATE Users SET is_locked = ?, status = IF(?, 'offline', status) WHERE user_id = ?", [locked, locked, target.user_id]);
      if (locked) {
        kickUser(req, target.user_id, "Tài khoản của bạn đã bị khóa bởi quản trị viên.");
        req.app.get("io")?.emit("user_offline", { user_id: target.user_id });
      }
      res.json({ status: "ok", message: locked ? `Đã khóa tài khoản ${target.username}` : `Đã mở khóa tài khoản ${target.username}` });
    } catch (err) {
      fail(res, err, "Lỗi khi cập nhật trạng thái khóa");
    }
  },

  // PATCH /api/admin/users/:id/verify — xác nhận email thủ công (vd. khi user không nhận được mail)
  verifyEmail: async (req, res) => {
    try {
      const target = await loadTarget(req, res);
      if (!target) return;
      if (target.is_verified) {
        return res.status(400).json({ status: "error", message: "Email của người dùng này đã được xác nhận" });
      }
      await q("UPDATE Users SET is_verified = TRUE WHERE user_id = ?", [target.user_id]);
      res.json({ status: "ok", message: `Đã xác nhận email cho ${target.username}` });
    } catch (err) {
      fail(res, err, "Lỗi khi xác nhận email");
    }
  },

  // DELETE /api/admin/users/:id — xóa vĩnh viễn (tin nhắn, kết bạn... xóa theo ON DELETE CASCADE)
  deleteUser: async (req, res) => {
    try {
      const target = await loadTarget(req, res);
      if (!target) return;
      kickUser(req, target.user_id, "Tài khoản của bạn đã bị xóa.");
      await q("DELETE FROM Users WHERE user_id = ?", [target.user_id]);
      res.json({ status: "ok", message: `Đã xóa tài khoản ${target.username}` });
    } catch (err) {
      fail(res, err, "Lỗi khi xóa người dùng");
    }
  },
};

module.exports = adminController;
