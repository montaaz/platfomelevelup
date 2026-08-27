"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({
  title,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // lock page scroll + close on Escape while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  // Portal: escapes any transformed ancestor (which would break position: fixed)
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl glass-strong p-6 sm:rounded-3xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-2 text-ink/60 hover:bg-slate-100 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const inputCls =
  "w-full rounded-xl border border-white/70 bg-white/55 backdrop-blur-md px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";
export const labelCls = "mb-1 block text-[12.5px] font-medium text-ink";
export const primaryBtnCls =
  "rounded-xl btn-3d bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-md shadow-brand-500/25 hover:opacity-95 disabled:opacity-60";
export const secondaryBtnCls =
  "btn-glass rounded-xl border border-white/80 bg-white/60 px-4 py-2.5 text-[13.5px] font-medium text-ink/82 disabled:opacity-60";
