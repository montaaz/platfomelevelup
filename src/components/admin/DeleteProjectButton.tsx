"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, secondaryBtnCls } from "@/components/Modal";

/**
 * Suppression d'un projet, avec confirmation. Comme pour un client, le projet
 * est retiré de l'interface mais reste en base : ses factures sont conservées.
 */
export function DeleteProjectButton({
  projectId,
  title,
  clientCompany,
  awaitingPayment,
}: {
  projectId: string;
  title: string;
  clientCompany: string;
  awaitingPayment: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($id: ID!) { archiveProject(id: $id) }`, { id: projectId });
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
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="text-[13px] font-medium text-ink/45 transition hover:text-red-600"
      >
        Supprimer
      </button>

      <Modal title="Supprimer ce projet ?" open={open} onClose={() => !busy && setOpen(false)}>
        <div className="space-y-4 text-left whitespace-normal">
          <p className="text-[13.5px] text-ink/80">
            <span className="font-semibold text-ink">{title}</span> ({clientCompany}) disparaîtra de la
            liste des projets, du tableau de bord et de l&apos;espace du client.
          </p>
          {awaitingPayment && (
            <p className="rounded-2xl bg-ink/3 px-4 py-3 text-[12.5px] text-ink/75">
              Sa commande en attente de paiement sera annulée : le client ne verra plus de bouton
              « Payer » pour ce projet.
            </p>
          )}
          <p className="text-[12px] text-ink/55">
            Les données ne sont pas effacées de la base : les factures liées à ce projet sont
            conservées.
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
