import { requireCtx } from "@/server/context";
import { listSubscriptions } from "@/server/services/directory";
import { Card, CardHeader, Avatar, StatusBadge, EmptyState } from "@/components/ui";
import { formatDT, formatDateFull } from "@/lib/format";

export const dynamic = "force-dynamic";

const SUB_LABEL: Record<string, string> = {
  ACTIF: "Actif",
  EN_PAUSE: "En pause",
  ANNULE: "Annulé",
  EXPIRE: "Expiré",
};

export default async function AdminSubscriptionsPage() {
  const ctx = await requireCtx("ADMIN");
  const subs = await listSubscriptions(ctx);
  const active = subs.filter((s) => s.status === "ACTIF");

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Abonnements mensuels</h2>
        <div className="mt-5 grid grid-cols-3 gap-6">
          <div className="glass-dark rounded-2xl p-4">
            <p className="text-[12px] text-white/80">Abonnements actifs</p>
            <p className="mt-1 text-[28px] leading-none font-bold">{active.length}</p>
          </div>
          <div className="glass-dark rounded-2xl p-4">
            <p className="text-[12px] text-white/80">Revenu mensuel récurrent</p>
            <p className="mt-1 text-[28px] leading-none font-bold">{formatDT(active.reduce((s, x) => s + x.monthlyAmount, 0))}</p>
          </div>
          <div className="glass-dark rounded-2xl p-4">
            <p className="text-[12px] text-white/80">Échéances sous 14 jours</p>
            <p className="mt-1 text-[28px] leading-none font-bold">{subs.filter((s) => s.renewalSoon).length}</p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader title="Tous les abonnements" subtitle="Une alerte est déclenchée avant chaque fin de période" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-150 text-left">
            <thead>
              <tr className="border-y border-ink/5 text-[10.5px] font-semibold tracking-[0.1em] text-ink/60 uppercase">
                <th className="px-6 py-2.5">Client</th>
                <th className="px-4 py-2.5">Formule</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5">Reconduction</th>
                <th className="px-6 py-2.5 text-right">Mensuel</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr key={sub.id} className="border-b border-ink/4 last:border-0 hover:bg-white/40">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={sub.clientCompany} size={36} />
                      <p className="truncate text-[13.5px] font-semibold text-ink">{sub.clientCompany}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[12px] font-medium text-violet-600">
                      {sub.planName}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={sub.status} label={SUB_LABEL[sub.status] ?? sub.status} />
                  </td>
                  <td className={`px-4 py-3.5 text-[13px] ${sub.renewalSoon ? "font-semibold text-amber-600" : "text-ink/72"}`}>
                    {formatDateFull(sub.renewalDate)}
                    {sub.renewalSoon && " ⚠"}
                  </td>
                  <td className="px-6 py-3.5 text-right text-[13.5px] font-semibold">{formatDT(sub.monthlyAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {subs.length === 0 && <EmptyState message="Aucun abonnement." />}
        </div>
      </Card>
    </div>
  );
}
