import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "../Icon";

export type ToastType = "ok" | "warn" | "err";

interface ToastEntry {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICON: Record<ToastType, string> = {
  ok: "check-circle",
  warn: "alert-triangle",
  err: "x-circle",
};

const AUTO_DISMISS_MS = 3600;

/** Matches the source's toast()/#toastWrap exactly (message, ok/warn/err, 3.6s auto-dismiss). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const seq = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "ok") => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className={`toast toast--${t.type}`} key={t.id}>
            <Icon name={TOAST_ICON[t.type]} size="sm" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue["toast"] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx.toast;
}
