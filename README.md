# SimpleChat 💬

Một ứng dụng web chat đơn giản với chức năng tạo tài khoản bằng email và kết bạn qua email/username.

## 📋 Giới Thiệu Dự Án

**SimpleChat** là một nền tảng trò chuyện thời gian thực cho phép người dùng:
- 📧 Tạo tài khoản bằng email xác minh
- 👥 Kết bạn qua email hoặc username
- 💬 Trò chuyện trực tiếp với bạn bè
- 🔐 Bảo mật dữ liệu người dùng

## 🛠️ Công Nghệ Sử Dụng

### Backend
- **Node.js** - Runtime JavaScript phía server
- **Express.js** - Web framework
- **MySQL** - Cơ sở dữ liệu
- **JWT** - Xác thực token
- **Nodemailer** - Gửi email xác minh
- **bcryptjs** - Mã hóa mật khẩu
- **CORS** - Cross-Origin Resource Sharing

### Frontend
- **React 19** - UI library
- **Vite** - Build tool
- **CSS** - Styling

## 📁 Cấu Trúc Dự Án

```
SimpleChat/
├── backend/                 # API Server (Node.js + Express)
│   ├── package.json
│   ├── .env                 # Configuration (tạo từ .env.example)
│   └── ...
│
├── frontend/                # React + Vite
│   ├── src/
│   ├── package.json
│   └── ...
│
└── README.md
```

## 🚀 Hướng Dẫn Cài Đặt

### Yêu Cầu
- Node.js >= 16.x
- MySQL >= 5.7
- npm hoặc yarn

### 1. Clone Repository

```bash
git clone https://github.com/Nhatpham12/SimpleChat.git
cd SimpleChat
```

### 2. Cài Đặt Backend

```bash
cd backend

# Cài đặt dependencies
npm install

# Tạo file .env
cp .env.example .env

# Cấu hình các biến môi trường
# DATABASE_URL=mysql://username:password@localhost:3306/simplechat
# JWT_SECRET=your_secret_key
# EMAIL_SERVICE=gmail
# EMAIL_USER=your_email@gmail.com
# EMAIL_PASS=your_app_password
# PORT=5000

# Chạy server
npm start
```

### 3. Cài Đặt Frontend

```bash
cd frontend

# Cài đặt dependencies
npm install

# Chạy development server
npm run dev

# Build cho production
npm run build
```

## ✨ Tính Năng Chính

### Xác Thực & Tài Khoản
- ✅ Đăng ký tài khoản với email xác minh
- ✅ Đăng nhập an toàn với JWT
- ✅ Quên mật khẩu và đặt lại qua email
- ✅ Quản lý hồ sơ người dùng

### Quản Lý Bạn Bè
- ✅ Gửi yêu cầu kết bạn qua email hoặc username
- ✅ Chấp nhận/từ chối yêu cầu kết bạn
- ✅ Xem danh sách bạn bè
- ✅ Hủy bạn bè

### Trò Chuyện
- ✅ Gửi/nhận tin nhắn realtime
- ✅ Lịch sử trò chuyện
- ✅ Trạng thái online/offline

## 📋 API Endpoints (Ví Dụ)

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/verify-email` - Xác minh email
- `POST /api/auth/forgot-password` - Yêu cầu đặt lại mật khẩu

### Users
- `GET /api/users/profile` - Lấy thông tin người dùng
- `PUT /api/users/profile` - Cập nhật thông tin
- `GET /api/users/search` - Tìm kiếm người dùng

### Friends
- `POST /api/friends/request` - Gửi yêu cầu kết bạn
- `GET /api/friends/requests` - Lấy danh sách yêu cầu
- `PUT /api/friends/accept/:id` - Chấp nhận yêu cầu
- `GET /api/friends` - Lấy danh sách bạn bè

### Messages
- `GET /api/messages/:friendId` - Lấy tin nhắn
- `POST /api/messages` - Gửi tin nhắn

## 🔧 Biến Môi Trường

Tạo file `.env` trong thư mục `backend`:

```env
# Database
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=simplechat

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:5173

# CORS
CORS_ORIGIN=http://localhost:5173
```

## 📝 Hướng Dẫn Phát Triển

### Cấu trúc thư mục Backend
```
backend/
├── controllers/     # Logic xử lý
├── routes/          # API routes
├── models/          # Database models
├── middlewares/     # Authentication, validation
├── config/          # Configuration
├── utils/           # Helper functions
└── index.js         # Entry point
```

### Cấu trúc thư mục Frontend
```
frontend/
├── src/
│   ├── components/  # React components
│   ├── pages/       # Pages
│   ├── context/     # State management
│   ├── hooks/       # Custom hooks
│   ├── styles/      # CSS files
│   ├── api/         # API calls
│   └── App.jsx
├── vite.config.js
└── index.html
```

## 🧪 Testing

```bash
# Backend tests (nếu có)
cd backend
npm test

# Frontend tests (nếu có)
cd frontend
npm test
```

## 🚢 Deployment

### Heroku
```bash
heroku create simplechat-app
git push heroku main
```

### Vercel (Frontend)
```bash
npm run build
vercel
```

## 📞 Hỗ Trợ & Liên Hệ

Nếu bạn có bất kỳ câu hỏi nào, vui lòng tạo một **Issue** trên GitHub.

## 📄 License

ISC

## 👨‍💻 Tác Giả

Được phát triển bởi **Nhat Pham** - [GitHub Profile](https://github.com/Nhatpham12)

---

**Happy Coding!** 🎉
