"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "@/components/Modal";

/**
 * Vérification d'un justificatif de virement : l'admin ouvre le fichier,
 * contrôle le compte, puis valide (commande encaissée, accès et facture
 * créés) ou refuse en expliquant pourquoi au client.
 */
export function TransferReview({
  proofId,
  label,
  amount,
  reference,
  fileName,
}: {
  proofId: string;
  label: string;
  amount: string;
  reference: string | null;
  fileName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "accept" | "refuse">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      await gql(
        `mutation($id: ID!, $accept: Boolean!, $note: String) { reviewTransferProof(id: $id, accept: $accept, note: $note) }`,
        { id: proofId, accept, note: note || null },
      );
      setOpen(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a
        href={`/api/paiement/justificatif/${proofId}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700 hover:bg-amber-100"
        title={fileName}
      >
        Voir le justificatif
      </a>
      <button type="button" onClick={() => setOpen("accept")} className={`${primaryBtnCls} !px-3.5 !py-1.5 !text-[12.5px]`}>
        Valider le virement
      </button>
      <button type="button" onClick={() => setOpen("refuse")} className="text-[13px] font-medium text-ink/45 hover:text-red-600">
        Refuser
      </button>

      <Modal title={open === "accept" ? "Valider le virement ?" : "Refuser le justificatif ?"} open={open !== null} onClose={() => !busy && setOpen(null)}>
        <div className="space-y-4 text-left whitespace-normal">
          <p className="text-[13.5px] text-ink/80">
            <span className="font-semibold text-ink">{label}</span> — {amount}
            {reference ? <> · référence indiquée : <span className="font-medium text-ink">{reference}</span></> : null}
          </p>
          {open === "accept" ? (
            <p className="rounded-2xl bg-ink/3 px-4 py-3 text-[12.5px] text-ink/75">
              Confirmez seulement après avoir constaté le virement sur le compte. La commande passe en « Payée », la
              facture est émise et le projet démarre, comme pour un paiement par carte.
            </p>
          ) : (
            <div>
              <label className={labelCls}>Motif communiqué au client *</label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. : aucun virement reçu à ce jour, montant différent, justificatif illisible…"
                className={inputCls}
              />
            </div>
          )}
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setOpen(null)} disabled={busy} className={secondaryBtnCls}>
              Annuler
            </button>
            {open === "accept" ? (
              <button type="button" onClick={() => run(true)} disabled={busy} className={primaryBtnCls}>
                {busy ? "Validation…" : "Oui, virement reçu"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => run(false)}
                disabled={busy}
                className="rounded-xl bg-red-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-60"
              >
                {busy ? "Envoi…" : "Refuser et prévenir le client"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </span>
  );
}
