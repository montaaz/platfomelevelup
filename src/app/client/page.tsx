import Link from "next/link";
import { requireCtx } from "@/server/context";
import { clientHome } from "@/server/services/dashboard";
import { Card, CardHeader, StatusBadge, Avatar, ProgressBar, EmptyState } from "@/components/ui";
import { DeliverableActions } from "@/components/client/DeliverableActions";
import { IconFile, IconDownload, IconCheck } from "@/components/icons";
import { formatDateShort, formatBytes, relativeTime, PROJECT_STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

function daysUntil(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default async function ClientHomePage() {
  const ctx = await requireCtx("CLIENT");
  const data = await clientHome(ctx);
  const featured = data.featured;
  const days = featured ? daysUntil(featured.dueDate) : null;
  const latestDeliverable = featured?.deliverables[0];
  const awaitingApproval = latestDeliverable && featured?.status === "EN_REVISION" && latestDeliverable.approval !== "APPROUVE";

  return (
    <div className="space-y-5 pb-8">
      {featured ? (
        <>
          {/* ============================== Hero: the project awaiting action */}
          <section data-tilt className="hero-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-hero sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-semibold">{featured.title}</h2>
                <p className="mt-0.5 text-[12px] text-white/78">
                  {featured.serviceName}
                  {featured.startDate ? `, démarré le ${formatDateShort(featured.startDate)}` : ""}
                </p>
              </div>
              <span className="rounded-full border border-white/25 px-3.5 py-1.5 text-[12px] font-medium text-white/80">
                Projet en cours
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
              <div className="glass-dark rounded-2xl p-4">
                <p className="text-[12px] text-white/80">Statut actuel</p>
                <p className="mt-1 text-[26px] leading-tight font-bold">{PROJECT_STATUS_LABEL[featured.status]}</p>
                <p className="mt-1 text-[11.5px] text-white/78">
                  {featured.status === "EN_REVISION" ? "votre validation est attendue" : "l'équipe travaille pour vous"}
                </p>
              </div>
              <div className="glass-dark rounded-2xl p-4">
                <p className="text-[12px] text-white/80">Livrables disponibles</p>
                <p className="mt-1 text-[26px] leading-tight font-bold">{featured.deliverables.length}</p>
                <p className="mt-1 text-[11.5px] text-white/78">prêts à télécharger</p>
              </div>
              <div className="glass-dark rounded-2xl p-4">
                <p className="text-[12px] text-white/80">Échéance prévue</p>
                <p className="mt-1 text-[26px] leading-tight font-bold">{formatDateShort(featured.dueDate)}</p>
                <p className="mt-1 text-[11.5px] text-white/78">
                  {days != null ? (days >= 0 ? `dans ${days} jour${days > 1 ? "s" : ""}` : `dépassée de ${-days} j`) : "à planifier"}
                </p>
              </div>
              <div className="glass-dark rounded-2xl p-4">
                <p className="text-[12px] text-white/80">Facture liée</p>
                <p className="mt-1 text-[26px] leading-tight font-bold">{featured.pendingInvoices}</p>
                <p className="mt-1 text-[11.5px] text-white/78">
                  {featured.pendingInvoices > 0 ? "en attente de paiement" : "aucun paiement attendu"}
                </p>
              </div>
            </div>
          </section>

          {/* ============================== Livrables + avancement */}
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <Card>
              <CardHeader title="Vos livrables" subtitle="Fichiers déposés par l'équipe pour ce projet" />
              <div className="divide-y divide-ink/4">
                {featured.deliverables.length === 0 && <EmptyState message="Aucun livrable pour le moment." />}
                {featured.deliverables.map((file) => (
                  <div key={file.id} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                      <IconFile width={18} height={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{file.name}</p>
                      <p className="text-[11.5px] text-ink/60">
                        {file.mime.split("/")[1]?.toUpperCase()}, {formatBytes(file.sizeBytes)} · Version {file.version} · déposée
                        le {formatDateShort(file.createdAt)}
                      </p>
                    </div>
                    {file.approval === "APPROUVE" && (
                      <span className="hidden items-center gap-1 text-[12px] font-medium text-emerald-600 sm:inline-flex">
                        <IconCheck width={13} height={13} /> Approuvé
                      </span>
                    )}
                    <a
                      href={`/api/files/${file.publicId}`}
                      className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand-500 hover:text-brand-600"
                    >
                      <IconDownload width={15} height={15} />
                      <span className="hidden sm:inline">Télécharger</span>
                    </a>
                  </div>
                ))}
              </div>
              {awaitingApproval && <DeliverableActions fileId={latestDeliverable.id} version={latestDeliverable.version} />}
            </Card>

            <Card>
              <CardHeader title="Avancement" subtitle="Étapes franchies et dates" />
              <ol className="space-y-0 px-6 pb-6">
                {featured.steps.map((step, i) => {
                  const done = !!step.reachedAt;
                  const isCurrent = !done && featured.steps.slice(0, i).every((s) => s.reachedAt);
                  return (
                    <li key={step.position} className="relative flex gap-3.5 pb-5 last:pb-0">
                      {i < featured.steps.length - 1 && (
                        <span
                          className={`absolute top-6 left-[11px] h-full w-0.5 ${done ? "bg-brand-400" : "bg-slate-200"}`}
                        />
                      )}
                      <span
                        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                          done
                            ? "border-brand-500 bg-brand-500 text-white"
                            : isCurrent
                              ? "border-violet-500 bg-white"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        {done ? (
                          <IconCheck width={12} height={12} />
                        ) : (
                          <span className={`h-2 w-2 rounded-full ${isCurrent ? "bg-violet-500" : "bg-slate-200"}`} />
                        )}
                      </span>
                      <div className="pt-0.5">
                        <p className={`text-[13.5px] font-medium ${done || isCurrent ? "text-ink" : "text-ink/60"}`}>
                          {step.label}
                        </p>
                        <p className={`text-[11.5px] ${isCurrent ? "font-medium text-violet-500" : "text-ink/60"}`}>
                          {done ? formatDateShort(step.reachedAt) : isCurrent ? "en attente" : "à venir"}
                        </p>
                      </div>
                    </li>
                  );
                })}
                {featured.steps.length === 0 && <EmptyState message="Étapes non définies." />}
              </ol>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <EmptyState message="Aucun projet en cours. Utilisez « Nouveau projet » pour lancer une demande." />
        </Card>
      )}

      {/* ============================== Autres projets + messages */}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title="Vos autres projets"
            subtitle={`${data.others.length} projet${data.others.length > 1 ? "s" : ""} en cours`}
            action={{ label: "Tout voir", href: "/client/historique" }}
          />
          <div className="divide-y divide-ink/4 pb-2">
            {data.others.length === 0 && <EmptyState message="Aucun autre projet en cours." />}
            {data.others.map((project) => (
              <div key={project.id} className="px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <Avatar name={project.title} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{project.title}</p>
                    <p className="text-[11.5px] text-ink/60">{project.serviceName}</p>
                  </div>
                  <StatusBadge status={project.status} label={PROJECT_STATUS_LABEL[project.status] ?? project.status} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <ProgressBar percent={project.progress} />
                  </div>
                  <p className="text-[11.5px] whitespace-nowrap text-ink/60">
                    {project.dueDate ? `Échéance ${formatDateShort(project.dueDate)}` : `${project.progress} %`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Messages de l'équipe"
            subtitle={`${data.unreadCount} message${data.unreadCount > 1 ? "s" : ""} non lu${data.unreadCount > 1 ? "s" : ""}`}
            action={{ label: "Répondre", href: "/client/messages" }}
          />
          <div className="divide-y divide-ink/4 pb-2">
            {data.teamMessages.length === 0 && <EmptyState message="Aucun message." />}
            {data.teamMessages.map((message, i) => (
              <Link
                key={i}
                href={`/client/messages/${message.projectId}`}
                className="flex gap-3 px-5 py-3.5 hover:bg-white/40 sm:px-6"
              >
                <Avatar name={message.senderName} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-ink">{message.senderName}, Level Up IA</p>
                    {message.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />}
                    <span className="ml-auto shrink-0 text-[11px] text-ink/60">{relativeTime(message.createdAt)}</span>
                  </div>
                  <p className="truncate text-[11.5px] font-medium text-brand-500">{message.projectTitle}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-ink/72">{message.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
