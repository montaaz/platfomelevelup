"use client";

import type { ReactNode } from "react";

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
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-hero sm:rounded-3xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-ink/10 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";
export const labelCls = "mb-1 block text-[12.5px] font-medium text-ink";
export const primaryBtnCls =
  "rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-md shadow-brand-500/25 hover:opacity-95 disabled:opacity-60";
export const secondaryBtnCls =
  "rounded-xl border border-ink/10 px-4 py-2.5 text-[13.5px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60";
