# SimpleChat 💬

Ứng dụng chat thời gian thực trên nền web: đăng ký bằng email (xác minh OTP), kết bạn, nhắn tin 1-1 và nhóm, gửi ảnh/file, có trang quản trị cho admin.

🌐 **Bản chạy thật:** [https://simplechat.io.vn](https://simplechat.io.vn)

---

## ✨ Tính năng

**Tài khoản**
- Đăng ký, xác minh email bằng mã OTP 6 số (hết hạn sau 10 phút, tối đa 5 lần nhập sai, chờ 60s giữa hai lần gửi)
- Đăng nhập bằng JWT, đổi mật khẩu, quên mật khẩu (đặt lại qua OTP gửi email)
- Hồ sơ cá nhân, ảnh đại diện (lưu trên Cloudinary)

**Bạn bè**
- Tìm người dùng theo username/email, gửi – chấp nhận – từ chối lời mời kết bạn, hủy kết bạn
- Chặn / bỏ chặn người dùng

**Trò chuyện**
- Chat 1-1 và chat nhóm (thêm/xóa thành viên, đổi tên, ảnh nhóm, phân quyền admin nhóm)
- Gửi tin nhắn realtime qua Socket.IO, trạng thái online/offline, "đang nhập…"
- Trạng thái tin nhắn đã gửi / đã nhận / đã xem
- Gửi ảnh và file đính kèm, xem lại file/ảnh đã chia sẻ trong cuộc trò chuyện
- Sửa, xóa tin nhắn; tìm kiếm tin nhắn; xóa lịch sử trò chuyện (chỉ phía mình)
- Thông báo realtime

**Quản trị (admin)**
- Thống kê hệ thống, danh sách người dùng
- Đổi vai trò, khóa/mở khóa tài khoản (tài khoản bị khóa bị ngắt kết nối realtime), xác minh email thủ công, xóa người dùng

**Bảo mật**
- Mật khẩu băm bằng bcrypt; OTP chỉ lưu dạng HMAC-SHA256
- Rate limit cho API, đăng nhập (theo IP và theo tài khoản), gửi/nhập OTP, gửi lời mời kết bạn và gửi tin nhắn
- Socket.IO xác thực bằng JWT ngay khi kết nối

---

## 🏗️ Kiến trúc hệ thống

```
                 ┌──────────────────────────────────────────────┐
  Trình duyệt ──►│ Caddy (HTTPS tự động – Let's Encrypt)        │  simplechat.io.vn
                 └───────────────┬──────────────────────────────┘
                                 ▼
                 ┌──────────────────────────────────────────────┐
                 │ Frontend: nginx phục vụ bản build React       │
                 │   /            → SPA (index.html)            │
                 │   /api/*       → proxy sang backend:5001     │
                 │   /socket.io/* → proxy WebSocket             │
                 └───────────────┬──────────────────────────────┘
                                 ▼
                 ┌──────────────────────────────────────────────┐
                 │ Backend: Node.js + Express 5 + Socket.IO      │──► Cloudinary (ảnh, file)
                 │   REST API  /api/...                         │──► SMTP / Gmail (OTP)
                 │   Realtime  socket.io                        │
                 └───────────────┬──────────────────────────────┘
                                 ▼
                 ┌──────────────────────────────────────────────┐
                 │ MySQL 8.4 (database SimpleChat)              │
                 └──────────────────────────────────────────────┘
```

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19, React Router 7, Vite, Axios, socket.io-client |
| Backend | Node.js, Express 5, Socket.IO 4, mysql2, JWT, bcrypt, Nodemailer, Multer + Cloudinary, express-rate-limit |
| Cơ sở dữ liệu | MySQL 8.4 (utf8mb4) |
| Hạ tầng | Docker Compose, Caddy, nginx, GitHub Actions, GitHub Container Registry, AWS EC2 |

### Luồng realtime (Socket.IO)

Client kết nối kèm JWT. Sau khi xác thực, server cho socket vào room `user:<id>` và room `conversation:<id>` của mọi cuộc trò chuyện mà người dùng tham gia.

| Client gửi | Server phát |
|---|---|
| `send_message`, `typing_start`, `typing_stop`, `mark_read`, `join_conversation`, `leave_conversation` | `user_online`, `user_offline`, `online_users`, `user_typing`, `user_stop_typing`, `messages_seen`, `error` … |

### REST API

Tất cả endpoint nằm dưới `/api`. Nhóm `/api/auth` và `/api/health` là public, các nhóm còn lại cần header `Authorization: Bearer <token>`.

| Prefix | Chức năng |
|---|---|
| `/api/auth` | register, login, logout, me, verify-email, resend-verification, forgot-password, reset-password, change-password |
| `/api/users` | hồ sơ, tìm kiếm, cập nhật thông tin, avatar |
| `/api/contacts` | danh sách bạn, lời mời đang chờ, gửi/chấp nhận/từ chối/hủy kết bạn |
| `/api/blocked` | chặn / bỏ chặn |
| `/api/conversations` | tạo, sửa, xóa cuộc trò chuyện; thêm/xóa thành viên |
| `/api/messages` | lấy, gửi, sửa, xóa, tìm kiếm tin nhắn; đánh dấu đã đọc; xóa lịch sử; file đã chia sẻ |
| `/api/attachments` | tải lên / xóa file đính kèm |
| `/api/notifications` | danh sách, số chưa đọc, đánh dấu đã xem |
| `/api/group-settings` | cài đặt nhóm dạng key–value |
| `/api/admin` | thống kê, quản lý người dùng (chỉ admin) |
| `/api/health` | kiểm tra server và kết nối DB |

---

## 🗄️ Cơ sở dữ liệu

Schema nằm trong [`simplechat.sql`](simplechat.sql) (MySQL, InnoDB, `utf8mb4_unicode_ci`). Khi backend khởi động, [`backend/seeders/migrate.js`](backend/seeders/migrate.js) tự thêm các cột mới nếu DB cũ còn thiếu, và [`backend/seeders/adminSeeder.js`](backend/seeders/adminSeeder.js) tạo tài khoản admin nếu chưa có.

### Sơ đồ quan hệ

```
                      ┌──────────────┐
          ┌──────────►│    Users     │◄───────────┬──────────────┬──────────────┐
          │           └──────┬───────┘            │              │              │
          │                  │ 1                  │              │              │
   UserContacts        ┌─────┴─────┐       BlockedUsers   Notifications   EmailVerifications
  (user_id,friend_id)  │           │     (user_id,          (user_id)      PasswordResets
                       │ n         │ n    blocked_user_id)                    (user_id)
                ┌──────┴──────┐  ┌─┴──────────┐
                │Participants │  │  Messages  │ sender_id
                └──────┬──────┘  └─┬────┬─────┘
                     n │         n │    │ 1
                       ▼           ▼    ├──────────► Attachments (n)
                ┌──────────────────┐    └──────────► MessageStatus (n, receiver_id → Users)
                │  Conversations   │ 1
                └────────┬─────────┘
                         └──────────► GroupSettings (n)
```

### Các bảng

| Bảng | Mô tả | Cột chính |
|---|---|---|
| **Users** | Tài khoản người dùng | `user_id`, `username` (unique), `email` (unique), `password_hash`, `role` (`admin`/`user`), `avatar_url`, `status` (`online`/`offline`/`away`), `is_verified`, `is_locked` |
| **Conversations** | Cuộc trò chuyện | `conversation_id`, `type` (`direct`/`group`), `conversation_name`, `avatar_url`, `created_by` → Users |
| **Participants** | Thành viên của cuộc trò chuyện | `conversation_id`, `user_id`, `role` (`admin`/`member`), `cleared_before_id` (ẩn tin cũ khi xóa lịch sử phía mình); unique (`conversation_id`, `user_id`) |
| **Messages** | Tin nhắn | `message_id`, `conversation_id`, `sender_id`, `content`, `type` (`text`/`image`/`file`/`system`), `updated_at`, `is_deleted` (xóa mềm) |
| **Attachments** | File/ảnh đính kèm tin nhắn | `message_id`, `file_url`, `file_name`, `file_type`, `file_size` |
| **MessageStatus** | Trạng thái tin nhắn với từng người nhận | `message_id`, `receiver_id`, `status` (`sent`/`delivered`/`read`); unique (`message_id`, `receiver_id`) |
| **UserContacts** | Quan hệ bạn bè | `user_id` (người gửi lời mời), `friend_id`, `status` (`pending`/`accepted`/`blocked`); unique cặp, không tự kết bạn |
| **BlockedUsers** | Danh sách chặn | `user_id`, `blocked_user_id`; unique cặp |
| **Notifications** | Thông báo | `user_id`, `type`, `content`, `reference_id`, `is_seen` |
| **GroupSettings** | Cài đặt nhóm dạng key–value | `conversation_id`, `setting_name`, `setting_value`; unique (`conversation_id`, `setting_name`) |
| **EmailVerifications** | OTP xác minh email | `user_id`, `token` (HMAC của OTP), `expires_at`, `is_used`, `attempts` |
| **PasswordResets** | OTP đặt lại mật khẩu | `user_id`, `token` (HMAC của OTP), `expires_at`, `is_used`, `attempts` |

Mọi khóa ngoại tới `Users`/`Conversations`/`Messages` dùng `ON DELETE CASCADE` (riêng `Conversations.created_by` là `SET NULL`), nên xóa một user sẽ dọn sạch dữ liệu liên quan. Các truy vấn thường dùng đều có index, ví dụ `Messages(conversation_id, created_at)` cho việc tải lịch sử chat.

---

## 📁 Cấu trúc thư mục

```
SimpleChat/
├── backend/
│   ├── common/          # Kết nối DB, mailer, OTP, kiểm tra quyền chat, gửi tin nhắn
│   ├── config/          # Cấu hình app, DB, JWT, CORS, mail, Cloudinary
│   ├── controllers/     # Xử lý logic cho từng nhóm API
│   ├── middlewares/     # Xác thực JWT, validate, rate limit, xử lý lỗi
│   ├── models/          # Truy vấn SQL cho từng bảng
│   ├── routers/         # Định nghĩa route REST
│   ├── seeders/         # Migration tự động + tạo admin mặc định
│   ├── socket/          # Socket.IO: tin nhắn, typing, presence
│   ├── Dockerfile
│   └── index.js         # Entry point
├── frontend/
│   ├── src/
│   │   ├── api/         # Hàm gọi REST API (axios)
│   │   ├── components/  # Component dùng chung
│   │   ├── context/     # Auth, Socket, Toast
│   │   ├── pages/       # Login, Register, Chat, Contacts, Profile, Admin…
│   │   └── styles/
│   ├── nginx.conf       # Phục vụ SPA + proxy /api, /socket.io
│   └── Dockerfile
├── simplechat.sql       # Schema cơ sở dữ liệu
├── docker-compose.yml   # mysql + backend + frontend + caddy
├── Caddyfile            # Domain + HTTPS
└── .github/workflows/deploy.yml
```

---

## 🚀 Chạy ở máy local

**Yêu cầu:** Node.js 22 (bản dùng trong Docker image), MySQL 8, một tài khoản Cloudinary và một Gmail có App Password (để gửi OTP).

```bash
git clone https://github.com/Nhatpham12/SimpleChat.git
cd SimpleChat

# 1. Tạo database
mysql -u root -p < simplechat.sql

# 2. Backend (cổng 5001)
cd backend
cp .env.example .env      # điền thông tin DB, JWT, SMTP, Cloudinary
npm install
npm run dev

# 3. Frontend (cổng 5173, tự proxy /api và /socket.io sang 5001)
cd ../frontend
npm install
npm run dev
```

Mở http://localhost:5173.

### Biến môi trường (`backend/.env`)

| Biến | Ý nghĩa |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` | Kết nối MySQL (`DB_NAME=SimpleChat` – tên phân biệt hoa thường trên Linux) |
| `PORT` | Cổng backend, mặc định `5001` |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Ký token đăng nhập (cũng dùng làm khóa HMAC cho OTP) |
| `JWT_REMEMBER_EXPIRES_IN` | Hạn token khi bật "Ghi nhớ đăng nhập", mặc định `30d` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` | Tài khoản admin tạo lần đầu khi DB chưa có admin |
| `CORS_ORIGIN` | Origin được phép (production: `https://simplechat.io.vn`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gửi email OTP (Gmail: dùng App Password) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Lưu avatar và file đính kèm |
| `TRUST_PROXY` | Số lớp proxy phía trước backend, mặc định `2` (Caddy → nginx) |

---

## 🚢 Triển khai

Hệ thống đang chạy tại **[simplechat.io.vn](https://simplechat.io.vn)** trên một máy AWS EC2, dùng Docker Compose với 4 service: `mysql`, `backend`, `frontend`, `caddy`.

Quy trình CI/CD ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) chạy mỗi khi push lên `main`:

1. Build image `backend` và `frontend`, đẩy lên GHCR (`ghcr.io/nhatpham12/simplechat-*`, tag `latest` và commit SHA).
2. Copy `docker-compose.yml`, `simplechat.sql`, `Caddyfile` lên EC2.
3. SSH vào EC2, `docker compose pull` rồi `docker compose up -d`, reload Caddy.

Caddy tự xin và gia hạn chứng chỉ HTTPS; `www.simplechat.io.vn` được chuyển hướng về `simplechat.io.vn`. Schema `simplechat.sql` chỉ chạy khi volume MySQL còn trống; các thay đổi schema sau đó do `migrate.js` xử lý lúc backend khởi động.

**Secrets cần có trên GitHub:** `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `GHCR_TOKEN`. File `.env` (gồm cả `MYSQL_ROOT_PASSWORD`) đặt sẵn trong `~/simplechat` trên server.

---

## 👨‍💻 Tác giả

**Nhat Pham** – [github.com/Nhatpham12](https://github.com/Nhatpham12)

License: ISC
