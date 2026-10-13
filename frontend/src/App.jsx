import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext";
import RealtimeNotifier from "./components/RealtimeNotifier";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import ContactsPage from "./pages/ContactsPage";
import ProfilePage from "./pages/ProfilePage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import AdminPage from "./pages/AdminPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" aria-label="Đang tải" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SocketProvider>
      <RealtimeNotifier />
      {children}
    </SocketProvider>
  );
}

// Chỉ admin; server vẫn tự kiểm tra quyền ở mọi API /api/admin
function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/chat" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" aria-label="Đang tải" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/chat" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />
            <Route
              path="/verify-email"
              element={
                <PublicRoute>
                  <VerifyEmailPage />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPasswordPage />
                </PublicRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <ContactsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
