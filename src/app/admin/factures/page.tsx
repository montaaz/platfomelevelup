import { requireCtx } from "@/server/context";
import { listInvoices, listClients, listProjects } from "@/server/services/directory";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { InvoiceFormButton } from "@/components/admin/InvoiceFormModal";
import { formatDT } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  const ctx = await requireCtx("ADMIN");
  const [invoices, clients, projects] = await Promise.all([listInvoices(ctx), listClients(ctx), listProjects(ctx)]);
  const unpaid = invoices.filter((i) => i.status === "EN_ATTENTE" || i.status === "EN_RETARD");
  const paid = invoices.filter((i) => i.status === "PAYEE");

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Facturation</h2>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-6 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">À recouvrer</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{formatDT(unpaid.reduce((s, i) => s + i.total, 0))}</p>
            <p className="mt-1.5 text-[11.5px] text-white/78">{unpaid.length} facture{unpaid.length > 1 ? "s" : ""}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Encaissé</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{formatDT(paid.reduce((s, i) => s + i.total, 0))}</p>
            <p className="mt-1.5 text-[11.5px] text-white/78">{paid.length} facture{paid.length > 1 ? "s" : ""} payée{paid.length > 1 ? "s" : ""}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">En retard</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{invoices.filter((i) => i.status === "EN_RETARD").length}</p>
            <p className="mt-1.5 text-[11.5px] text-white/78">à relancer en priorité</p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <InvoiceFormButton
          clients={clients.map((c) => ({ id: c.id, name: c.companyName }))}
          projects={projects.map((p) => ({ id: p.id, name: p.title, clientId: p.clientId }))}
        />
      </div>

      <InvoiceTable invoices={invoices} showClient withActions basePath="/admin/factures" />
    </div>
  );
}
