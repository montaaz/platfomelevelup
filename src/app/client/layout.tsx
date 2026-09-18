import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/context";
import { unreadTotal } from "@/server/services/messaging";
import { listNotifications } from "@/server/services/notifications";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { TiltEffects } from "@/components/layout/TiltEffects";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx("CLIENT");

  const gate = await prisma.client.findUnique({
    where: { id: ctx.clientId! },
    select: { onboardingCompletedAt: true, accessGranted: true },
  });
  // 1) paiement non confirmé → aucun accès à l'espace client
  if (!gate?.accessGranted) redirect("/paiement");
  // 2) questionnaire d'accueil non rempli → on y renvoie
  if (!gate.onboardingCompletedAt) redirect("/bienvenue");

  const [client, projectCount, unread, notifications] = await Promise.all([
    prisma.client.findUnique({ where: { id: ctx.clientId! }, select: { companyName: true } }),
    prisma.project.count({
      where: { clientId: ctx.clientId!, deletedAt: null, status: { notIn: ["CLOTURE"] } },
    }),
    unreadTotal(ctx),
    listNotifications(ctx),
  ]);

  const nav = [
    { href: "/client", label: "Mes projets", short: "Projets", icon: "folder", count: projectCount },
    { href: "/client/messages", label: "Messages", icon: "chat", count: unread },
    { href: "/client/factures", label: "Mes factures", short: "Factures", icon: "invoice" },
    { href: "/client/historique", label: "Historique", icon: "history" },
    { href: "/client/nouveau-projet", label: "Nouveau projet", short: "Nouveau", icon: "plus" },
    { href: "/client/profil", label: "Mon profil", icon: "user" },
  ];

  return (
    <div className="min-h-screen">
      <TiltEffects />
      <Sidebar space="ESPACE CLIENT" items={nav} userName={ctx.fullName} roleLabel={client?.companyName ?? "Client"} />
      <div className="pb-28 lg:pb-6 lg:pl-[17.5rem] print:p-0 print:lg:pl-0">
        <div className="print:hidden">
          <Topbar
            userName={ctx.fullName}
            roleLabel={client?.companyName ?? "Client"}
            searchPlaceholder="Rechercher un projet, une facture…"
            notifications={notifications}
          />
        </div>
        <main className="px-3 sm:px-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
