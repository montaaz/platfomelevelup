/** Shared display helpers — French interface, DT currency (3 decimals in DB, 0–2 shown). */

/** Montant dans sa devise : « 890 DT » en Tunisie, « 890 € » pour un client hors Tunisie. */
export function formatMoney(value: number | string, currency?: string | null, opts: { decimals?: number } = {}) {
  if (currency === "EUR") return formatDT(value, opts).replace(/\s*DT$/, " €");
  if (currency === "USD") return formatDT(value, opts).replace(/\s*DT$/, " USD");
  return formatDT(value, opts);
}

export function formatDT(value: number | string, opts: { decimals?: number } = {}) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const decimals = opts.decimals ?? (Number.isInteger(n) ? 0 : 2);
  return (
    new Intl.NumberFormat("fr-TN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n) + " DT"
  );
}

const MONTHS_SHORT = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

export function formatDateShort(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

export function formatDateFull(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function relativeTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} Mo`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} Ko`;
  return `${bytes} o`;
}

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE_PAIEMENT: "En attente de paiement",
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  EN_REVISION: "En révision",
  LIVRE: "Livré",
  CLOTURE: "Clôturé",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  EN_ATTENTE: "En attente",
  PAYEE: "Payée",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
};

/** Somme par devise : « 890 DT + 290 USD » (jamais de dinars et de dollars additionnés). */
export function formatTotals(rows: { amount: number; currency?: string | null }[], opts: { decimals?: number } = {}) {
  const by = new Map<string, number>();
  for (const r of rows) {
    const c = r.currency || "TND";
    by.set(c, (by.get(c) ?? 0) + (Number(r.amount) || 0));
  }
  if (by.size === 0) return formatDT(0, opts);
  return [...by.entries()].sort(([a], [b]) => (a === "TND" ? -1 : b === "TND" ? 1 : a.localeCompare(b)))
    .map(([c, v]) => formatMoney(v, c, opts)).join(" + ");
}
