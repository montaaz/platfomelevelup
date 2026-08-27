"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconGrid, IconUser, IconUsers, IconFolder, IconChat, IconInvoice,
  IconRepeat, IconTeam, IconLogout, IconHistory, IconPlus,
} from "@/components/icons";
import { Avatar } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: string; count?: number };

const ICONS: Record<string, (p: { width?: number; height?: number }) => ReactNode> = {
  grid: IconGrid, user: IconUser, users: IconUsers, folder: IconFolder, chat: IconChat,
  invoice: IconInvoice, repeat: IconRepeat, team: IconTeam, history: IconHistory, plus: IconPlus,
};

/* each icon box gets its own tint — like a set of 3D keycaps */
const ICON_TINT: Record<string, string> = {
  grid: "from-brand-400 to-brand-600", user: "from-sky-400 to-brand-500", users: "from-sky-400 to-brand-500",
  folder: "from-violet-400 to-violet-600", chat: "from-fuchsia-400 to-violet-600", invoice: "from-emerald-400 to-teal-600",
  repeat: "from-amber-400 to-orange-500", team: "from-pink-400 to-rose-500", history: "from-indigo-400 to-violet-600",
  plus: "from-brand-400 to-violet-500",
};

export function Sidebar({
  space, items, userName, roleLabel,
}: { space: "ESPACE ADMIN" | "ESPACE CLIENT"; items: NavItem[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();
  const rootHref = items[0]!.href;
  const isActive = (href: string) => (href === rootHref ? pathname === href : pathname.startsWith(href));

  return (
    <>
      {/* ===================== Desktop: floating 3D glass panel */}
      <aside className="sidebar-panel glass fixed top-4 bottom-4 left-4 z-30 hidden w-60 flex-col rounded-3xl p-3 lg:flex print:lg:hidden">
        {/* logo badge */}
        <Link href={rootHref} className="logo-tile mx-1 mt-1 flex items-center gap-3 rounded-2xl p-3">
          <span className="keycap flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-[15px] font-black text-white">
            LU
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] leading-tight font-extrabold tracking-wide text-ink">
              LEVEL UP<span className="brand-text-gradient"> IA</span>
            </span>
            <span className="block truncate text-[8.5px] font-semibold tracking-[0.16em] text-ink/55 uppercase">
              Powered by AI
            </span>
          </span>
        </Link>

        <p className="mt-5 mb-2 px-4 text-[10px] font-bold tracking-[0.18em] text-ink/45">{space}</p>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon]!;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-tile group flex items-center gap-3 rounded-2xl px-2.5 py-2 text-[13.5px] font-medium ${
                  active ? "nav-tile-active text-white" : "text-ink/80"
                }`}
              >
                <span
                  className={`keycap flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${
                    active ? "from-white/30 to-white/10" : ICON_TINT[item.icon]
                  }`}
                >
                  <Icon width={17} height={17} />
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.count != null && item.count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      active ? "bg-white/25 text-white" : "keycap-sm bg-white/80 text-ink/80"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* user card + logout */}
        <div className="user-tile mx-1 mt-3 rounded-2xl p-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar name={userName} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] leading-tight font-semibold text-ink">{userName}</p>
              <p className="truncate text-[11px] leading-tight text-ink/60">{roleLabel}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="POST" className="mt-2.5">
            <button
              type="submit"
              className="btn-glass flex w-full items-center justify-center gap-2 rounded-xl border border-white/80 bg-white/60 py-2 text-[12.5px] font-semibold text-ink/80 hover:text-red-600"
            >
              <IconLogout width={15} height={15} />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* ===================== Mobile: floating bottom dock */}
      <nav className="glass fixed inset-x-3 bottom-3 z-30 flex items-stretch justify-around rounded-3xl px-1 py-1.5 lg:hidden print:hidden">
        {items.slice(0, 5).map((item) => {
          const Icon = ICONS[item.icon]!;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium ${
                active ? "nav-tile-active text-white" : "text-ink/65"
              }`}
            >
              <Icon width={19} height={19} />
              <span className="truncate">{item.label}</span>
              {item.count != null && item.count > 0 && (
                <span className="absolute top-0.5 right-1/2 -mr-5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-bold text-white">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
