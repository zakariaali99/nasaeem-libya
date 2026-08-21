"use client";

import * as React from "react";
import { useToast } from "./use-toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" dir="rtl">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            "min-w-64 max-w-sm rounded-md border p-3 shadow bg-white text-right " +
            (t.variant === "success"
              ? "border-green-400"
              : t.variant === "error"
              ? "border-red-400"
              : t.variant === "warning"
              ? "border-yellow-400"
              : "border-gray-300")
          }
        >
          {t.title && <div className="font-bold mb-1">{t.title}</div>}
          {t.description && <div className="text-sm">{t.description}</div>}
          <div className="mt-2 flex justify-start">
            <button
              className="text-sm text-blue-600 hover:underline"
              onClick={() => dismiss(t.id)}
            >
              إغلاق
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
