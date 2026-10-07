"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "@/components/Modal";

const STATUSES = [
  { value: "NOUVELLE", label: "Nouvelle" },
  { value: "EN_COURS", label: "En cours" },
  { value: "RESOLUE", label: "Résolue" },
  { value: "CLOTUREE", label: "Clôturée" },
];

/** Réponse écrite et changement de statut d'une réclamation ; le client est averti. */
export function ComplaintActions({
  complaintId,
  subject,
  status,
  reply,
}: {
  complaintId: string;
  subject: string;
  status: string;
  reply: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(status === "NOUVELLE" ? "EN_COURS" : status);
  const [text, setText] = useState(reply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await gql(
        `mutation($id: ID!, $status: String, $reply: String) { updateComplaint(id: $id, status: $status, reply: $reply) }`,
        { id: complaintId, status: newStatus, reply: text.trim() && text.trim() !== (reply ?? "") ? text.trim() : null },
      );
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
      <button type="button" onClick={() => setOpen(true)} className={`${primaryBtnCls} !px-3.5 !py-1.5 !text-[12.5px] whitespace-nowrap`}>
        {reply ? "Modifier la réponse" : "Répondre"}
      </button>

      <Modal title={`Réclamation — ${subject}`} open={open} onClose={() => !busy && setOpen(false)}>
        <div className="space-y-4 text-left">
          <div>
            <label className={labelCls}>Statut</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Réponse au client</label>
            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ce que vous avez constaté et la solution proposée (correction, nouvelle version, geste commercial, remboursement…)."
              className={inputCls}
            />
            <p className="mt-1 text-[11.5px] text-ink/55">Le client la lit dans son espace et la reçoit par e-mail.</p>
          </div>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className={secondaryBtnCls}>
              Annuler
            </button>
            <button type="button" onClick={save} disabled={busy} className={primaryBtnCls}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
