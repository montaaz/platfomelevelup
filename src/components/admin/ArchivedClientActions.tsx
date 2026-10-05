"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, secondaryBtnCls } from "@/components/Modal";

/**
 * Actions sur un client supprimé : le réactiver (tout revient comme avant) ou
 * le supprimer définitivement (irréversible, donc confirmé dans une fenêtre
 * qui dit ce qui sera effacé). Un client qui a des factures ne peut pas être
 * supprimé définitivement : la fenêtre l'explique au lieu de proposer le bouton.
 */
export function ArchivedClientActions({
  clientId,
  companyName,
  projects,
  invoices,
}: {
  clientId: string;
  companyName: string;
  projects: number;
  invoices: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"restore" | "purge" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "restore" | "purge") {
    setBusy(kind);
    setError(null);
    try {
      await gql(
        kind === "restore"
          ? `mutation($id: ID!) { restoreClient(id: $id) }`
          : `mutation($id: ID!) { purgeClient(id: $id) }`,
        { id: clientId },
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={() => run("restore")}
        disabled={busy !== null}
        className="text-[13px] font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-60"
      >
        {busy === "restore" ? "Réactivation…" : "Réactiver"}
      </button>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={busy !== null}
        className="text-[13px] font-medium text-ink/45 transition hover:text-red-600 disabled:opacity-60"
      >
        Supprimer définitivement
      </button>
      {error && !open && <span className="text-[12px] text-red-600">{error}</span>}

      <Modal title="Supprimer définitivement ?" open={open} onClose={() => busy === null && setOpen(false)}>
        <div className="space-y-4 text-left whitespace-normal">
          {invoices > 0 ? (
            <p className="text-[13.5px] text-ink/80">
              <span className="font-semibold text-ink">{companyName}</span> a {invoices} facture
              {invoices > 1 ? "s" : ""}. La comptabilité impose de les conserver dix ans : ce client ne
              peut pas être supprimé définitivement. Il reste archivé, invisible dans le reste de
              l&apos;interface.
            </p>
          ) : (
            <>
              <p className="text-[13.5px] text-ink/80">
                <span className="font-semibold text-ink">{companyName}</span> sera effacé de la base :
                sa fiche, ses accès de connexion
                {projects > 0 ? `, ses ${projects} projet${projects > 1 ? "s" : ""}` : ""}, ses messages,
                ses livrables et ses commandes.
              </p>
              <p className="text-[12.5px] font-semibold text-red-600">
                Cette action est irréversible : le client ne pourra plus être réactivé.
              </p>
            </>
          )}

          {error && <p className="text-[12.5px] text-red-600">{error}</p>}

          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setOpen(false)} disabled={busy !== null} className={secondaryBtnCls}>
              {invoices > 0 ? "Fermer" : "Non, annuler"}
            </button>
            {invoices === 0 && (
              <button
                type="button"
                onClick={() => run("purge")}
                disabled={busy !== null}
                className="rounded-xl bg-red-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-60"
              >
                {busy === "purge" ? "Suppression…" : "Oui, supprimer définitivement"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </span>
  );
}
