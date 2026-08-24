import { prisma } from "@/lib/prisma";
import { requireCtx } from "@/server/context";
import { unreadTotal } from "@/server/services/messaging";
import { listNotifications } from "@/server/services/notifications";
import { runMaintenanceSweep } from "@/server/maintenance";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx("ADMIN");
  await runMaintenanceSweep(); // overdue invoices + subscription alerts (throttled)

  const [projectCount, unread, unpaidCount, notifications] = await Promise.all([
    prisma.project.count({ where: { deletedAt: null, status: { notIn: ["CLOTURE"] } } }),
    unreadTotal(ctx),
    prisma.invoice.count({ where: { status: { in: ["EN_ATTENTE", "EN_RETARD"] } } }),
    listNotifications(ctx),
  ]);

  const nav = [
    { href: "/admin", label: "Tableau de bord", icon: "grid" },
    { href: "/admin/clients", label: "Clients", icon: "user" },
    { href: "/admin/projets", label: "Projets", icon: "folder", count: projectCount },
    { href: "/admin/messagerie", label: "Messagerie", icon: "chat", count: unread },
    { href: "/admin/factures", label: "Factures", icon: "invoice", count: unpaidCount },
    { href: "/admin/abonnements", label: "Abonnements", icon: "repeat" },
    { href: "/admin/equipe", label: "Équipe", icon: "team" },
  ];

  return (
    <div className="min-h-screen">
      <Sidebar space="ESPACE ADMIN" items={nav} />
      <div className="pb-20 lg:pb-6 lg:pl-60 print:p-0 print:lg:pl-0">
        <div className="print:hidden">
          <Topbar
            userName={ctx.fullName}
            roleLabel="Admin"
            searchPlaceholder="Rechercher un client, un projet…"
            notifications={notifications}
          />
        </div>
        <main className="px-4 sm:px-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
