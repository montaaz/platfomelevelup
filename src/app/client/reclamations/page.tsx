import { prisma } from "@/lib/prisma";
import { requireCtx } from "@/server/context";
import { myComplaints, COMPLAINT_CATEGORY_LABEL, COMPLAINT_STATUS_LABEL } from "@/server/services/complaints";
import { ComplaintForm } from "@/components/client/ComplaintForm";
import { Card, CardHeader, StatusBadge, EmptyState } from "@/components/ui";
import { formatDateFull } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientComplaintsPage() {
  const ctx = await requireCtx("CLIENT");
  const [complaints, projects] = await Promise.all([
    myComplaints(ctx),
    prisma.project.findMany({
      where: { clientId: ctx.clientId!, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Réclamations</h2>
        <p className="mt-0.5 max-w-xl text-[12.5px] text-white/80">
          Un problème sur une prestation, un délai, un paiement ou une facture ? Dites-le nous ici : accusé de
          réception sous 2 jours ouvrés, réponse écrite sous 7 jours ouvrés.
        </p>
      </section>

      <ComplaintForm projects={projects.map((p) => ({ id: p.id.toString(), title: p.title }))} />

      <Card>
        <CardHeader
          title="Vos réclamations"
          subtitle={complaints.length === 0 ? "Aucune réclamation déposée" : `${complaints.length} au total`}
        />
        <div className="divide-y divide-ink/4 pb-2">
          {complaints.length === 0 && <EmptyState message="Aucune réclamation pour le moment." />}
          {complaints.map((c) => (
            <div key={c.id} className="px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink">{c.subject}</p>
                  <p className="text-[12px] text-ink/60">
                    {COMPLAINT_CATEGORY_LABEL[c.category] ?? c.category}
                    {c.projectTitle ? ` · ${c.projectTitle}` : ""} · {formatDateFull(c.createdAt)}
                  </p>
                </div>
                <StatusBadge status={c.status} label={COMPLAINT_STATUS_LABEL[c.status] ?? c.status} />
              </div>
              <p className="mt-2 text-[13px] whitespace-pre-line text-ink/80">{c.message}</p>
              {c.adminReply && (
                <div className="mt-3 rounded-2xl bg-brand-50/70 px-4 py-3">
                  <p className="text-[11.5px] font-semibold tracking-wide text-brand-600 uppercase">
                    Réponse de l&apos;équipe{c.repliedAt ? ` · ${formatDateFull(c.repliedAt)}` : ""}
                  </p>
                  <p className="mt-1 text-[13px] whitespace-pre-line text-ink/85">{c.adminReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
