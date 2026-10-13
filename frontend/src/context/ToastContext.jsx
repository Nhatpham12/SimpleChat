import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import UserAvatar from "../components/UserAvatar";

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};

const DURATION = { success: 4000, info: 5000, error: 6500, message: 6000, friend: 8000 };
const MAX_VISIBLE = 4;

const icons = {
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 11v5.5" />
      <path d="M12 7.5h.01" />
    </svg>
  ),
};

function Toast({ toast, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);
  const remainingRef = useRef(toast.duration);
  const startedRef = useRef(0);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onClose(toast.id), 180);
  }, [onClose, toast.id]);

  const start = useCallback(() => {
    startedRef.current = Date.now();
    timerRef.current = setTimeout(close, remainingRef.current);
  }, [close]);

  // Dừng đếm giờ khi rê chuột vào để người dùng kịp đọc
  const pause = () => {
    clearTimeout(timerRef.current);
    remainingRef.current -= Date.now() - startedRef.current;
  };

  useEffect(() => {
    start();
    return () => clearTimeout(timerRef.current);
  }, [start]);

  const handleClick = () => {
    if (!toast.onClick) return;
    toast.onClick();
    close();
  };

  const isPerson = toast.type === "message" || toast.type === "friend";

  return (
    <div
      className={`toast toast-${toast.type} ${leaving ? "leaving" : ""} ${toast.onClick ? "clickable" : ""}`}
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={start}
      onClick={handleClick}
    >
      <div className="toast-icon">
        {isPerson ? <UserAvatar user={toast.user} size={36} /> : icons[toast.type]}
      </div>
      <div className="toast-body">
        {toast.title && <p className="toast-title">{toast.title}</p>}
        {toast.message && <p className="toast-text">{toast.message}</p>}
        {toast.actions?.length > 0 && (
          <div className="toast-actions">
            {toast.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={action.primary ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                  close();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Đóng thông báo"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

function ConfirmDialog({ dialog, onResolve }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onResolve(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onResolve]);

  return (
    <div className="dialog-backdrop" onMouseDown={() => onResolve(false)}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="dialog-title">{dialog.title}</h3>
        {dialog.message && <p>{dialog.message}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={() => onResolve(false)}>
            {dialog.cancelLabel || "Hủy"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={dialog.danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={() => onResolve(true)}
          >
            {dialog.confirmLabel || "Đồng ý"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // key: thông báo cùng key thay thế cái cũ (vd. nhiều tin nhắn liên tiếp từ 1 cuộc trò chuyện)
  const show = useCallback((options) => {
    const id = ++idRef.current;
    const type = options.type || "info";
    const toast = { duration: DURATION[type], ...options, type, id };
    setToasts((prev) => {
      const rest = options.key ? prev.filter((t) => t.key !== options.key) : prev;
      return [...rest, toast].slice(-MAX_VISIBLE);
    });
    return id;
  }, []);

  // Hộp xác nhận thay cho window.confirm: const ok = await toast.confirm({...})
  const resolverRef = useRef(null);
  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setDialog(options);
      }),
    []
  );

  const resolveDialog = useCallback((value) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const api = useMemo(
    () => ({
      show,
      confirm,
      success: (message, title) => show({ type: "success", message, title }),
      error: (message, title) => show({ type: "error", message, title }),
      info: (message, title) => show({ type: "info", message, title }),
    }),
    [show, confirm]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={remove} />
        ))}
      </div>
      {dialog && <ConfirmDialog dialog={dialog} onResolve={resolveDialog} />}
    </ToastContext.Provider>
  );
};
