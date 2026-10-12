"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";

const STATUSES = [
  { value: "NOUVEAU", label: "Nouveau" },
  { value: "EN_COURS", label: "En cours" },
  { value: "CONVERTI", label: "Converti" },
  { value: "PERDU", label: "Perdu" },
];

/** Statut d'un contact (vaut pour tous ses messages) ; le changer lève aussi l'alerte de passation. */
export function LeadStatus({ leadId, status }: { leadId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function change(value: string) {
    setBusy(true);
    try {
      await gql(`mutation($id: ID!, $status: String!) { updateLeadStatus(id: $id, status: $status) }`, { id: leadId, status: value });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <select
      value={status}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="rounded-full border border-ink/10 bg-white/70 px-2.5 py-1 text-[12px] font-medium text-ink outline-none focus:border-brand-400 disabled:opacity-60"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
