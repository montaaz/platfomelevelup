import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx, ForbiddenError } from "@/server/context";
import { adminProjectDetail } from "@/server/services/adminActions";
import { Card, CardHeader, StatusBadge, EmptyState } from "@/components/ui";
import { StatusChanger, ReachStepButton, UploadForm } from "@/components/admin/ProjectDetailActions";
import { IconFile, IconDownload, IconCheck } from "@/components/icons";
import { formatDT, formatDateShort, formatDateFull, formatBytes, PROJECT_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx("ADMIN");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  let p: Awaited<ReturnType<typeof adminProjectDetail>>;
  try {
    p = await adminProjectDetail(ctx, BigInt(id));
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/projets" className="text-[12.5px] font-medium text-white/82 hover:text-white">
              ← Tous les projets
            </Link>
            <h2 className="mt-1 text-[18px] font-semibold">{p.title}</h2>
            <p className="mt-0.5 text-[12.5px] text-white/80">
              {p.clientCompany} · {p.serviceName}
              {p.assigneeName ? ` · assigné à ${p.assigneeName}` : ""}
            </p>
          </div>
          <StatusBadge status={p.status} label={PROJECT_STATUS_LABEL[p.status] ?? p.status} />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Prix</p>
            <p className="mt-1 text-[20px] leading-none font-bold sm:text-[24px]">{formatDT(p.price)}</p>
          </div>
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Début</p>
            <p className="mt-1 text-[20px] leading-none font-bold sm:text-[24px]">{formatDateShort(p.startDate)}</p>
          </div>
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Échéance</p>
            <p className="mt-1 text-[20px] leading-none font-bold sm:text-[24px]">{formatDateShort(p.dueDate)}</p>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Fichiers du projet" subtitle="Livrables visibles côté client dès le dépôt" />
            <div className="divide-y divide-ink/4">
              {p.files.length === 0 && <EmptyState message="Aucun fichier." />}
              {p.files.map((f) => (
                <div key={f.id} className="flex items-center gap-3.5 px-5 py-3 sm:px-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <IconFile width={18} height={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{f.name}</p>
                    <p className="text-[11.5px] text-ink/60">
                      v{f.version} · {formatBytes(f.sizeBytes)} · {f.uploadedByName} · {formatDateFull(f.createdAt)}
                      {f.kind === "ELEMENT_CLIENT" && " · interne"}
                    </p>
                  </div>
                  {f.approval === "APPROUVE" && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
                      <IconCheck width={13} height={13} /> Approuvé
                    </span>
                  )}
                  {f.approval === "EN_ATTENTE" && (
                    <span className="text-[12px] font-medium text-amber-600">En validation</span>
                  )}
                  {f.approval === "REVISION_DEMANDEE" && (
                    <span className="text-[12px] font-medium text-violet-600">Révision demandée</span>
                  )}
                  <a href={`/api/files/${f.publicId}`} className="text-brand-500 hover:text-brand-600" aria-label="Télécharger">
                    <IconDownload width={17} height={17} />
                  </a>
                </div>
              ))}
            </div>
            <UploadForm projectId={p.id} />
          </Card>

          <Card>
            <CardHeader title="Historique des statuts" />
            <div className="divide-y divide-ink/4 pb-2">
              {p.history.length === 0 && <EmptyState message="Aucun changement." />}
              {p.history.map((h, i) => (
                <div key={i} className="px-5 py-3 sm:px-6">
                  <p className="text-[13px] text-ink">
                    {h.oldStatus ? `${PROJECT_STATUS_LABEL[h.oldStatus]} → ` : ""}
                    <span className="font-semibold">{PROJECT_STATUS_LABEL[h.newStatus]}</span>
                    <span className="ml-2 text-[11.5px] text-ink/60">
                      {h.byName} · {formatDateFull(h.createdAt)}
                    </span>
                  </p>
                  {h.comment && <p className="mt-0.5 text-[12.5px] text-ink/72">{h.comment}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="p-5 sm:p-6">
              <StatusChanger projectId={p.id} current={p.status} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Étapes" subtitle="Ce que le client voit dans son suivi" />
            <ol className="space-y-3 px-6 pb-6">
              {p.steps.map((step) => (
                <li key={step.position} className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      step.reachedAt ? "bg-brand-500 text-white" : "border-2 border-slate-200"
                    }`}
                  >
                    {step.reachedAt && <IconCheck width={11} height={11} />}
                  </span>
                  <span className={`flex-1 text-[13px] ${step.reachedAt ? "text-ink" : "text-ink/60"}`}>{step.label}</span>
                  {step.reachedAt ? (
                    <span className="text-[11.5px] text-ink/60">{formatDateShort(step.reachedAt)}</span>
                  ) : (
                    <ReachStepButton projectId={p.id} position={step.position} />
                  )}
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Factures liées" action={{ label: "Factures", href: "/admin/factures" }} />
            <div className="divide-y divide-ink/4 pb-2">
              {p.invoices.length === 0 && <EmptyState message="Aucune facture liée." />}
              {p.invoices.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <p className="flex-1 text-[13px] font-medium text-ink">{i.number}</p>
                  <StatusBadge status={i.status} label={INVOICE_STATUS_LABEL[i.status] ?? i.status} />
                  <p className="w-24 text-right text-[13px] font-semibold">{formatDT(i.total, { decimals: 2 })}</p>
                </div>
              ))}
            </div>
          </Card>

          <Link
            href={`/admin/messagerie/${p.id}`}
            data-tilt className="glass relative block rounded-2xl px-6 py-4 text-center text-[13.5px] font-semibold text-brand-500 hover:bg-white/80"
          >
            Ouvrir la conversation du projet →
          </Link>
        </div>
      </div>
    </div>
  );
}
