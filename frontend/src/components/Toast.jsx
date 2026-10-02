import { createContext, useContext, useState, useCallback, useEffect, useId } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

let toastSeq = 0;

export function ToastProvider({ children, maxToasts = 5, defaultDuration = 5000 }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, options = {}) => {
    const id = `toast-${++toastSeq}`;
    const {
      type = 'info',
      title,
      duration = defaultDuration,
      action,
      dismissible = true,
      ...rest
    } = options;

    const toast = {
      id,
      message,
      title,
      type,
      action,
      dismissible,
      ...rest
    };

    setToasts((prev) => {
      const next = [...prev, toast];
      return next.slice(-maxToasts);
    });

    return id;
  }, [maxToasts, defaultDuration]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = {
    success: (message, options) => addToast(message, { ...options, type: 'success' }),
    error: (message, options) => addToast(message, { ...options, type: 'error' }),
    warning: (message, options) => addToast(message, { ...options, type: 'warning' }),
    info: (message, options) => addToast(message, { ...options, type: 'info' }),
    dismiss: removeToast,
    clear: clearToasts
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const id = useId();
  const toastId = `toast-${id}`;

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const icons = {
    success: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    error: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    info: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    )
  };

  const handleDismiss = () => {
    if (toast.dismissible) onDismiss(toast.id);
  };

  const handleAction = () => {
    if (toast.action?.onClick) {
      toast.action.onClick();
      if (toast.action.dismiss !== false) onDismiss(toast.id);
    }
  };

  return (
    <div
      id={toastId}
      className={`toast toast--${toast.type} toast--enter`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="toast__icon" aria-hidden="true">
        {icons[toast.type]}
      </div>
      <div className="toast__content">
        {toast.title && (
          <div className="toast__title">{toast.title}</div>
        )}
        <div className="toast__message">{toast.message}</div>
      </div>
      {toast.action && (
        <button
          className="toast__action"
          onClick={handleAction}
          type="button"
        >
          {toast.action.label}
        </button>
      )}
      {toast.dismissible && (
        <button
          className="toast__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
      <div className={`toast__progress toast__progress--${toast.type}`} style={{ '--duration': `${toast.duration || 5000}ms` }} aria-hidden="true" />
    </div>
  );
}