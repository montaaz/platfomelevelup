import { requireCtx } from "@/server/context";
import { clientHistory } from "@/server/services/directory";
import { Card, CardHeader, Avatar, StatusBadge, EmptyState } from "@/components/ui";
import { formatDT, formatDateFull, PROJECT_STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientHistoryPage() {
  const ctx = await requireCtx("CLIENT");
  const history = await clientHistory(ctx);

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Historique des commandes</h2>
        <p className="mt-0.5 text-[12px] text-white/78">
          Tous vos projets, passés et en cours — un projet clôturé reste consultable.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Projets au total</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{history.length}</p>
          </div>
          <div className="glass-dark rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Montant total commandé</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{formatDT(history.reduce((s, h) => s + h.price, 0))}</p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader title="Vos commandes" subtitle="Avec dates et montants" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 text-left">
            <thead>
              <tr className="border-y border-ink/5 text-[10.5px] font-semibold tracking-[0.1em] text-ink/60 uppercase">
                <th className="px-6 py-2.5">Projet</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5">Commandé le</th>
                <th className="px-4 py-2.5">Livré le</th>
                <th className="px-6 py-2.5 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-ink/4 last:border-0 hover:bg-white/40">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={h.title} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-ink">{h.title}</p>
                        <p className="truncate text-[12px] text-ink/60">{h.serviceName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={h.status} label={PROJECT_STATUS_LABEL[h.status] ?? h.status} />
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-ink/72">{formatDateFull(h.startDate ?? h.createdAt)}</td>
                  <td className="px-4 py-3.5 text-[13px] text-ink/72">{formatDateFull(h.deliveredAt)}</td>
                  <td className="px-6 py-3.5 text-right text-[13.5px] font-semibold">{formatDT(h.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && <EmptyState message="Aucune commande pour le moment." />}
        </div>
      </Card>
    </div>
  );
}
