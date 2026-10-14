# Đóng gói SimpleChat thành app mobile (Capacitor)

## Context
SimpleChat hiện là web app: frontend React 19 + Vite (SPA), backend Express + Socket.IO, deploy bằng Docker + Caddy tại `https://simplechat.io.vn`. Mục tiêu: có app cài được trên điện thoại (Android trước, iOS sau) mà **tái sử dụng gần như toàn bộ code React hiện có**.

**Hướng chọn: Capacitor** — bọc bản build `frontend/dist` vào WebView native, gọi API thật qua `https://simplechat.io.vn/api`. Không viết lại bằng React Native/Flutter (tốn công gấp nhiều lần). Lưu ý: build Android làm được trên Windows; **build iOS bắt buộc cần máy Mac + Xcode** (và tài khoản Apple Developer 99$/năm để lên App Store; Google Play 25$ một lần).

Các điểm trong code đã thuận lợi:
- Auth dùng Bearer token, không dùng cookie → không vướng cookie cross-origin trong WebView.
- `frontend/src/api/axios.js` đã đọc `VITE_API_URL`, `SocketContext.jsx` đã đọc `VITE_SOCKET_URL`.

## Các bước

### 1. Sửa frontend cho chạy được trong app
- **Token**: `sessionStorage` bị xoá khi app bị kill → user phải đăng nhập lại liên tục. Đổi sang `localStorage` (hoặc `@capacitor/preferences`) ở: `frontend/src/api/axios.js`, `frontend/src/context/SocketContext.jsx`, `frontend/src/context/AuthContext.jsx` (và mọi chỗ khác dùng `sessionStorage` token/user).
- **Redirect 401**: `window.location.href = "/login"` trong `axios.js` sẽ reload sai đường dẫn trong app → dùng điều hướng của react-router (hoặc `window.location.hash` nếu chuyển HashRouter).
- **Router**: kiểm tra `App.jsx`/`main.jsx`; `BrowserRouter` vẫn chạy được với Capacitor, nhưng nếu gặp lỗi refresh/deep link thì chuyển `HashRouter`.
- Tạo `frontend/.env.mobile`:
  ```
  VITE_API_URL=https://simplechat.io.vn/api
  VITE_SOCKET_URL=https://simplechat.io.vn
  ```
  thêm script `"build:mobile": "vite build --mode mobile"`.
- UI: thêm `viewport-fit=cover` trong `index.html`, dùng `env(safe-area-inset-*)` cho header/thanh nhập tin nhắn để không bị tai thỏ/thanh home che.

### 2. Sửa backend cho phép origin của app
- `backend/config/cors.config.js`: hiện `origin` là 1 chuỗi. Đổi thành mảng gồm `https://simplechat.io.vn`, `capacitor://localhost` (iOS), `https://localhost` / `http://localhost` (Android).
- Áp dụng cùng danh sách cho CORS của Socket.IO trong `backend/socket/index.js`.

### 3. Cài Capacitor
```bash
cd frontend
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init SimpleChat vn.io.simplechat --web-dir dist
npm run build:mobile
npx cap add android        # cần Android Studio + JDK 17+
npx cap add ios            # chỉ trên Mac
npx cap sync
npx cap open android       # chạy trên máy ảo / điện thoại thật
```
Sau mỗi lần sửa code web: `npm run build:mobile && npx cap sync`.

### 4. Tính năng native (tuỳ chọn, làm dần)
- Icon + splash: `@capacitor/assets` từ `public/assets/Logo.png`.
- Chọn ảnh/file đính kèm: `<input type="file">` đa phần chạy được; nếu cần camera thì `@capacitor/camera`.
- Status bar, nút Back Android: `@capacitor/status-bar`, `@capacitor/app` (bắt `backButton` để quay lại thay vì thoát app).
- **Push notification** (quan trọng với app chat — socket bị ngắt khi app chạy nền): `@capacitor/push-notifications` + Firebase Cloud Messaging; backend thêm bảng lưu device token và gửi push qua `firebase-admin` khi người nhận offline (tận dụng `backend/socket/onlineUsers.js` để biết ai offline).

### 5. Phát hành
- Android: Android Studio → Build → Generate Signed App Bundle (.aab) → Google Play Console (hoặc build .apk để cài thử/chia sẻ trực tiếp).
- iOS: Xcode → Archive → App Store Connect / TestFlight.

### Phương án nhẹ hơn (nếu chỉ cần "cài lên màn hình chính")
PWA: thêm `manifest.webmanifest` + service worker (`vite-plugin-pwa`). Không cần store, không cần Mac, nhưng push trên iOS hạn chế và không lên được store.

## Verification
1. `npm run build:mobile && npx cap sync && npx cap run android` → app mở được trên emulator.
2. Đăng nhập, kill app, mở lại → vẫn còn đăng nhập (kiểm tra đổi storage).
3. Nhắn tin giữa app và web (simplechat.io.vn) → realtime 2 chiều qua socket (kiểm tra CORS socket).
4. Gửi ảnh đính kèm, thử nút Back Android, kiểm tra safe-area trên máy có tai thỏ.
5. Xem lỗi trong `chrome://inspect` (Android WebView) nếu có request bị CORS chặn.
