import Link from "next/link";
import { requireCtx } from "@/server/context";
import { listOrders, type OrderRow } from "@/server/services/orders";
import { Card, CardHeader, Avatar, StatusBadge, EmptyState } from "@/components/ui";
import { ConfirmPaymentButton } from "@/components/admin/ConfirmPaymentButton";
import { formatDT, formatDateFull } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE_PAIEMENT: "En attente de paiement",
  PAYEE: "Payée",
  ANNULEE: "Annulée",
};
const STATUS_TONE: Record<string, string> = {
  EN_ATTENTE_PAIEMENT: "EN_ATTENTE",
  PAYEE: "PAYEE",
  ANNULEE: "ANNULEE",
};

export default async function AdminCommandesPage() {
  const ctx = await requireCtx("ADMIN");
  const orders: OrderRow[] = await listOrders(ctx);
  const pending = orders.filter((o: OrderRow) => o.status === "EN_ATTENTE_PAIEMENT");
  const paid = orders.filter((o: OrderRow) => o.status === "PAYEE");

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Commandes du site vitrine</h2>
        <p className="mt-0.5 text-[12.5px] text-white/80">
          Un client n&apos;accède à la plateforme qu&apos;une fois son paiement confirmé.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-6">
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">À encaisser</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{pending.length}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Montant en attente</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">
              {formatDT(pending.reduce((sum: number, o: OrderRow) => sum + o.amount, 0))}
            </p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Encaissées</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{paid.length}</p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader title="Toutes les commandes" subtitle={`${orders.length} au total`} />
        <div className="divide-y divide-ink/4 pb-2">
          {orders.length === 0 && <EmptyState message="Aucune commande pour le moment." />}
          {orders.map((o: OrderRow) => (
            <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-6">
              <Avatar name={o.clientCompany} size={38} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/clients/${o.clientId}`}
                  className="block text-[13.5px] font-semibold text-ink hover:text-brand-600"
                >
                  {o.clientCompany}
                </Link>
                <p className="truncate text-[12px] text-ink/60">
                  {o.packName}
                  {o.isMonthly ? " · abonnement" : ""} · {formatDateFull(o.createdAt)}
                </p>
              </div>
              <StatusBadge status={STATUS_TONE[o.status] ?? "EN_ATTENTE"} label={STATUS_LABEL[o.status] ?? o.status} />
              <span className="text-[13.5px] font-semibold whitespace-nowrap">
                {formatDT(o.amount)}{o.isMonthly ? "/mois" : ""}
              </span>
              {o.status === "EN_ATTENTE_PAIEMENT" && (
                <ConfirmPaymentButton
                  orderId={o.id}
                  label={`${o.clientCompany} — ${o.packName}`}
                  amount={`${formatDT(o.amount)}${o.isMonthly ? "/mois" : ""}`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
