"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, secondaryBtnCls } from "@/components/Modal";

type Impact = { companyName: string; projects: number; invoices: number; accounts: number };

/**
 * Suppression d'un client, avec confirmation.
 *
 * La confirmation annonce ce qui va réellement se passer plutôt qu'un « êtes-vous
 * sûr ? » : le client est archivé, pas effacé. Ses factures restent en base —
 * une pièce comptable se conserve dix ans — mais il disparaît de l'interface.
 * Le décompte de ses projets et factures est relu au moment du clic, pour que
 * l'avertissement porte sur l'état réel et non sur une page ouverte depuis
 * longtemps.
 */
export function DeleteClientButton({
  clientId,
  companyName,
}: {
  clientId: string;
  companyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setError(null);
    setImpact(null);
    setOpen(true);
    try {
      const data = await gql<{ clientDeletionImpact: Impact }>(
        `query($id: ID!) { clientDeletionImpact(id: $id) { companyName projects invoices accounts } }`,
        { id: clientId },
      );
      setImpact(data.clientDeletionImpact);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($id: ID!) { archiveClient(id: $id) { companyName } }`, { id: clientId });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={ask}
        className="text-[13px] font-medium text-ink/45 transition hover:text-red-600"
      >
        Supprimer
      </button>

      <Modal title="Supprimer ce client ?" open={open} onClose={() => !busy && setOpen(false)}>
        <div className="space-y-4">
          <p className="text-[13.5px] text-ink/80">
            <span className="font-semibold text-ink">{impact?.companyName ?? companyName}</span>{" "}
            disparaîtra de la liste, du tableau de bord et de la recherche.
          </p>

          {impact && (impact.projects > 0 || impact.invoices > 0 || impact.accounts > 0) && (
            <ul className="space-y-1.5 rounded-2xl bg-ink/3 px-4 py-3 text-[12.5px] text-ink/75">
              {impact.projects > 0 && (
                <li>
                  <span className="font-semibold text-ink">{impact.projects}</span> projet
                  {impact.projects > 1 ? "s" : ""} — retiré{impact.projects > 1 ? "s" : ""} des
                  tableaux
                </li>
              )}
              {impact.invoices > 0 && (
                <li>
                  <span className="font-semibold text-ink">{impact.invoices}</span> facture
                  {impact.invoices > 1 ? "s" : ""} — conservée{impact.invoices > 1 ? "s" : ""} en
                  base, comme l&apos;exige la comptabilité
                </li>
              )}
              {impact.accounts > 0 && (
                <li>
                  <span className="font-semibold text-ink">{impact.accounts}</span> accès de
                  connexion — désactivé{impact.accounts > 1 ? "s" : ""} aussitôt
                </li>
              )}
            </ul>
          )}

          <p className="text-[12px] text-ink/55">
            Les données ne sont pas effacées : contactez-nous si vous devez revenir en arrière.
          </p>

          {error && <p className="text-[12.5px] text-red-600">{error}</p>}

          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className={secondaryBtnCls}>
              Non, annuler
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="rounded-xl bg-red-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-60"
            >
              {busy ? "Suppression…" : "Oui, supprimer"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
