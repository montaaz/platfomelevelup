import Link from "next/link";
import { requireCtx } from "@/server/context";
import { listProjects, listClients, listTeam } from "@/server/services/directory";
import { listServicesPublic } from "@/server/services/clientActions";
import { listProjectRequests } from "@/server/services/adminActions";
import { Card, CardHeader, Avatar, StatusBadge, EmptyState } from "@/components/ui";
import { ProjectFormButton } from "@/components/admin/ProjectFormModal";
import { RequestsCard } from "@/components/admin/RequestsCard";
import { formatDT, formatDateShort, PROJECT_STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const ctx = await requireCtx("ADMIN");
  const [projects, clients, services, team, requests] = await Promise.all([
    listProjects(ctx),
    listClients(ctx),
    listServicesPublic(),
    listTeam(ctx),
    listProjectRequests(ctx),
  ]);
  const active = projects.filter((p) => !["LIVRE", "CLOTURE"].includes(p.status));

  return (
    <div className="space-y-5 pb-8">
      <section className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Projets</h2>
        <div className="mt-5 grid grid-cols-3 gap-6">
          <div className="glass-dark rounded-2xl p-4">
            <p className="text-[12px] text-white/55">En cours</p>
            <p className="mt-1 text-[28px] leading-none font-bold">{active.length}</p>
          </div>
          <div className="glass-dark rounded-2xl p-4">
            <p className="text-[12px] text-white/55">En retard</p>
            <p className="mt-1 text-[28px] leading-none font-bold">{projects.filter((p) => p.overdue).length}</p>
          </div>
          <div className="glass-dark rounded-2xl p-4">
            <p className="text-[12px] text-white/55">Valeur en production</p>
            <p className="mt-1 text-[28px] leading-none font-bold">{formatDT(active.reduce((s, p) => s + p.price, 0))}</p>
          </div>
        </div>
      </section>

      <RequestsCard requests={requests} />

      <div className="flex justify-end">
        <ProjectFormButton
          clients={clients.map((c) => ({ id: c.id, name: c.companyName }))}
          services={services.map((s) => ({ id: s.id, name: s.name }))}
          team={team.map((t) => ({ id: t.id, name: t.fullName }))}
        />
      </div>

      <Card>
        <CardHeader title="Tous les projets" subtitle="Triés par échéance la plus proche — cliquez pour ouvrir la fiche" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-175 text-left">
            <thead>
              <tr className="border-y border-ink/5 text-[10.5px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
                <th className="px-6 py-2.5">Client et projet</th>
                <th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5">Assigné à</th>
                <th className="px-4 py-2.5 text-right">Prix</th>
                <th className="px-6 py-2.5 text-right">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-ink/4 last:border-0 hover:bg-slate-50/60">
                  <td className="px-6 py-3.5">
                    <Link href={`/admin/projets/${project.id}`} className="flex items-center gap-3">
                      <Avatar name={project.clientCompany} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-ink hover:text-brand-600">{project.clientCompany}</p>
                        <p className="truncate text-[12px] text-slate-400">{project.title}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-slate-600">{project.serviceName}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={project.status} label={PROJECT_STATUS_LABEL[project.status] ?? project.status} />
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-slate-600">{project.assigneeName ?? "—"}</td>
                  <td className="px-4 py-3.5 text-right text-[13px] font-medium">{formatDT(project.price)}</td>
                  <td className={`px-6 py-3.5 text-right text-[13px] font-medium ${project.overdue ? "text-red-500" : "text-slate-500"}`}>
                    {project.overdue ? "en retard" : formatDateShort(project.dueDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.length === 0 && <EmptyState message="Aucun projet." />}
        </div>
      </Card>
    </div>
  );
}
