import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/invoices/PrintButton";
import { formatDT, formatDateFull, INVOICE_STATUS_LABEL } from "@/lib/format";
import type { getInvoice } from "@/server/services/directory";

export type InvoiceDetail = Awaited<ReturnType<typeof getInvoice>>;

const METHOD_LABEL: Record<string, string> = {
  VIREMENT: "Virement",
  CARTE: "Carte",
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  EN_LIGNE: "Paiement en ligne",
};

export function InvoiceDocument({ invoice, backHref }: { invoice: InvoiceDetail; backHref: string }) {
  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between print:hidden">
        <Link href={backHref} className="text-[13px] font-medium text-brand-500 hover:text-brand-600">
          ← Retour aux factures
        </Link>
        <PrintButton />
      </div>

      <section className="mx-auto max-w-3xl glass relative rounded-2xl p-8 print:max-w-none print:rounded-none print:border-0 print:p-2 print:shadow-none sm:p-10">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[20px] font-extrabold tracking-wide text-ink">
              LEVEL UP<span className="brand-text-gradient"> IA</span>
            </p>
            <p className="text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">
              Digital marketing powered by AI
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
              Tunis, Tunisie
              <br />
              contact@levelupia.tn
            </p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-bold text-ink">Facture {invoice.number}</p>
            <p className="mt-1 text-[12.5px] text-slate-500">Émise le {formatDateFull(invoice.issueDate)}</p>
            {invoice.dueDate && (
              <p className="text-[12.5px] text-slate-500">Échéance le {formatDateFull(invoice.dueDate)}</p>
            )}
            <div className="mt-2 flex justify-end">
              <StatusBadge status={invoice.status} label={INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status} />
            </div>
          </div>
        </div>

        {/* billed to */}
        <div className="mt-8 rounded-xl bg-slate-50 p-5 print:border print:border-slate-200 print:bg-white">
          <p className="text-[10.5px] font-semibold tracking-[0.12em] text-slate-400 uppercase">Facturé à</p>
          <p className="mt-1.5 text-[15px] font-semibold text-ink">{invoice.client.companyName}</p>
          <p className="text-[12.5px] leading-relaxed text-slate-500">
            {invoice.client.contactName}
            {invoice.client.address && (
              <>
                <br />
                {invoice.client.address}
                {invoice.client.city ? `, ${invoice.client.city}` : ""}
              </>
            )}
            {invoice.client.taxId && (
              <>
                <br />
                MF : {invoice.client.taxId}
              </>
            )}
          </p>
          {invoice.projectTitle && (
            <p className="mt-2 text-[12.5px] text-slate-500">
              Projet : <span className="font-medium text-ink">{invoice.projectTitle}</span>
              {invoice.serviceName ? ` (${invoice.serviceName})` : ""}
            </p>
          )}
        </div>

        {/* lines */}
        <table className="mt-8 w-full text-left">
          <thead>
            <tr className="border-y border-ink/10 text-[10.5px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
              <th className="py-2.5 pr-4">Description</th>
              <th className="py-2.5 pr-4 text-right">Qté</th>
              <th className="py-2.5 pr-4 text-right">Prix unitaire HT</th>
              <th className="py-2.5 text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={i} className="border-b border-ink/5">
                <td className="py-3 pr-4 text-[13.5px] text-ink">{line.description}</td>
                <td className="py-3 pr-4 text-right text-[13.5px] text-slate-600">{line.quantity}</td>
                <td className="py-3 pr-4 text-right text-[13.5px] text-slate-600">{formatDT(line.unitPrice, { decimals: 3 })}</td>
                <td className="py-3 text-right text-[13.5px] font-medium text-ink">{formatDT(line.lineTotal, { decimals: 3 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-6 ml-auto w-full max-w-64 space-y-1.5 text-[13.5px]">
          <div className="flex justify-between text-slate-500">
            <span>Sous-total HT</span>
            <span>{formatDT(invoice.subtotal, { decimals: 3 })}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>TVA {invoice.vatRate} %</span>
            <span>{formatDT(invoice.vatAmount, { decimals: 3 })}</span>
          </div>
          <div className="flex justify-between border-t border-ink/10 pt-2 text-[15px] font-bold text-ink">
            <span>Total TTC</span>
            <span>{formatDT(invoice.total, { decimals: 3 })}</span>
          </div>
        </div>

        {/* payments */}
        {invoice.payments.length > 0 && (
          <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 print:bg-white">
            <p className="text-[12.5px] font-semibold text-emerald-700">Paiement reçu</p>
            {invoice.payments.map((p, i) => (
              <p key={i} className="mt-1 text-[12.5px] text-emerald-700/90">
                {formatDT(p.amount, { decimals: 2 })} — {METHOD_LABEL[p.method] ?? p.method}
                {p.reference ? ` (réf. ${p.reference})` : ""}, le {formatDateFull(p.paidAt)}
              </p>
            ))}
          </div>
        )}

        {invoice.notes && <p className="mt-8 text-[12.5px] text-slate-500">{invoice.notes}</p>}

        <p className="mt-10 border-t border-ink/5 pt-4 text-center text-[11px] text-slate-400">
          Level Up IA — Digital marketing powered by AI · Merci de votre confiance.
        </p>
      </section>
    </div>
  );
}
