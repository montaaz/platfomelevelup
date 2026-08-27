"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconGrid, IconUser, IconUsers, IconFolder, IconChat, IconInvoice,
  IconRepeat, IconTeam, IconLogout, IconHistory, IconPlus,
} from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  count?: number;
};

const ICONS: Record<string, (p: { width?: number; height?: number }) => ReactNode> = {
  grid: IconGrid,
  user: IconUser,
  users: IconUsers,
  folder: IconFolder,
  chat: IconChat,
  invoice: IconInvoice,
  repeat: IconRepeat,
  team: IconTeam,
  history: IconHistory,
  plus: IconPlus,
};

export function Sidebar({ space, items }: { space: "ESPACE ADMIN" | "ESPACE CLIENT"; items: NavItem[] }) {
  const pathname = usePathname();
  const rootHref = items[0]!.href;
  const isActive = (href: string) =>
    href === rootHref ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col glass border-y-0 border-l-0 rounded-none lg:flex print:lg:hidden">
        <div className="px-6 pt-6 pb-5">
          <Link href={rootHref} className="block">
            <span className="text-[19px] font-extrabold tracking-wide text-ink">
              LEVEL UP<span className="brand-text-gradient"> IA</span>
            </span>
            <span className="mt-0.5 block text-[9.5px] font-medium tracking-[0.14em] text-ink/60 uppercase">
              Digital marketing powered by AI
            </span>
          </Link>
        </div>

        <p className="px-6 pb-2 text-[10.5px] font-semibold tracking-[0.14em] text-ink/60">{space}</p>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((item) => {
            const Icon = ICONS[item.icon]!;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-md shadow-brand-500/30"
                    : "text-ink/72 hover:bg-brand-50 hover:text-brand-600"
                }`}
              >
                <Icon width={18} height={18} />
                <span className="flex-1">{item.label}</span>
                {item.count != null && item.count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-ink/72"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <form action="/api/auth/logout" method="POST" className="border-t border-ink/5 p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-[13.5px] font-medium text-ink/72 hover:bg-red-50 hover:text-red-600"
          >
            <IconLogout width={18} height={18} />
            Déconnexion
          </button>
        </form>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around glass border-x-0 border-b-0 rounded-none lg:hidden print:hidden">
        {items.slice(0, 5).map((item) => {
          const Icon = ICONS[item.icon]!;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                active ? "text-brand-500" : "text-ink/60"
              }`}
            >
              <Icon width={20} height={20} />
              <span className="truncate">{item.label}</span>
              {item.count != null && item.count > 0 && (
                <span className="absolute top-1.5 right-1/2 -mr-5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
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
