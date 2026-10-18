"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMMITMENTS, commitmentAmount } from "@/lib/commitment";
import { formatMoney } from "@/lib/format";

/**
 * Choix de l'engagement d'un abonnement, avec les promotions de la grille
 * tarifaire : 6 mois = 1 mois offert, 12 mois = 2 mois offerts.
 */
export function EngagementPicker({ orderId, monthly, currency, current }: { orderId: string; monthly: number; currency: string; current: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(months: number) {
    if (months === current || busy) return;
    setBusy(months);
    setError(null);
    try {
      const res = await fetch("/api/paiement/engagement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, months }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Modification impossible.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modification impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: 14, textAlign: "left" }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, color: "#26303f" }}>Durée d&apos;engagement</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
        {COMMITMENTS.map((c) => {
          const on = c.months === current;
          return (
            <button key={c.months} type="button" onClick={() => void choose(c.months)} disabled={busy !== null} aria-pressed={on}
              style={{
                borderRadius: 14, padding: "10px 8px", cursor: "pointer", textAlign: "center",
                border: on ? "2px solid #0a5ff0" : "1px solid #d9dfeb", background: on ? "#eef3ff" : "#fff",
              }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#26303f" }}>{busy === c.months ? "…" : c.label}</span>
              {c.promo && <span style={{ display: "inline-block", marginTop: 4, padding: "2px 7px", borderRadius: 999, background: "#e6f7ee", color: "#0a8f4e", fontSize: 10.5, fontWeight: 800 }}>{c.promo}</span>}
              <span style={{ display: "block", marginTop: 4, fontSize: 11.5, color: "#6b7689" }}>{formatMoney(commitmentAmount(monthly, c.months), currency)}</span>
            </button>
          );
        })}
      </div>
      {error && <p style={{ marginTop: 6, fontSize: 12, color: "#b42318" }}>{error}</p>}
    </div>
  );
}
