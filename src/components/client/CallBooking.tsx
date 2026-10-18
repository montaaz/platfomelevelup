"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/neu.module.css";

type Slot = { start: string; end: string };
const TZ = "Africa/Tunis";
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const dayLabel = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
const hour = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const full = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * Réservation d'un échange téléphonique de 30 minutes (notes de Sarra, §01) :
 * seuls les créneaux réellement libres du calendrier LevelUpAI Assistant sont
 * proposés. La réservation est faite tout de suite, côté serveur.
 */
export function CallBooking({ need, bookedAt, onChange, hint }: { need: string; bookedAt: string | null; onChange: (at: string | null) => void; hint: string }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<string | null>(bookedAt);

  async function load() {
    try {
      const res = await fetch("/api/rdv/creneaux", { cache: "no-store" });
      const data = (await res.json()) as { slots?: Slot[]; mine?: { start: string } | null };
      setSlots(data.slots ?? []);
      if (data.mine?.start) { setMine(data.mine.start); if (data.mine.start !== bookedAt) onChange(data.mine.start); }
    } catch {
      setSlots([]);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const days = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) m.set(dayKey(s.start), [...(m.get(dayKey(s.start)) ?? []), s]);
    return [...m.entries()];
  }, [slots]);
  const current = day ?? days[0]?.[0] ?? null;

  async function book(s: Slot) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rdv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: s.start, need }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Réservation impossible."); await load(); return; }
      setMine(s.start);
      onChange(s.start);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await fetch("/api/rdv", { method: "DELETE" });
      setMine(null);
      onChange(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.callBox}>
      <p className={styles.callTitle}>Planifier un échange téléphonique de 30 minutes</p>
      {mine ? (
        <div style={{ padding: "10px 12px", borderRadius: 12, background: "#e6f7ee", color: "#0a6b3c", fontSize: 13, fontWeight: 700 }}>
          ✓ Réservé le {full(mine)} (heure de Tunis).
          <button type="button" onClick={() => setMine(null)} disabled={busy} style={{ marginLeft: 8, border: 0, background: "none", color: "#0a5ff0", fontWeight: 700, cursor: "pointer" }}>Changer</button>
          <button type="button" onClick={() => void cancel()} disabled={busy} style={{ marginLeft: 4, border: 0, background: "none", color: "#b42318", fontWeight: 700, cursor: "pointer" }}>Annuler</button>
        </div>
      ) : slots === null ? (
        <p className={styles.callHint}>Chargement des créneaux disponibles…</p>
      ) : days.length === 0 ? (
        <p className={styles.callHint}>Aucun créneau libre dans les deux prochaines semaines : l&apos;équipe vous recontacte pour fixer l&apos;échange.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {days.map(([k, list]) => (
              <button key={k} type="button" onClick={() => setDay(k)} aria-pressed={k === current}
                className={`${styles.tick} ${k === current ? styles.tickOn : ""}`} style={{ flex: "none", justifyContent: "center", minWidth: 92 }}>
                {dayLabel(list[0]!.start)}
              </button>
            ))}
          </div>
          <div className={styles.grid3} style={{ marginTop: 8 }}>
            {(days.find(([k]) => k === current)?.[1] ?? []).map((s) => (
              <button key={s.start} type="button" disabled={busy} onClick={() => void book(s)} className={styles.tick} style={{ justifyContent: "center" }}>
                {hour(s.start)}
              </button>
            ))}
          </div>
          <p className={styles.callHint}>Heures de Tunis · seuls les créneaux libres de l&apos;équipe sont affichés.</p>
        </>
      )}
      {error && <p className="text-[12px] text-red-600" style={{ marginTop: 6 }}>{error}</p>}
      <p className={styles.callHint}>{hint}</p>
    </div>
  );
}
