"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { NeedsForm } from "@/components/client/NeedsForm";
import type { NeedDetails } from "@/lib/needs";
import styles from "@/styles/neu.module.css";

/** Modification du paramétrage après l'accueil : même formulaire, enregistrement à part. */
export function NeedsEditor({ mainNeeds: initialNeeds, details: initialDetails, allowed = null }: { mainNeeds: string[]; details: NeedDetails; allowed?: string[] | null }) {
  const router = useRouter();
  const [mainNeeds, setNeeds] = useState(initialNeeds);
  const [details, setDetails] = useState<NeedDetails>(initialDetails);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await gql(`mutation($mainNeeds: [String!]!, $needsDetails: String!) { saveNeeds(mainNeeds: $mainNeeds, needsDetails: $needsDetails) }`, { mainNeeds, needsDetails: JSON.stringify(details) });
      setMsg({ ok: true, text: "Paramétrage enregistré. L'équipe a été prévenue." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <NeedsForm mainNeeds={mainNeeds} details={details} allowed={allowed} onChange={(n, d) => { setNeeds(n); setDetails(d); }} />
      {msg && <p className={`mt-3 text-[13px] ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      <button type="button" onClick={save} disabled={busy || mainNeeds.length === 0} className={styles.submit} style={{ width: "100%", marginTop: 16, height: 50 }}>
        {busy ? "ENREGISTREMENT…" : "ENREGISTRER MON PARAMÉTRAGE"}
      </button>
    </div>
  );
}
