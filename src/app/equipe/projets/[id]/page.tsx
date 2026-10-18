import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx, ForbiddenError } from "@/server/context";
import { teamProject } from "@/server/services/teamPortal";
import { PROJECT_STATUS_LABEL } from "@/lib/format";
import { NeedsSummary } from "@/components/NeedsSummary";
import { Card, CardHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const day = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", day: "numeric", month: "long", year: "numeric" }).format(d) : "—";

const APPROVAL: Record<string, string> = { EN_ATTENTE: "En attente de validation", APPROUVE: "Validé — version finale", REFUSE: "Modifications demandées" };

/** Fiche projet pour l'équipe : étapes, échéance, client, besoins et fichiers — jamais le prix. */
export default async function TeamProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx("EQUIPE");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  let p;
  try {
    p = await teamProject(ctx, BigInt(id));
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href="/equipe" className="text-[12.5px] text-brand-600 hover:underline">← Projets</Link>
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[17px] font-semibold">{p.title}</h2>
        <p className="mt-0.5 text-[12.5px] text-white/80">{p.client.companyName} · {p.service.name}{p.assignedTo ? ` · ${p.assignedTo.fullName}` : ""}</p>
        <div className="mt-4 flex flex-wrap gap-6 text-[13px]">
          <span>Statut : <b>{PROJECT_STATUS_LABEL[p.status] ?? p.status}</b></span>
          <span>Début : <b>{day(p.startDate)}</b></span>
          <span>Échéance : <b>{day(p.dueDate)}</b></span>
          {p.deliveredAt && <span>Livré le : <b>{day(p.deliveredAt)}</b></span>}
        </div>
      </section>

      {p.description && (
        <Card>
          <CardHeader title="Description" />
          <p className="whitespace-pre-line px-6 pb-5 text-[13px] text-ink/80">{p.description}</p>
        </Card>
      )}

      <Card>
        <CardHeader title="Étapes" />
        <ol className="space-y-2 px-6 pb-5 text-[13px]">
          {p.steps.map((s) => (
            <li key={s.position} className={s.reachedAt ? "text-ink" : "text-ink/50"}>
              {s.reachedAt ? "✓" : "○"} {s.label}{s.reachedAt ? ` — ${day(s.reachedAt)}` : ""}
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Client" />
        <dl className="grid gap-x-6 gap-y-1 px-6 pb-5 text-[13px] sm:grid-cols-2">
          <div><dt className="text-ink/50">Entreprise</dt><dd>{p.client.companyName}</dd></div>
          <div><dt className="text-ink/50">Contact</dt><dd>{p.client.contactName || "—"}</dd></div>
          <div><dt className="text-ink/50">E-mail</dt><dd>{p.client.email || "—"}</dd></div>
          <div><dt className="text-ink/50">Téléphone</dt><dd>{p.client.phone || "—"}</dd></div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Besoins du client" />
        <NeedsSummary mainNeeds={p.client.mainNeeds} details={p.client.needsDetails} />
      </Card>

      <Card>
        <CardHeader title="Fichiers du projet" />
        {p.files.length === 0 ? <EmptyState message="Aucun fichier." /> : (
          <ul className="divide-y divide-ink/4">
            {p.files.map((f) => (
              <li key={f.publicId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-[13px]">
                <a href={`/api/files/${f.publicId}`} className="flex-1 font-medium text-brand-600 hover:underline">{f.originalName}</a>
                <span className="text-ink/60">{f.kind === "LIVRABLE" ? `Livrable v${f.version}` : "Fichier"}</span>
                {f.kind === "LIVRABLE" && f.approval && <span className="text-ink/60">{APPROVAL[f.approval] ?? f.approval}</span>}
                <span className="text-ink/50">{day(f.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
