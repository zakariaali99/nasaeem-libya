"use client";

import * as React from "react";

export type ToastVariant = "default" | "success" | "error" | "warning";

export type Toast = {
  id: number;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms
};

const ToastContext = React.createContext<{
  toasts: Toast[];
  show: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
} | null>(null);

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const show = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = ++_id;
    const next: Toast = { id, duration: 3000, variant: "default", ...toast };
    setToasts((prev) => [...prev, next]);
    if (next.duration && next.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, next.duration);
    }
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast يجب أن يُستخدم داخل ToastProvider");
  return ctx;
}
