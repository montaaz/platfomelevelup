"use client";

import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NotificationsBell, type NotificationData } from "@/components/layout/NotificationsBell";

const TITLES: Record<string, { title: string; subtitle?: (name: string) => string }> = {
  "/admin": { title: "Tableau de bord", subtitle: (n) => `Bonjour ${n.split(" ")[0]}, voici où en est l'agence aujourd'hui.` },
  "/admin/clients": { title: "Clients" },
  "/admin/projets": { title: "Projets" },
  "/admin/messagerie": { title: "Messagerie" },
  "/admin/factures": { title: "Factures" },
  "/admin/abonnements": { title: "Abonnements" },
  "/admin/equipe": { title: "Équipe" },
  "/client": { title: "Mes projets", subtitle: (n) => `Bonjour ${n.split(" ")[0]}, bienvenue dans votre espace.` },
  "/client/messages": { title: "Messages" },
  "/client/factures": { title: "Mes factures" },
  "/client/historique": { title: "Historique" },
  "/client/nouveau-projet": { title: "Nouveau projet" },
  "/client/profil": { title: "Mon profil" },
};

export function Topbar({
  userName,
  roleLabel,
  searchPlaceholder,
  notifications = [],
}: {
  userName: string;
  roleLabel: string;
  searchPlaceholder: string;
  notifications?: NotificationData[];
}) {
  const pathname = usePathname();
  const match =
    TITLES[pathname] ??
    TITLES[Object.keys(TITLES).filter((k) => pathname.startsWith(k)).sort((a, b) => b.length - a.length)[0] ?? ""] ??
    { title: "" };

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-3 sm:gap-x-6 sm:px-6 sm:py-4 lg:px-8">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[19px] font-bold text-ink">{match.title}</h1>
        {match.subtitle && (
          <p className="mt-0.5 hidden truncate text-[12.5px] text-ink/60 sm:block">{match.subtitle(userName)}</p>
        )}
      </div>

      <div className="order-3 flex w-full items-center gap-3 sm:order-2 sm:w-auto">
        <GlobalSearch placeholder={searchPlaceholder} />
        <NotificationsBell notifications={notifications} />
      </div>

      <div className="order-2 flex items-center gap-2.5 sm:order-3 sm:gap-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-mobile-menu"))}
          aria-label="Ouvrir le menu"
          className="rounded-xl border border-white/80 bg-white/70 p-2.5 text-ink/70 shadow-sm lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <Avatar name={userName} size={38} />
        <div className="hidden sm:block">
          <p className="text-[13px] leading-tight font-semibold text-ink">{userName}</p>
          <p className="text-[11.5px] leading-tight text-ink/60">{roleLabel}</p>
        </div>
      </div>
    </header>
  );
}
