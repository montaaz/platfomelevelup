/**
 * Créneaux d'échange téléphonique (notes de Sarra, §01 « Réservation »).
 *
 * Seuls les créneaux réellement disponibles sont proposés :
 *   - plages d'ouverture de l'agence (heure de Tunis), du lendemain à J+14 ;
 *   - moins les rendez-vous déjà pris ;
 *   - moins les occupations du calendrier « LevelUpAI Assistant » (flux iCal
 *     secret fourni par BOOKING_BUSY_ICS_URL), pour ne jamais proposer une
 *     heure où l'équipe est déjà prise.
 * Fonctions pures (sans base ni réseau), testées à part.
 */

export const SLOT_MINUTES = 30;
export const BOOKING_DAYS = 14;
export const TZ = "Africa/Tunis";

/** Plages d'ouverture par jour de semaine (0 = dimanche), en heures locales de Tunis. */
export const OPENING: Record<number, [string, string][]> = {
  1: [["09:00", "12:30"], ["14:00", "17:30"]],
  2: [["09:00", "12:30"], ["14:00", "17:30"]],
  3: [["09:00", "12:30"], ["14:00", "17:30"]],
  4: [["09:00", "12:30"], ["14:00", "17:30"]],
  5: [["09:00", "12:30"], ["14:00", "16:30"]],
  6: [["10:00", "13:00"]],
};

export type Busy = { start: Date; end: Date };
export type Slot = { start: string; end: string };

/** Décalage (minutes) du fuseau de Tunis à une date donnée. */
function tunisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Instant UTC d'une heure locale de Tunis (jour donné par y/m/d). */
function tunisLocal(y: number, m: number, d: number, hhmm: string): Date {
  const [h, min] = hhmm.split(":").map(Number) as [number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  return new Date(guess.getTime() - tunisOffsetMinutes(guess) * 60000);
}

/** Créneaux libres entre demain et J+BOOKING_DAYS. */
export function freeSlots(now: Date, taken: Busy[], days = BOOKING_DAYS): Slot[] {
  const out: Slot[] = [];
  const minStart = now.getTime() + 12 * 3600_000; // au moins 12 h de délai
  for (let i = 1; i <= days; i++) {
    const day = new Date(now.getTime() + i * 86_400_000);
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(day).split("-").map(Number) as [number, number, number];
    const weekday = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2])).getUTCDay();
    for (const [from, to] of OPENING[weekday] ?? []) {
      const end = tunisLocal(ymd[0], ymd[1], ymd[2], to).getTime();
      for (let t = tunisLocal(ymd[0], ymd[1], ymd[2], from).getTime(); t + SLOT_MINUTES * 60000 <= end; t += SLOT_MINUTES * 60000) {
        const s = t, e = t + SLOT_MINUTES * 60000;
        if (s < minStart) continue;
        if (taken.some((b) => b.start.getTime() < e && b.end.getTime() > s)) continue;
        out.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
      }
    }
  }
  return out;
}

/** Le créneau demandé fait-il partie des créneaux proposés ? (contrôle serveur avant réservation) */
export function isBookable(startIso: string, now: Date, taken: Busy[]): boolean {
  return freeSlots(now, taken).some((s) => s.start === new Date(startIso).toISOString());
}

/* ------------------------------------------------------------------ iCal */

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
}

/** Flux iCal des rendez-vous, auquel s'abonne le calendrier « LevelUpAI Assistant ». */
export function appointmentsIcs(rows: { id: string; start: Date; end: Date; summary: string; description: string }[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Level Up AI//Rendez-vous//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:LevelUpAI Assistant — rendez-vous clients", `X-WR-TIMEZONE:${TZ}`,
  ];
  for (const r of rows) {
    lines.push(
      "BEGIN:VEVENT", `UID:rdv-${r.id}@levelupia.app`, `DTSTAMP:${icsDate(now)}`, `DTSTART:${icsDate(r.start)}`, `DTEND:${icsDate(r.end)}`,
      `SUMMARY:${icsEscape(r.summary)}`, `DESCRIPTION:${icsEscape(r.description)}`, "STATUS:CONFIRMED", "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Occupations lues dans un flux iCal (calendrier « LevelUpAI Assistant ») : DTSTART/DTEND des événements. */
export function parseIcsBusy(ics: string): Busy[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const out: Busy[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0] ?? "";
    if (/^TRANSP:TRANSPARENT/m.test(body) || /^STATUS:CANCELLED/m.test(body)) continue;
    const start = readIcsDate(body, "DTSTART");
    const end = readIcsDate(body, "DTEND") ?? (start ? new Date(start.getTime() + 3600_000) : null);
    if (start && end) out.push({ start, end });
  }
  return out;
}

function readIcsDate(body: string, key: string): Date | null {
  const m = body.match(new RegExp(`^${key}(;[^:\\n]*)?:([0-9TZ]+)`, "m"));
  if (!m) return null;
  const v = m[2]!;
  const params = m[1] ?? "";
  if (/^\d{8}$/.test(v)) { // journée entière : bloque la journée (heure de Tunis)
    return tunisLocal(Number(v.slice(0, 4)), Number(v.slice(4, 6)), Number(v.slice(6, 8)), "00:00");
  }
  const mm = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!mm) return null;
  const [, y, mo, d, h, mi] = mm.map(Number) as unknown as [number, number, number, number, number, number];
  if (mm[7] === "Z") return new Date(Date.UTC(y, mo - 1, d, h, mi));
  // heure locale avec TZID : traitée comme heure de Tunis (le calendrier de l'agence)
  void params;
  return tunisLocal(y, mo, d, `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
}
