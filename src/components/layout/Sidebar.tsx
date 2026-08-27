"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  IconGrid, IconUser, IconUsers, IconFolder, IconChat, IconInvoice,
  IconRepeat, IconTeam, IconLogout, IconHistory, IconPlus,
} from "@/components/icons";
import { Avatar } from "@/components/ui";

export type NavItem = { href: string; label: string; short?: string; icon: string; count?: number };

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
  const [menuOpen, setMenuOpen] = useState(false);

  // header hamburger (Topbar) opens the same sheet
  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener("open-mobile-menu", open);
    return () => window.removeEventListener("open-mobile-menu", open);
  }, []);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

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

        <nav className="sidebar-nav -mx-1 flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto px-2 pr-3">
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

      {/* ===================== Mobile: floating bottom dock (4 items + Menu) */}
      <nav className="dock fixed inset-x-2 bottom-2 z-30 flex items-stretch justify-around rounded-[22px] px-1 py-1.5 lg:hidden print:hidden">
        {items.slice(0, 4).map((item) => {
          const Icon = ICONS[item.icon]!;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dock-item relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[10.5px] font-semibold ${
                active ? "dock-active text-white" : "text-ink/65"
              }`}
            >
              <Icon width={20} height={20} />
              <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
              {item.count != null && item.count > 0 && (
                <span className={`absolute top-1 right-[18%] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${active ? "bg-white text-violet-600" : "bg-violet-500 text-white"}`}>
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className={`dock-item flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[10.5px] font-semibold ${menuOpen ? "dock-active text-white" : "text-ink/65"}`}
          aria-label="Ouvrir le menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <span>Menu</span>
        </button>
      </nav>

      {/* ===================== Mobile: full navigation sheet */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-ink/45 backdrop-blur-sm" />
          <div className="sheet absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-white px-4 pt-3 pb-6">
            <span className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-ink/15" />
            <div className="mb-4 flex items-center gap-3 px-1">
              <span className="keycap flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-[15px] font-black text-white">LU</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold tracking-wide text-ink">LEVEL UP<span className="brand-text-gradient"> IA</span></p>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-ink/50 uppercase">{space}</p>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Fermer" className="rounded-full bg-ink/5 p-2.5 text-ink/70">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {items.map((item) => {
                const Icon = ICONS[item.icon]!;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-tile relative flex items-center gap-3 rounded-2xl border p-3 text-[13px] font-semibold ${
                      active ? "nav-tile-active border-transparent text-white" : "border-ink/8 bg-ink/[0.03] text-ink"
                    }`}
                  >
                    <span className={`keycap flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${active ? "from-white/30 to-white/10" : ICON_TINT[item.icon]}`}>
                      <Icon width={17} height={17} />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
                    {item.count != null && item.count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${active ? "bg-white/25 text-white" : "bg-violet-500 text-white"}`}>{item.count}</span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="user-tile mt-4 rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <Avatar name={userName} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{userName}</p>
                  <p className="truncate text-[11.5px] text-ink/60">{roleLabel}</p>
                </div>
              </div>
              <form action="/api/auth/logout" method="POST" className="mt-3">
                <button type="submit" className="btn-glass flex w-full items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white py-2.5 text-[13px] font-semibold text-ink/80 hover:text-red-600">
                  <IconLogout width={15} height={15} />
                  Déconnexion
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
