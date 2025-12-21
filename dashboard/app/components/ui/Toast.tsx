"use client";

import { useEffect } from "react";

export type ToastProps = {
  open: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  variant?: "info" | "warning" | "error" | "success";
  countdownSeconds?: number | null;
  countdownTotalSeconds?: number | null;
};

const COLORS: Record<NonNullable<ToastProps["variant"]>, string> = {
  info: "bg-sky-50 border-sky-200 text-sky-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  error: "bg-rose-50 border-rose-200 text-rose-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
};

export function Toast({
  open,
  message,
  actionLabel,
  onAction,
  onClose,
  variant = "info",
  countdownSeconds,
  countdownTotalSeconds,
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full">
      <div
        className={`flex items-start gap-3 border rounded-lg shadow-md p-3 ${COLORS[variant]}`}
      >
        <div className="flex-1 text-sm leading-relaxed">
          <div className="font-semibold mb-0.5">{variantLabel(variant)}</div>
          <div>{message}</div>
          {typeof countdownSeconds === "number" && (
            <div className="text-xs mt-1 opacity-80">
              Undo available for {countdownSeconds}s
            </div>
          )}
          {typeof countdownSeconds === "number" && countdownTotalSeconds && countdownTotalSeconds > 0 && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/50 overflow-hidden">
              <div
                className="h-full bg-black/30"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (countdownSeconds / countdownTotalSeconds) * 100)
                  )}%`,
                  transition: "width 0.2s linear",
                }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              className="px-3 py-1 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              {actionLabel}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-sm rounded hover:bg-black/5 transition-colors"
            aria-label="Close toast"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function variantLabel(variant: NonNullable<ToastProps["variant"]>) {
  switch (variant) {
    case "info":
      return "Info";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    case "success":
      return "Success";
    default:
      return "Notice";
  }
}
