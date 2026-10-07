import Link from "next/link";
import { requireCtx } from "@/server/context";
import { listComplaints, COMPLAINT_CATEGORY_LABEL, COMPLAINT_STATUS_LABEL } from "@/server/services/complaints";
import { Card, CardHeader, Avatar, StatusBadge, EmptyState } from "@/components/ui";
import { ComplaintActions } from "@/components/admin/ComplaintActions";
import { formatDateFull } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminComplaintsPage() {
  const ctx = await requireCtx("ADMIN");
  const complaints = await listComplaints(ctx);
  const open = complaints.filter((c) => c.status === "NOUVELLE" || c.status === "EN_COURS");
  const fresh = complaints.filter((c) => c.status === "NOUVELLE");

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Réclamations clients</h2>
        <p className="mt-0.5 text-[12.5px] text-white/80">
          Engagement publié : accusé de réception sous 2 jours ouvrés, réponse sous 7 jours ouvrés.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-6">
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Sans réponse</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{fresh.length}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Ouvertes</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{open.length}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Au total</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{complaints.length}</p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader title="Toutes les réclamations" subtitle="Les plus urgentes d'abord — répondez, puis changez le statut" />
        <div className="divide-y divide-ink/4 pb-2">
          {complaints.length === 0 && <EmptyState message="Aucune réclamation. Tant mieux." />}
          {complaints.map((c) => (
            <div key={c.id} className="px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Avatar name={c.clientCompany} size={38} />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/clients/${c.clientId}`} className="text-[13.5px] font-semibold text-ink hover:text-brand-600">
                    {c.clientCompany}
                  </Link>
                  <p className="truncate text-[12px] text-ink/60">
                    {c.contactName} · {COMPLAINT_CATEGORY_LABEL[c.category] ?? c.category}
                    {c.projectTitle ? ` · ${c.projectTitle}` : ""} · {formatDateFull(c.createdAt)}
                  </p>
                </div>
                <StatusBadge status={c.status} label={COMPLAINT_STATUS_LABEL[c.status] ?? c.status} />
                <ComplaintActions complaintId={c.id} subject={c.subject} status={c.status} reply={c.adminReply} />
              </div>
              <p className="mt-3 text-[13.5px] font-semibold text-ink">{c.subject}</p>
              <p className="mt-1 text-[13px] whitespace-pre-line text-ink/80">{c.message}</p>
              {c.adminReply && (
                <div className="mt-3 rounded-2xl bg-emerald-50/70 px-4 py-3">
                  <p className="text-[11.5px] font-semibold tracking-wide text-emerald-700 uppercase">
                    Réponse envoyée{c.repliedAt ? ` · ${formatDateFull(c.repliedAt)}` : ""}
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
