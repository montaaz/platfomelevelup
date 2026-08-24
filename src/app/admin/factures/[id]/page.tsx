import { notFound } from "next/navigation";
import { requireCtx, ForbiddenError } from "@/server/context";
import { getInvoice } from "@/server/services/directory";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";

export const dynamic = "force-dynamic";

export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx("ADMIN");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  try {
    const invoice = await getInvoice(ctx, BigInt(id));
    return <InvoiceDocument invoice={invoice} backHref="/admin/factures" />;
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
}
