"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";

const METHODS = [
  { value: "VIREMENT", label: "Virement" },
  { value: "ESPECES", label: "Espèces" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "CARTE", label: "Carte" },
  { value: "EN_LIGNE", label: "En ligne" },
];

export function MarkPaidButton({ invoiceId, number }: { invoiceId: string; number: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("VIREMENT");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($invoiceId: ID!, $method: String!, $reference: String) {
        markInvoicePaid(invoiceId: $invoiceId, method: $method, reference: $reference)
      }`, { invoiceId, method, reference: reference || null });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-600 hover:bg-emerald-100"
      >
        Marquer payée
      </button>
      <Modal title={`Encaisser ${number}`} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Moyen de paiement</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Référence (facultatif)</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} placeholder="N° de virement, chèque…" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>}
          <button type="button" onClick={confirm} disabled={busy} className={primaryBtnCls}>
            {busy ? "Enregistrement…" : "Confirmer le paiement"}
          </button>
        </div>
      </Modal>
    </>
  );
}
