import { requireCtx } from "@/server/context";
import { listInvoices } from "@/server/services/directory";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { formatDT } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientInvoicesPage() {
  const ctx = await requireCtx("CLIENT");
  const invoices = await listInvoices(ctx); // scoped to this client in SQL
  const unpaid = invoices.filter((i) => i.status === "EN_ATTENTE" || i.status === "EN_RETARD");

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Vos factures</h2>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-6 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">À régler</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{formatDT(unpaid.reduce((s, i) => s + i.total, 0))}</p>
            <p className="mt-1.5 text-[11.5px] text-white/78">{unpaid.length} facture{unpaid.length > 1 ? "s" : ""}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Factures reçues</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{invoices.length}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Réglées</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{invoices.filter((i) => i.status === "PAYEE").length}</p>
          </div>
        </div>
      </section>

      <InvoiceTable invoices={invoices} showClient={false} basePath="/client/factures" />
    </div>
  );
}
