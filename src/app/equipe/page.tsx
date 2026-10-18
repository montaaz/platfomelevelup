import Link from "next/link";
import { requireCtx } from "@/server/context";
import { teamProjects } from "@/server/services/teamPortal";
import { PROJECT_STATUS_LABEL } from "@/lib/format";
import { Card, CardHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

/** Projets en cours, triés par échéance (la plus proche d'abord). */
export default async function TeamHomePage() {
  const ctx = await requireCtx("EQUIPE");
  const projects = await teamProjects(ctx);
  const overdue = projects.filter((p) => p.overdue).length;
  const mine = projects.filter((p) => p.mine).length;

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Bonjour {ctx.fullName.split(" ")[0]}</h2>
        <p className="mt-0.5 text-[12.5px] text-white/80">Projets en cours et échéances de l&apos;agence.</p>
        <div className="mt-4 flex flex-wrap gap-6">
          <p className="text-[22px] font-bold">{projects.length} <span className="text-[13px] font-medium text-white/80">projet(s) en cours</span></p>
          <p className="text-[22px] font-bold">{mine} <span className="text-[13px] font-medium text-white/80">assigné(s) à vous</span></p>
          <p className="text-[22px] font-bold">{overdue} <span className="text-[13px] font-medium text-white/80">en retard</span></p>
        </div>
      </section>
      <Card>
        <CardHeader title="Projets & échéances" subtitle="Triés par date de livraison prévue" />
        {projects.length === 0 ? <EmptyState message="Aucun projet en cours." /> : (
          <ul className="divide-y divide-ink/4">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/equipe/projets/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-[13px] hover:bg-ink/3">
                  <span className="min-w-[12rem] flex-1">
                    <span className="block font-semibold text-ink">{p.title}</span>
                    <span className="text-ink/60">{p.client.name} · {p.service}{p.assignee ? ` · ${p.assignee}` : ""}</span>
                  </span>
                  <span className="text-ink/70">{PROJECT_STATUS_LABEL[p.status] ?? p.status}</span>
                  <span className="w-32 text-ink/70">{p.nextStep ? `→ ${p.nextStep}` : "Toutes les étapes franchies"} <span className="text-ink/50">({p.progress} %)</span></span>
                  <span className={`w-28 text-right font-medium ${p.overdue ? "text-rose-600" : "text-ink"}`}>
                    {p.overdue ? "⚠ " : ""}{day(p.dueDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
