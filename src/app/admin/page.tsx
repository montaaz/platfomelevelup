import Link from "next/link";
import { requireCtx } from "@/server/context";
import { adminDashboard } from "@/server/services/dashboard";
import { Card, CardHeader, StatusBadge, Avatar, EmptyState } from "@/components/ui";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { formatDT, formatDateShort, formatDateFull, relativeTime, PROJECT_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "7", label: "7 j" },
  { key: "30", label: "30 j" },
  { key: "365", label: "12 mois" },
] as const;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const ctx = await requireCtx("ADMIN");
  const { p } = await searchParams;
  const periodDays = p === "7" ? 7 : p === "365" ? 365 : 30;
  const data = await adminDashboard(ctx, periodDays);
  const { kpis } = data;

  return (
    <div className="space-y-5 pb-8">
      {/* ============================== Hero banner */}
      <section data-tilt className="hero-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Pilotage de l&apos;agence</h2>
            <p className="mt-0.5 text-[12px] text-white/78">
              {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}, mis à jour à l&apos;instant
            </p>
          </div>
          <div className="flex rounded-full bg-white/10 p-1 text-[12px] font-medium">
            {PERIODS.map((period) => (
              <Link
                key={period.key}
                href={`/admin?p=${period.key}`}
                className={`rounded-full px-3.5 py-1.5 transition ${
                  String(periodDays) === period.key ? "bg-white text-ink shadow" : "text-white/82 hover:text-white"
                }`}
              >
                {period.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-x-6 sm:gap-y-5 lg:grid-cols-4">
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Chiffre d&apos;affaires du mois</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[30px] tracking-tight">{formatDT(kpis.revenueMonth)}</p>
            <p className="mt-1.5 text-[11.5px] text-emerald-300">
              {kpis.revenueTrendPct != null
                ? `${kpis.revenueTrendPct >= 0 ? "↑" : "↓"} ${Math.abs(kpis.revenueTrendPct)} % vs mois dernier`
                : "premier mois facturé"}
            </p>
          </div>
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Projets en cours</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[30px] tracking-tight">{kpis.projectsInProgress}</p>
            <p className="mt-1.5 text-[11.5px] text-emerald-300">
              ↑ {kpis.newProjectsThisWeek} nouveau{kpis.newProjectsThisWeek > 1 ? "x" : ""} cette semaine
            </p>
          </div>
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Factures impayées</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[30px] tracking-tight">{kpis.unpaidCount}</p>
            <p className="mt-1.5 text-[11.5px] text-white/78">{formatDT(kpis.unpaidTotal)} à recouvrer</p>
          </div>
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Demandes de révision</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[30px] tracking-tight">{kpis.revisionRequests}</p>
            <p className="mt-1.5 text-[11.5px] text-white/78">en attente de réponse</p>
          </div>
        </div>
      </section>

      {/* ============================== CA + revenu par service */}
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title="Chiffre d'affaires"
            subtitle="Facturé par mois, en milliers de dinars"
            action={{ label: "Voir le détail", href: "/admin/factures" }}
          />
          <div className="px-3 pb-4 sm:px-4">
            <RevenueChart data={data.revenueByMonth} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Revenu par service" subtitle={`${periodDays === 365 ? "12 derniers mois" : `${periodDays} derniers jours`}`} />
          <div className="space-y-4 px-5 pb-5 sm:px-6">
            {data.revenueByService.length === 0 && <EmptyState message="Aucun revenu sur la période." />}
            {data.revenueByService.map((s, i) => {
              const max = data.revenueByService[0]?.total || 1;
              return (
                <div key={s.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-medium text-ink">
                      {s.name}
                      <span className="ml-2 text-[11.5px] font-normal text-ink/60">
                        {s.projectCount} projet{s.projectCount > 1 ? "s" : ""}
                      </span>
                    </p>
                    <p className="text-[13px] font-semibold whitespace-nowrap">{formatDT(s.total)}</p>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(6, (s.total / max) * 100)}%`,
                        background: s.color ?? ["#1687ff", "#38bdf8", "#a855f7", "#8527ff", "#818cf8"][i % 5],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ============================== Projets + messagerie/factures */}
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title="Projets en cours"
            subtitle="Triés par échéance la plus proche"
            action={{ label: "Tous les projets", href: "/admin/projets" }}
          />
          <div className="overflow-x-auto">
            <table className="rt w-full min-w-130 text-left">
              <thead>
                <tr className="border-y border-ink/5 text-[10.5px] font-semibold tracking-[0.1em] text-ink/60 uppercase">
                  <th className="px-6 py-2.5">Client et service</th>
                  <th className="px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5">Assigné à</th>
                  <th className="px-6 py-2.5 text-right">Échéance</th>
                </tr>
              </thead>
              <tbody>
                {data.currentProjects.map((project) => (
                  <tr key={project.id} className="border-b border-ink/4 last:border-0 hover:bg-white/40">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={project.clientCompany} size={36} />
                        <div className="min-w-0">
                          <p className="sm:truncate text-[13.5px] font-semibold text-ink">{project.clientCompany}</p>
                          <p className="truncate text-[12px] text-ink/60">{project.serviceName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={project.status} label={PROJECT_STATUS_LABEL[project.status] ?? project.status} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink/72">
                      {project.assigneeName ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={project.assigneeName} size={26} />
                          {project.assigneeName.split(" ")[0]} {project.assigneeName.split(" ")[1]?.[0]}.
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`px-6 py-3 text-right text-[13px] font-medium ${project.overdue ? "text-red-500" : "text-ink/72"}`}>
                      {project.overdue ? "en retard" : formatDateShort(project.dueDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.currentProjects.length === 0 && <EmptyState message="Aucun projet en cours." />}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Messagerie"
              subtitle={`${data.threads.filter((t) => t.unread).length} message(s) non lu(s)`}
              action={{ label: "Ouvrir", href: "/admin/messagerie" }}
            />
            <div className="divide-y divide-ink/4 pb-2">
              {data.threads.length === 0 && <EmptyState message="Aucun message." />}
              {data.threads.map((thread) => (
                <Link
                  key={thread.projectId}
                  href={`/admin/messagerie/${thread.projectId}`}
                  className="flex gap-3 px-5 py-3.5 hover:bg-white/40 sm:px-6"
                >
                  <Avatar name={thread.clientCompany} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-ink">{thread.clientCompany}</p>
                      {thread.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />}
                      <span className="ml-auto shrink-0 text-[11px] text-ink/60">{relativeTime(thread.createdAt)}</span>
                    </div>
                    <p className="truncate text-[11.5px] font-medium text-brand-500">{thread.projectTitle}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-ink/72">{thread.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Factures à suivre" subtitle="Impayées et en retard" action={{ label: "Tout voir", href: "/admin/factures" }} />
            <div className="divide-y divide-ink/4 pb-2">
              {data.invoicesToFollow.length === 0 && <EmptyState message="Aucune facture à suivre." />}
              {data.invoicesToFollow.map((invoice) => (
                <div key={invoice.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <Avatar name={invoice.clientCompany} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{invoice.clientCompany}</p>
                    <p className="text-[11.5px] text-ink/60">{invoice.number}</p>
                  </div>
                  <StatusBadge status={invoice.status} label={INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status} />
                  <p className="w-24 text-right text-[13px] font-semibold whitespace-nowrap">{formatDT(invoice.total, { decimals: 2 })}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <p className="text-center text-[11px] text-ink/40">
        Données au {formatDateFull(new Date())} — Level Up IA
      </p>
    </div>
  );
}
