"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { IconBell } from "@/components/icons";
import { relativeTime } from "@/lib/format";

export type NotificationData = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string;
  read: boolean;
  createdAt: string;
};

const TYPE_EMOJI: Record<string, string> = {
  STATUT_PROJET: "🔄",
  NOUVEAU_LIVRABLE: "📁",
  NOUVELLE_FACTURE: "🧾",
  NOUVEAU_MESSAGE: "💬",
  ABONNEMENT_ECHEANCE: "⏰",
  DEMANDE_PROJET: "✨",
};

export function NotificationsBell({ notifications }: { notifications: NotificationData[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // opening the panel marks everything read; badges update on next navigation
      try {
        await gql(`mutation { markNotificationsRead }`);
        router.refresh();
      } catch {
        /* non-blocking */
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-xl border border-ink/8 bg-white p-2.5 text-slate-500 shadow-sm hover:text-brand-500"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <IconBell width={18} height={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-105 w-[min(92vw,380px)] overflow-y-auto rounded-2xl border border-ink/8 bg-white shadow-hero">
          <p className="border-b border-ink/5 px-4 py-3 text-[13px] font-semibold text-ink">Notifications</p>
          {notifications.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-slate-400">Aucune notification.</p>
          )}
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`flex gap-3 border-b border-ink/4 px-4 py-3 last:border-0 hover:bg-slate-50 ${n.read ? "" : "bg-brand-50/40"}`}
            >
              <span className="text-[18px] leading-6">{TYPE_EMOJI[n.type] ?? "🔔"}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`truncate text-[13px] ${n.read ? "font-medium text-slate-600" : "font-semibold text-ink"}`}>
                    {n.title}
                  </span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-slate-400">{relativeTime(n.createdAt)}</span>
                </span>
                {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] text-slate-500">{n.body}</span>}
              </span>
              {!n.read && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
