import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/context";
import { unreadTotal } from "@/server/services/messaging";
import { listNotifications } from "@/server/services/notifications";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { TiltEffects } from "@/components/layout/TiltEffects";
import { BuddyWidget } from "@/components/buddy/BuddyWidget";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  // Compte bloqué par un administrateur : la session est close sur-le-champ,
  // sans attendre l'expiration du jeton.
  let ctx;
  try {
    ctx = await requireCtx("CLIENT");
  } catch {
    redirect("/api/auth/logout?motif=compte_bloque");
  }

  // Le questionnaire d'accueil est requis avant tout.
  const gate = await prisma.client.findUnique({
    where: { id: ctx.clientId! },
    select: { onboardingCompletedAt: true },
  });
  if (!gate?.onboardingCompletedAt) redirect("/bienvenue");

  // Notes de Sarra (§02) : tant que le paiement n'est pas confirmé, la plateforme
  // reste fermée. Un client qui a une commande en attente et aucune commande
  // payée est renvoyé vers « Régler ma commande » (RIB, carte, état du virement).
  // Un client sans commande (demande de devis, site marchand) garde l'accès.
  const [paid, waiting] = await Promise.all([
    prisma.order.count({ where: { clientId: ctx.clientId!, status: "PAYEE" } }),
    prisma.order.count({ where: { clientId: ctx.clientId!, status: "EN_ATTENTE_PAIEMENT" } }),
  ]);
  if (waiting > 0 && paid === 0) redirect("/paiement");

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
    { href: "/client/reclamations", label: "Réclamations", icon: "flag" },
    { href: "/client/besoins", label: "Paramétrage", icon: "grid" },
    { href: "/client/profil", label: "Mon profil", icon: "user" },
  ];

  return (
    <div className="min-h-screen">
      <TiltEffects />
      <BuddyWidget role="CLIENT" />
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
