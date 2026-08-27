import Link from "next/link";
import { Card, CardHeader, Avatar, StatusBadge, EmptyState } from "@/components/ui";
import { MarkPaidButton } from "@/components/admin/MarkPaidButton";
import { formatDT, formatDateFull, INVOICE_STATUS_LABEL } from "@/lib/format";

export type InvoiceRowData = {
  id: string;
  number: string;
  clientCompany: string;
  projectTitle: string | null;
  serviceName: string | null;
  status: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
};

export function InvoiceTable({
  invoices,
  showClient,
  withActions = false,
  basePath,
}: {
  invoices: InvoiceRowData[];
  showClient: boolean;
  withActions?: boolean;
  basePath: string;
}) {
  return (
    <Card>
      <CardHeader
        title={showClient ? "Toutes les factures" : "Vos factures"}
        subtitle="Numérotation séquentielle — chaque facture garde son détail"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-150 text-left">
          <thead>
            <tr className="border-y border-ink/5 text-[10.5px] font-semibold tracking-[0.1em] text-ink/60 uppercase">
              <th className="px-6 py-2.5">{showClient ? "Client" : "Facture"}</th>
              <th className="px-4 py-2.5">Numéro</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-6 py-2.5 text-right">Montant TTC</th>
              {withActions && <th className="px-6 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-ink/4 last:border-0 hover:bg-white/40">
                <td className="px-6 py-3.5">
                  <Link href={`${basePath}/${invoice.id}`} className="flex items-center gap-3">
                    <Avatar name={invoice.clientCompany} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-ink hover:text-brand-600">
                        {showClient ? invoice.clientCompany : invoice.projectTitle ?? invoice.clientCompany}
                      </p>
                      <p className="truncate text-[12px] text-ink/60">
                        {invoice.serviceName ?? invoice.projectTitle ?? "Prestation"}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-[13px] font-medium text-ink/82">
                  <Link href={`${basePath}/${invoice.id}`} className="hover:text-brand-600">
                    {invoice.number}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-[13px] text-ink/72">{formatDateFull(invoice.issueDate)}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={invoice.status} label={INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status} />
                </td>
                <td className="px-6 py-3.5 text-right text-[13.5px] font-semibold">{formatDT(invoice.total, { decimals: 2 })}</td>
                {withActions && (
                  <td className="px-6 py-3.5 text-right">
                    {(invoice.status === "EN_ATTENTE" || invoice.status === "EN_RETARD") && (
                      <MarkPaidButton invoiceId={invoice.id} number={invoice.number} />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && <EmptyState message="Aucune facture." />}
      </div>
      {/* Paiement en ligne : bouton « Payer » masqué tant que la passerelle n'est pas
          validée (cahier des charges, chapitre 8, point 4). */}
    </Card>
  );
}
