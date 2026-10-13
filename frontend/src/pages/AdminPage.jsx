import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { adminAPI } from "../api/admin";
import UserAvatar from "../components/UserAvatar";
import PageHeader from "../components/PageHeader";

const PAGE_SIZE = 20;

const FILTERS = [
  { id: "all", label: "Tất cả", stat: "total" },
  { id: "unverified", label: "Chưa xác nhận", stat: "unverified" },
  { id: "locked", label: "Đã khóa", stat: "locked" },
  { id: "admin", label: "Quản trị viên", stat: "admins" },
];

const SORTS = [
  { id: "newest", label: "Mới đăng ký" },
  { id: "oldest", label: "Cũ nhất" },
  { id: "name", label: "Tên A–Z" },
  { id: "messages", label: "Nhắn nhiều nhất" },
];

const formatDate = (value) =>
  new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

function RowMenu({ target, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "mousedown" && ref.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const run = (action) => {
    setOpen(false);
    onAction(action, target);
  };

  return (
    <div className="row-menu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Thao tác với ${target.username}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="row-menu-list" role="menu">
          {!target.is_verified && (
            <button role="menuitem" onClick={() => run("verify")}>Xác nhận email</button>
          )}
          <button role="menuitem" onClick={() => run(target.role === "admin" ? "demote" : "promote")}>
            {target.role === "admin" ? "Bỏ quyền quản trị" : "Đặt làm quản trị viên"}
          </button>
          <button role="menuitem" onClick={() => run(target.is_locked ? "unlock" : "lock")}>
            {target.is_locked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
          </button>
          <button role="menuitem" className="danger" onClick={() => run("delete")}>Xóa tài khoản</button>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminAPI.getStats();
      setStats(res.data.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers({ q: debouncedQuery || undefined, filter, sort, page, limit: PAGE_SIZE });
      setUsers(res.data.data.users);
      setPagination(res.data.data.pagination);
    } catch (err) {
      toast.error(err.response?.data?.message || "Chưa tải được danh sách người dùng");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filter, sort, page, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const CONFIRMS = {
    promote: (u) => ({
      title: `Đặt ${u.username} làm quản trị viên?`,
      message: "Người này sẽ xem được danh sách người dùng, có thể khóa, xóa tài khoản và cấp quyền cho người khác.",
      confirmLabel: "Cấp quyền",
    }),
    demote: (u) => ({
      title: `Bỏ quyền quản trị của ${u.username}?`,
      message: "Người này sẽ không vào được trang quản trị nữa.",
      confirmLabel: "Bỏ quyền",
    }),
    lock: (u) => ({
      title: `Khóa tài khoản ${u.username}?`,
      message: "Người này bị đăng xuất ngay và không đăng nhập lại được cho tới khi bạn mở khóa. Tin nhắn cũ vẫn được giữ.",
      confirmLabel: "Khóa tài khoản",
      danger: true,
    }),
    delete: (u) => ({
      title: `Xóa vĩnh viễn ${u.username}?`,
      message: `Toàn bộ ${fmt(u.message_count)} tin nhắn, danh sách bạn bè và dữ liệu của tài khoản này sẽ bị xóa. Không thể hoàn tác.`,
      confirmLabel: "Xóa vĩnh viễn",
      danger: true,
    }),
  };

  const handleAction = async (action, target) => {
    if (CONFIRMS[action]) {
      const ok = await toast.confirm({ cancelLabel: "Hủy", ...CONFIRMS[action](target) });
      if (!ok) return;
    }
    try {
      let res;
      if (action === "promote") res = await adminAPI.setRole(target.user_id, "admin");
      if (action === "demote") res = await adminAPI.setRole(target.user_id, "user");
      if (action === "lock") res = await adminAPI.setLocked(target.user_id, true);
      if (action === "unlock") res = await adminAPI.setLocked(target.user_id, false);
      if (action === "verify") res = await adminAPI.verifyEmail(target.user_id);
      if (action === "delete") res = await adminAPI.deleteUser(target.user_id);
      toast.success(res.data.message);
      fetchUsers();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || "Thao tác chưa thực hiện được");
    }
  };

  const tiles = stats
    ? [
        { label: "Người dùng", value: stats.users.total, note: `+${fmt(stats.users.new_7d)} trong 7 ngày` },
        { label: "Đang hoạt động", value: stats.users.online, note: "kết nối ngay lúc này" },
        { label: "Tin nhắn", value: stats.messages.total, note: `${fmt(stats.messages.last_24h)} trong 24 giờ` },
        { label: "Cuộc trò chuyện", value: stats.conversations, note: "cả nhóm và 1-1" },
      ]
    : [];

  return (
    <div className="page">
      <PageHeader title="Quản trị" onBack={() => navigate("/chat")} />

      <div className="page-body admin-body">
        <section className="stat-strip" aria-label="Tổng quan">
          {tiles.map((t) => (
            <div key={t.label} className="stat">
              <span className="stat-label">{t.label}</span>
              <span className="stat-value">{fmt(t.value)}</span>
              <span className="stat-note">{t.note}</span>
            </div>
          ))}
        </section>

        <section className="panel admin-panel">
          <div className="admin-toolbar">
            <input
              type="search"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo username hoặc email"
              aria-label="Tìm người dùng"
            />
            <select
              className="input admin-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              aria-label="Sắp xếp"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="tabs admin-filters" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                className={`tab ${filter === f.id ? "active" : ""}`}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
              >
                {f.label}
                {stats && <span className="tab-count">{fmt(stats.users[f.stat])}</span>}
              </button>
            ))}
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Trạng thái</th>
                  <th>Vai trò</th>
                  <th className="num">Tin nhắn</th>
                  <th className="num">Bạn bè</th>
                  <th>Đăng ký</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody className={loading ? "is-loading" : ""}>
                {users.map((u) => {
                  const isSelf = u.user_id === user.user_id;
                  return (
                    <tr key={u.user_id} className={u.is_locked ? "locked" : ""}>
                      <td data-label="Người dùng">
                        <div className="admin-user">
                          <UserAvatar user={u} size={36} showStatus isOnline={u.online} />
                          <div className="admin-user-text">
                            <span className="admin-user-name">
                              {u.username}
                              {isSelf && <span className="self-tag">Bạn</span>}
                            </span>
                            <span className="admin-user-email">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Trạng thái">
                        {u.is_locked ? (
                          <span className="badge badge-danger">Đã khóa</span>
                        ) : !u.is_verified ? (
                          <span className="badge badge-warn">Chưa xác nhận</span>
                        ) : u.online ? (
                          <span className="badge badge-ok">Đang hoạt động</span>
                        ) : (
                          <span className="badge">Bình thường</span>
                        )}
                      </td>
                      <td data-label="Vai trò">
                        {u.role === "admin" ? <span className="badge badge-ink">Quản trị viên</span> : "Người dùng"}
                      </td>
                      <td data-label="Tin nhắn" className="num">{fmt(u.message_count)}</td>
                      <td data-label="Bạn bè" className="num">{fmt(u.friend_count)}</td>
                      <td data-label="Đăng ký">{formatDate(u.created_at)}</td>
                      <td className="actions">
                        {!isSelf && <RowMenu target={u} onAction={handleAction} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!loading && users.length === 0 && (
              <div className="empty-state">
                <p>{debouncedQuery ? `Không có người dùng nào khớp với "${debouncedQuery}".` : "Không có người dùng nào trong mục này."}</p>
              </div>
            )}
            {loading && users.length === 0 && (
              <div className="app-loading inline"><div className="spinner" aria-label="Đang tải" /></div>
            )}
          </div>

          <div className="admin-pager">
            <span>
              {pagination.total > 0
                ? `${fmt((pagination.page - 1) * PAGE_SIZE + 1)}–${fmt(Math.min(pagination.page * PAGE_SIZE, pagination.total))} trên ${fmt(pagination.total)} người dùng`
                : "0 người dùng"}
            </span>
            <div>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                Trang trước
              </button>
              <button className="btn btn-ghost btn-sm" disabled={page >= pagination.pages || loading} onClick={() => setPage(page + 1)}>
                Trang sau
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
