import { redirect } from "next/navigation";
import { requireCtx } from "@/server/context";
import { listNotifications } from "@/server/services/notifications";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { TiltEffects } from "@/components/layout/TiltEffects";

/**
 * Espace équipe (notes de Sarra, §03) : projets, échéances et clients,
 * sans aucune donnée financière (ni prix, ni facture, ni commande).
 */
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await requireCtx("EQUIPE");
  } catch {
    redirect("/api/auth/logout?motif=compte_bloque");
  }
  const notifications = await listNotifications(ctx);

  const nav = [
    { href: "/equipe", label: "Projets & échéances", short: "Projets", icon: "folder" },
    { href: "/equipe/clients", label: "Clients", icon: "user" },
  ];

  return (
    <div className="min-h-screen">
      <TiltEffects />
      <Sidebar space="ESPACE ÉQUIPE" items={nav} userName={ctx.fullName} roleLabel="Équipe" />
      <div className="pb-28 lg:pb-6 lg:pl-[17.5rem]">
        <Topbar userName={ctx.fullName} roleLabel="Équipe" notifications={notifications} />
        <main className="px-3 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
